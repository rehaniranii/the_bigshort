"""
Market Regime Detection Engine — REGIME-X
Detects 4 market regimes using volatility and drawdown metrics.
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import Tuple


REGIME_LABELS = {
    0: "LOW_VOLATILITY",
    1: "NORMAL",
    2: "HIGH_VOLATILITY",
    3: "EXTREME_CRASH",
}

REGIME_COLORS = {
    0: "#10b981",   # emerald  — calm
    1: "#3b82f6",   # blue     — normal
    2: "#f59e0b",   # amber    — high vol
    3: "#ef4444",   # red      — extreme
}


@dataclass
class RegimeConfig:
    vol_window: int = 20         # rolling realized vol window (days)
    atr_window: int = 14         # ATR window
    shock_window: int = 5        # sudden shock lookback
    pct_low: float = 25.0        # vol percentile below which = LOW VOL
    pct_high: float = 75.0       # vol percentile above which = HIGH VOL
    pct_extreme: float = 95.0    # vol percentile above which = EXTREME
    dd_extreme_pct: float = -10.0  # drawdown % threshold for EXTREME confirmation
    shock_sigma: float = 3.0     # Z-score of return for shock detection


def compute_atr(df: pd.DataFrame, window: int = 14) -> pd.Series:
    high, low, close = df['high'], df['low'], df['close']
    tr = pd.concat([
        high - low,
        (high - close.shift(1)).abs(),
        (low  - close.shift(1)).abs(),
    ], axis=1).max(axis=1)
    return tr.rolling(window).mean()


def detect_regimes(df: pd.DataFrame, cfg: RegimeConfig = None) -> pd.DataFrame:
    """
    Assign a regime label (0-3) to every bar in df.

    Methodology:
    - Compute rolling realized volatility (annualized)
    - Compute historical percentiles on TRAINING data only
    - Classify each bar by its vol percentile
    - Upgrade to EXTREME if rolling drawdown is severe

    Returns df with columns: atr, atr_pct, realized_vol, vol_percentile, regime, regime_label
    """
    if cfg is None:
        cfg = RegimeConfig()

    df = df.copy()
    close = df['close']

    # Daily log returns
    log_ret = np.log(close / close.shift(1))

    # Realized volatility — annualized (252 trading days)
    realized_vol = log_ret.rolling(cfg.vol_window).std() * np.sqrt(252) * 100  # in %

    # ATR as % of price
    atr = compute_atr(df, cfg.atr_window)
    atr_pct = atr / close * 100

    # Rolling 20-day drawdown
    rolling_max  = close.rolling(cfg.vol_window).max()
    rolling_dd   = (close - rolling_max) / rolling_max * 100

    # Return shock: 5-day return vs historical distribution
    ret_5d = close.pct_change(cfg.shock_window) * 100
    ret_mean = ret_5d.rolling(252).mean()
    ret_std  = ret_5d.rolling(252).std()
    z_score  = (ret_5d - ret_mean) / (ret_std + 1e-9)

    # ── Percentile classification (calibrated on available history) ──────
    # We compute a ROLLING percentile to avoid future lookahead:
    # at each bar, percentile is computed on past 252 bars.
    vol_percentile = realized_vol.rolling(252, min_periods=cfg.vol_window).apply(
        lambda x: _percentile_rank(x), raw=True
    )

    # ── Regime assignment ─────────────────────────────────────────────────
    regime = pd.Series(1, index=df.index, dtype=int)  # default: NORMAL

    # LOW VOLATILITY
    regime[vol_percentile < cfg.pct_low] = 0

    # HIGH VOLATILITY
    regime[vol_percentile >= cfg.pct_high] = 2

    # EXTREME / CRASH — requires BOTH high vol AND severe drawdown OR shock
    is_extreme = (
        (vol_percentile >= cfg.pct_extreme) |
        (rolling_dd <= cfg.dd_extreme_pct) |
        (z_score <= -cfg.shock_sigma)
    )
    regime[is_extreme] = 3

    df['atr']           = atr
    df['atr_pct']       = atr_pct
    df['realized_vol']  = realized_vol
    df['vol_percentile'] = vol_percentile
    df['rolling_dd']    = rolling_dd
    df['return_zscore'] = z_score
    df['regime']        = regime
    df['regime_label']  = regime.map(REGIME_LABELS)
    df['regime_color']  = regime.map(REGIME_COLORS)

    return df


def _percentile_rank(arr: np.ndarray) -> float:
    """Return percentile rank of the last element within the array."""
    val = arr[-1]
    if np.isnan(val):
        return 50.0
    return float(np.sum(arr[:-1] < val) / max(len(arr) - 1, 1) * 100)


def get_regime_params(regime: int) -> dict:
    """
    Returns adaptive ARBM parameters based on current market regime.
    Used to modify regression window and risk buffers dynamically.
    """
    # Regime → ARBM parameter adjustments
    params = {
        0: {  # LOW_VOLATILITY — longer regression, tighter dev
            "length": 70,
            "dev_mult": 1.5,
            "sqz_pct": 25.0,
            "position_scale": 1.0,
        },
        1: {  # NORMAL — standard params
            "length": 50,
            "dev_mult": 2.0,
            "sqz_pct": 20.0,
            "position_scale": 1.0,
        },
        2: {  # HIGH_VOLATILITY — shorter regression, wider dev
            "length": 35,
            "dev_mult": 2.5,
            "sqz_pct": 15.0,
            "position_scale": 0.5,
        },
        3: {  # EXTREME — minimal exposure
            "length": 20,
            "dev_mult": 3.0,
            "sqz_pct": 10.0,
            "position_scale": 0.1,
        },
    }
    return params.get(regime, params[1])


def get_stress_periods() -> list:
    """Returns known historical stress periods for stress testing."""
    return [
        {
            "name": "COVID-19 Crash",
            "start": "2020-02-15",
            "end": "2020-04-01",
            "description": "Global pandemic selloff — S&P500 fell ~34% in 5 weeks",
        },
        {
            "name": "2022 Rate Hike Selloff",
            "start": "2022-01-01",
            "end": "2022-10-15",
            "description": "Fed rate hike cycle — Nasdaq fell ~33%",
        },
        {
            "name": "2018 Q4 Correction",
            "start": "2018-10-01",
            "end": "2018-12-26",
            "description": "Fed tightening + trade war fears — S&P500 fell ~20%",
        },
        {
            "name": "2020 Recovery Rally",
            "start": "2020-04-01",
            "end": "2020-08-31",
            "description": "Post-COVID recovery — rapid mean-reversion rally",
        },
    ]
