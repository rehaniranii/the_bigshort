"""
Confidence-Based Position Sizing & Signal Generation — REGIME-X

Combines ML probability, ARBM breakout signal, and regime risk factor
into a final position signal in [-1.0, +1.0].
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass


@dataclass
class SignalConfig:
    # Weights for composite signal (must sum to 1.0)
    ml_weight:      float = 0.45   # ML model probability contribution
    arbm_weight:    float = 0.35   # ARBM breakout signal contribution
    regime_weight:  float = 0.20   # Regime risk scalar contribution

    # Position limits
    max_position:   float = 1.0    # maximum absolute position
    min_confidence: float = 0.10   # minimum confidence to take any position

    # Regime position caps
    regime_caps: dict = None

    def __post_init__(self):
        if self.regime_caps is None:
            self.regime_caps = {
                0: 1.0,   # LOW_VOL — full position allowed
                1: 1.0,   # NORMAL
                2: 0.5,   # HIGH_VOL — halved
                3: 0.1,   # EXTREME — minimal
            }


def compute_position_signal(
    ml_prob_up: float,
    arbm_signal: int,       # +1 = bull breakout, -1 = bear, 0 = neutral
    regime: int,
    regime_vol_pct: float,  # 0-100 percentile
    cfg: SignalConfig = None,
) -> dict:
    """
    Compute composite position signal from [-1.0, +1.0].

    Process:
    1. ML score: convert probability to centered score [-1, +1]
    2. ARBM score: +1 / -1 / 0 (discrete)
    3. Regime risk scalar: reduces position in volatile regimes
    4. Composite: weighted sum, capped by regime limit
    5. If |composite| < min_confidence threshold, return 0

    Note: A 75% ML probability does NOT mean 75% position.
    Position is scaled by regime risk and ARBM confirmation.
    """
    if cfg is None:
        cfg = SignalConfig()

    # ── 1. ML score ───────────────────────────────────────────────────────
    # Map [0, 1] → [-1, +1] centered at 0.5
    ml_score = (ml_prob_up - 0.5) * 2.0  # -1 to +1

    # ── 2. ARBM signal score ──────────────────────────────────────────────
    arbm_score = float(np.clip(arbm_signal, -1, 1))

    # ── 3. Regime risk scalar ─────────────────────────────────────────────
    # Linearly reduce position confidence as vol percentile rises
    regime_cap = cfg.regime_caps.get(regime, 1.0)

    # Additional smooth scaling by vol percentile (50th = 1.0, 95th = 0.3)
    vol_scalar = max(0.1, 1.0 - (regime_vol_pct - 50) / 100.0 * 1.4)
    regime_score = regime_cap * vol_scalar

    # ── 4. Composite weighted signal ──────────────────────────────────────
    composite = (
        cfg.ml_weight    * ml_score +
        cfg.arbm_weight  * arbm_score +
        cfg.regime_weight * (regime_score if ml_score > 0 else -regime_score)
    )

    # Apply regime cap
    composite = np.clip(composite, -regime_cap, regime_cap)

    # ── 5. Minimum confidence threshold ──────────────────────────────────
    if abs(composite) < cfg.min_confidence:
        composite = 0.0
        reason = "Below minimum confidence threshold"
    elif regime == 3:
        reason = "EXTREME regime — minimal exposure only"
    elif arbm_signal == 0 and abs(ml_score) < 0.3:
        composite *= 0.5
        reason = "No ARBM confirmation — reduced position"
    else:
        reason = f"ML={ml_score:.2f}, ARBM={arbm_signal}, Regime cap={regime_cap:.1f}"

    # Final clip
    final_position = float(np.clip(composite, -cfg.max_position, cfg.max_position))

    return {
        "position":      round(final_position, 4),
        "ml_score":      round(ml_score, 4),
        "arbm_score":    round(arbm_score, 4),
        "regime_score":  round(regime_score, 4),
        "regime_cap":    regime_cap,
        "composite_raw": round(composite, 4),
        "reason":        reason,
        "direction":     "LONG" if final_position > 0 else ("SHORT" if final_position < 0 else "NEUTRAL"),
    }


def compute_signal_series(
    df: pd.DataFrame,
    ml_proba: np.ndarray,
    cfg: SignalConfig = None,
) -> pd.DataFrame:
    """
    Compute signal for every row in df with available ML proba.
    df must have columns: bull_trigger, bear_trigger, regime, vol_percentile
    ml_proba: aligned array of P(UP) for each row in df
    """
    if cfg is None:
        cfg = SignalConfig()

    signals = []
    for i in range(len(df)):
        row = df.iloc[i]
        prob = float(ml_proba[i]) if i < len(ml_proba) else 0.5

        if row.get('bull_trigger', False):
            arbm_sig = 1
        elif row.get('bear_trigger', False):
            arbm_sig = -1
        else:
            arbm_sig = 0

        regime   = int(row.get('regime', 1))
        vol_pct  = float(row.get('vol_percentile', 50))

        sig = compute_position_signal(prob, arbm_sig, regime, vol_pct, cfg)
        signals.append(sig['position'])

    df = df.copy()
    df['signal'] = signals
    return df


def hybrid_backtest_strategy(
    df: pd.DataFrame,
    ml_proba: np.ndarray,
    arbm_cfg,      # ARBMConfig
    signal_cfg: SignalConfig = None,
    initial_capital: float = 100_000,
    fee_pct: float = 0.001,
) -> dict:
    """
    Hybrid strategy backtest:
    - Position sizing driven by composite signal
    - Trades entered at next-bar open
    - Daily mark-to-market PnL

    Returns equity curve and performance metrics.
    """
    if signal_cfg is None:
        signal_cfg = SignalConfig()

    df = compute_signal_series(df, ml_proba, signal_cfg)
    df = df.reset_index(drop=True)

    capital  = float(initial_capital)
    equity   = [capital]
    positions_log = []

    current_position = 0.0  # fraction of capital

    for i in range(1, len(df)):
        row  = df.iloc[i]
        prev = df.iloc[i - 1]

        # Signal was generated at close[i-1], execute position rebalance at open[i]
        target_position = float(prev.get('signal', 0.0))

        # Cost of position change at open[i]
        pos_change = abs(target_position - current_position)
        transaction_cost = pos_change * fee_pct

        # Realistic mark-to-market PnL:
        # 1. Overnight return between close[i-1] and open[i] held with current_position
        overnight_ret = (row['open'] - prev['close']) / prev['close']
        # 2. Intraday return between open[i] and close[i] held with new target_position
        intraday_ret = (row['close'] - row['open']) / row['open']

        pnl = current_position * overnight_ret + target_position * intraday_ret - transaction_cost

        capital = capital * (1 + pnl)
        current_position = target_position
        equity.append(capital)

        positions_log.append({
            "date":     df.index[i] if hasattr(df.index[i], 'strftime') else i,
            "position": round(target_position, 4),
            "bar_ret":  round((row['close'] - prev['close']) / prev['close'] * 100, 4),
            "pnl":      round(pnl * 100, 4),
            "equity":   round(capital, 2),
        })

    metrics = _equity_to_metrics(equity, initial_capital)
    return {
        "equity":       equity,
        "positions":    positions_log,
        "metrics":      metrics,
    }


def ml_only_backtest_strategy(
    df: pd.DataFrame,
    ml_proba: np.ndarray,
    initial_capital: float = 100_000,
    fee_pct: float = 0.001,
) -> dict:
    """
    ML-only strategy backtest:
    - Position is purely based on ML directional probability
    - Signal mapped from [0, 1] to [-1, 1]
    - Realistic execution at open[i] with overnight and intraday MTM
    """
    df = df.reset_index(drop=True)
    capital = float(initial_capital)
    equity = [capital]
    positions_log = []
    current_position = 0.0

    # Build ML-only signals (prob_up mapped to position)
    signals = []
    for i in range(len(df)):
        prob = float(ml_proba[i]) if i < len(ml_proba) else 0.5
        score = (prob - 0.5) * 2.0
        pos = 0.0 if abs(score) < 0.10 else float(np.clip(score, -1.0, 1.0))
        signals.append(pos)

    for i in range(1, len(df)):
        row = df.iloc[i]
        prev = df.iloc[i - 1]

        target_position = signals[i - 1]
        pos_change = abs(target_position - current_position)
        transaction_cost = pos_change * fee_pct

        overnight_ret = (row['open'] - prev['close']) / prev['close']
        intraday_ret = (row['close'] - row['open']) / row['open']

        pnl = current_position * overnight_ret + target_position * intraday_ret - transaction_cost

        capital = capital * (1 + pnl)
        current_position = target_position
        equity.append(capital)

        positions_log.append({
            "date":     df.index[i] if hasattr(df.index[i], 'strftime') else i,
            "position": round(target_position, 4),
            "pnl":      round(pnl * 100, 4),
            "equity":   round(capital, 2),
        })

    metrics = _equity_to_metrics(equity, initial_capital)
    return {
        "equity":    equity,
        "positions": positions_log,
        "metrics":   metrics,
    }


def _equity_to_metrics(equity: list, initial_capital: float) -> dict:
    eq = np.array(equity, dtype=float)
    daily_rets = np.diff(eq) / eq[:-1]

    total_ret = (eq[-1] - initial_capital) / initial_capital * 100
    if len(daily_rets) < 2:
        return {"total_return": round(total_ret, 4)}

    ann_ret   = ((1 + total_ret / 100) ** (252 / len(daily_rets)) - 1) * 100
    ann_std   = daily_rets.std() * np.sqrt(252) * 100
    ann_sharpe = (daily_rets.mean() * 252 - 0.05) / (daily_rets.std() * np.sqrt(252) + 1e-9)

    neg = daily_rets[daily_rets < 0]
    sortino = (daily_rets.mean() * 252 - 0.05) / (neg.std() * np.sqrt(252) + 1e-9) if len(neg) > 0 else 0

    peak   = np.maximum.accumulate(eq)
    dd     = (eq - peak) / peak * 100
    max_dd = dd.min()

    return {
        "total_return":     round(total_ret, 4),
        "annualized_return": round(ann_ret, 4),
        "annualized_vol":   round(ann_std, 4),
        "sharpe":           round(ann_sharpe, 4),
        "sortino":          round(sortino, 4),
        "max_drawdown":     round(max_dd, 4),
    }
