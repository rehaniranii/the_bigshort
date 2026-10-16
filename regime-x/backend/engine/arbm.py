"""
REGIME-X | Adaptive Regression Breakout Map — Python Engine
Faithful port of adaptive_regression_breakout_map.pine (Pine Script v6)

Key differences from Pine Script documented inline.
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ARBMConfig:
    """Configuration mirroring Pine Script inputs."""
    # Regression Model
    length: int = 50          # Regression Length
    dev_mult: float = 2.0     # Deviation Multiplier

    # Contraction Metrics
    sqz_len: int = 100        # Lookback Period
    sqz_pct: float = 20.0     # Contraction Threshold %

    # Target Architecture
    tp1_mult: float = 1.0     # TP1 Multiplier (x Bandwidth)
    tp2_mult: float = 2.0     # TP2 Multiplier (x Bandwidth)
    tp3_mult: float = 3.0     # TP3 Multiplier (x Bandwidth)

    # Pivot detection
    piv_len: int = 10

    # Backtesting extensions (not in Pine Script)
    initial_capital: float = 100_000.0
    position_size_pct: float = 1.0   # fraction of capital per trade
    fee_pct: float = 0.001           # 0.1% round-trip each leg
    slippage_pct: float = 0.0005     # 0.05% slippage


def _linreg_value(series: np.ndarray) -> float:
    """
    Compute the current (last) value of a linear regression over `series`.
    Equivalent to ta.linreg(close, length, 0) in Pine Script.
    Uses least-squares line fitted to the window, evaluated at the last point.
    """
    n = len(series)
    x = np.arange(n, dtype=float)
    # polyfit: degree-1 polynomial
    coeffs = np.polyfit(x, series, 1)
    # evaluate at last point (x = n-1)
    return coeffs[0] * (n - 1) + coeffs[1]


def compute_regression_features(df: pd.DataFrame, cfg: ARBMConfig) -> pd.DataFrame:
    """
    Compute all ARBM indicator columns on a DataFrame with OHLCV columns.
    Returns df with new columns added. Input df must have 'close', 'high', 'low'.

    ⚠️ std ddof=0 to match Pine Script ta.stdev (population std).
    """
    close = df['close']
    high  = df['high']
    low   = df['low']
    n = len(df)

    reg_basis  = np.full(n, np.nan)
    std_dev    = np.full(n, np.nan)
    upper_band = np.full(n, np.nan)
    lower_band = np.full(n, np.nan)

    for i in range(cfg.length - 1, n):
        window = close.iloc[i - cfg.length + 1 : i + 1].values
        reg_basis[i] = _linreg_value(window)
        # ddof=0 — population std, matching Pine Script ta.stdev
        std_dev[i]   = window.std(ddof=0)

    upper_band = reg_basis + std_dev * cfg.dev_mult
    lower_band = reg_basis - std_dev * cfg.dev_mult
    band_width = upper_band - lower_band

    bw_series  = pd.Series(band_width, index=df.index)
    min_width  = bw_series.rolling(cfg.sqz_len).min()
    max_width  = bw_series.rolling(cfg.sqz_len).max()
    width_pct  = (bw_series - min_width) / (max_width - min_width + 1e-9) * 100
    is_squeeze = width_pct <= cfg.sqz_pct

    df = df.copy()
    df['reg_basis']  = reg_basis
    df['std_dev']    = std_dev
    df['upper_band'] = upper_band
    df['lower_band'] = lower_band
    df['band_width'] = band_width
    df['min_width']  = min_width.values
    df['max_width']  = max_width.values
    df['width_pct']  = width_pct.values
    df['is_squeeze'] = is_squeeze.values

    # Breakout signals — require prior bar in squeeze
    # bullTrigger = close > upperBand and close[1] <= upperBand[1] and isSqueeze[1]
    close_s  = pd.Series(close.values, index=df.index)
    upper_s  = pd.Series(upper_band,   index=df.index)
    lower_s  = pd.Series(lower_band,   index=df.index)
    squeeze_s = pd.Series(is_squeeze.values, index=df.index)

    df['bull_trigger'] = (
        (close_s > upper_s) &
        (close_s.shift(1) <= upper_s.shift(1)) &
        (squeeze_s.shift(1).fillna(False))
    )
    df['bear_trigger'] = (
        (close_s < lower_s) &
        (close_s.shift(1) >= lower_s.shift(1)) &
        (squeeze_s.shift(1).fillna(False))
    )

    # Regression slope (additional feature for ML)
    reg_slope = np.full(n, np.nan)
    for i in range(cfg.length - 1, n):
        window = close.iloc[i - cfg.length + 1 : i + 1].values
        x = np.arange(len(window), dtype=float)
        coeffs = np.polyfit(x, window, 1)
        reg_slope[i] = coeffs[0]
    df['reg_slope'] = reg_slope / (close.values + 1e-9)  # normalize by price

    # Pivot highs/lows (simplified — used for S/R trendlines)
    df['pivot_high'] = _rolling_pivot_high(high, cfg.piv_len)
    df['pivot_low']  = _rolling_pivot_low(low,  cfg.piv_len)

    return df


def _rolling_pivot_high(series: pd.Series, n: int) -> pd.Series:
    """Detect pivot highs: local max over [i-n, i+n]. Returns NaN where not pivot."""
    result = pd.Series(np.nan, index=series.index)
    vals = series.values
    length = len(vals)
    for i in range(n, length - n):
        window = vals[i - n: i + n + 1]
        if vals[i] == window.max() and np.sum(window == vals[i]) == 1:
            result.iloc[i] = vals[i]
    return result


def _rolling_pivot_low(series: pd.Series, n: int) -> pd.Series:
    """Detect pivot lows: local min over [i-n, i+n]."""
    result = pd.Series(np.nan, index=series.index)
    vals = series.values
    length = len(vals)
    for i in range(n, length - n):
        window = vals[i - n: i + n + 1]
        if vals[i] == window.min() and np.sum(window == vals[i]) == 1:
            result.iloc[i] = vals[i]
    return result


@dataclass
class Trade:
    entry_idx: int
    entry_price: float
    direction: int          # 1 = long, -1 = short
    sl_price: float
    tp1_price: float
    tp2_price: float
    tp3_price: float
    tp1_hit: bool = False
    tp2_hit: bool = False
    exit_idx: Optional[int] = None
    exit_price: Optional[float] = None
    exit_reason: str = ""   # "TP3", "SL", "SL_after_TP1", "SL_after_TP2", "EOD"
    pnl_pct: float = 0.0


def run_backtest(df: pd.DataFrame, cfg: ARBMConfig) -> dict:
    """
    Backtest the ARBM strategy on a prepared DataFrame.

    Differences from Pine Script:
    - Entry at NEXT bar open (not current close) to avoid lookahead
    - SL/TP checked intra-bar with priority: TP3 > TP2 > TP1 > SL
      (Pine Script checks independently within same bar)
    - Transaction costs applied (fee_pct each leg, slippage_pct)
    - Position sized as position_size_pct fraction of current equity

    Returns dict with trades list, equity curve, and performance metrics.
    """
    df = df.reset_index(drop=True)
    n = len(df)

    capital   = cfg.initial_capital
    equity    = [capital]
    trades    = []
    positions = []  # for equity curve tracking

    trade: Optional[Trade] = None

    for i in range(1, n):
        row    = df.iloc[i]
        prev   = df.iloc[i - 1]

        # ── Check open trade ──────────────────────────────────────────────
        if trade is not None:
            bar_high = row['high']
            bar_low  = row['low']
            bar_close = row['close']

            closed = False

            # Long trade checks
            if trade.direction == 1:
                # Priority: TP3 > TP2 > TP1 > SL
                if bar_high >= trade.tp3_price:
                    _close_trade(trade, i, trade.tp3_price, "TP3", cfg)
                    capital = _apply_pnl(capital, trade, cfg)
                    trades.append(trade)
                    trade = None
                    closed = True
                elif bar_high >= trade.tp2_price and not trade.tp2_hit:
                    trade.tp2_hit = True
                    trade.tp1_hit = True  # Ensure tp1 is also marked hit so SL is not moved backward
                    trade.sl_price = trade.tp1_price  # lock TP1
                elif bar_high >= trade.tp1_price and not trade.tp1_hit:
                    trade.tp1_hit = True
                    trade.sl_price = trade.entry_price  # move to breakeven

                if not closed and bar_low <= trade.sl_price:
                    reason = "SL_after_TP2" if trade.tp2_hit else ("SL_after_TP1" if trade.tp1_hit else "SL")
                    # Realistic execution: account for gap down at open
                    exit_px = min(row['open'], trade.sl_price)
                    _close_trade(trade, i, exit_px, reason, cfg)
                    capital = _apply_pnl(capital, trade, cfg)
                    trades.append(trade)
                    trade = None
                    closed = True

            # Short trade checks
            elif trade.direction == -1:
                if bar_low <= trade.tp3_price:
                    _close_trade(trade, i, trade.tp3_price, "TP3", cfg)
                    capital = _apply_pnl(capital, trade, cfg)
                    trades.append(trade)
                    trade = None
                    closed = True
                elif bar_low <= trade.tp2_price and not trade.tp2_hit:
                    trade.tp2_hit = True
                    trade.tp1_hit = True  # Ensure tp1 is also marked hit
                    trade.sl_price = trade.tp1_price
                elif bar_low <= trade.tp1_price and not trade.tp1_hit:
                    trade.tp1_hit = True
                    trade.sl_price = trade.entry_price

                if not closed and bar_high >= trade.sl_price:
                    reason = "SL_after_TP2" if trade.tp2_hit else ("SL_after_TP1" if trade.tp1_hit else "SL")
                    # Realistic execution: account for gap up at open
                    exit_px = max(row['open'], trade.sl_price)
                    _close_trade(trade, i, exit_px, reason, cfg)
                    capital = _apply_pnl(capital, trade, cfg)
                    trades.append(trade)
                    trade = None
                    closed = True

        # ── Check new signals (only when no open trade) ──────────────────
        if trade is None:
            # Enter on next bar open (i is the entry bar; signal on prev bar close)
            # Pine Script uses lowerBand[1] / bandWidth[1] relative to trigger bar (bar i-2)
            squeeze_bar = df.iloc[i - 2] if i >= 2 else prev
            if prev['bull_trigger']:
                entry_px = row['open'] * (1 + cfg.slippage_pct)
                bw       = squeeze_bar['band_width']
                sl_px    = squeeze_bar['lower_band']
                trade = Trade(
                    entry_idx=i,
                    entry_price=entry_px,
                    direction=1,
                    sl_price=sl_px,
                    tp1_price=entry_px + bw * cfg.tp1_mult,
                    tp2_price=entry_px + bw * cfg.tp2_mult,
                    tp3_price=entry_px + bw * cfg.tp3_mult,
                )
            elif prev['bear_trigger']:
                entry_px = row['open'] * (1 - cfg.slippage_pct)
                bw       = squeeze_bar['band_width']
                sl_px    = squeeze_bar['upper_band']
                trade = Trade(
                    entry_idx=i,
                    entry_price=entry_px,
                    direction=-1,
                    sl_price=sl_px,
                    tp1_price=entry_px - bw * cfg.tp1_mult,
                    tp2_price=entry_px - bw * cfg.tp2_mult,
                    tp3_price=entry_px - bw * cfg.tp3_mult,
                )

        equity.append(capital)

    # Close any open trade at end
    if trade is not None:
        last = df.iloc[-1]
        _close_trade(trade, n - 1, last['close'], "EOD", cfg)
        capital = _apply_pnl(capital, trade, cfg)
        trades.append(trade)
        equity.append(capital)

    metrics = _compute_metrics(trades, equity, cfg)
    return {
        "trades":  trades,
        "equity":  equity,
        "metrics": metrics,
        "df":      df,
    }


def _close_trade(trade: Trade, idx: int, price: float, reason: str, cfg: ARBMConfig):
    trade.exit_idx   = idx
    trade.exit_price = price
    trade.exit_reason = reason
    raw_pnl = (price - trade.entry_price) / trade.entry_price * trade.direction
    trade.pnl_pct = raw_pnl - 2 * cfg.fee_pct


def _apply_pnl(capital: float, trade: Trade, cfg: ARBMConfig) -> float:
    return capital * (1 + trade.pnl_pct)


def _compute_metrics(trades: list, equity: list, cfg: ARBMConfig) -> dict:
    if not trades:
        return {}

    pnls = [t.pnl_pct for t in trades]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]

    total_ret  = (equity[-1] - cfg.initial_capital) / cfg.initial_capital * 100
    win_rate   = len(wins) / len(pnls) * 100 if pnls else 0

    arr = np.array(pnls)
    avg  = arr.mean() if len(arr) > 0 else 0
    std  = arr.std(ddof=1) if len(arr) > 1 else 1e-9
    # Simplified Sharpe matching Pine Script (no annualization, no risk-free rate)
    sharpe_raw = avg / std if std > 0 else 0

    # Proper annualized Sharpe (daily returns from equity curve)
    eq = np.array(equity, dtype=float)
    daily_rets = np.diff(eq) / eq[:-1]
    ann_sharpe = 0.0
    if len(daily_rets) > 1 and daily_rets.std() > 0:
        ann_sharpe = (daily_rets.mean() * 252 - 0.05) / (daily_rets.std() * np.sqrt(252))

    # Max drawdown
    peak = np.maximum.accumulate(eq)
    dd   = (eq - peak) / peak * 100
    max_dd = dd.min()

    # Profit factor
    gross_profit = sum(p for p in pnls if p > 0)
    gross_loss   = abs(sum(p for p in pnls if p < 0))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')

    # Sortino
    neg = daily_rets[daily_rets < 0]
    sortino = 0.0
    if len(neg) > 0 and neg.std() > 0:
        sortino = (daily_rets.mean() * 252 - 0.05) / (neg.std() * np.sqrt(252))

    return {
        "total_trades":   len(trades),
        "win_trades":     len(wins),
        "win_rate":       round(win_rate, 2),
        "total_return":   round(total_ret, 4),
        "sharpe_raw":     round(sharpe_raw, 4),
        "sharpe_annualized": round(ann_sharpe, 4),
        "sortino":        round(sortino, 4),
        "max_drawdown":   round(max_dd, 4),
        "profit_factor":  round(profit_factor, 4),
        "avg_pnl_pct":    round(avg * 100, 4),
        "equity_curve":   equity,
    }
