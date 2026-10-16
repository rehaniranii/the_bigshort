"""
Feature Engineering Pipeline — REGIME-X
Combines ARBM indicators with standard technical indicators for ML.
"""

import numpy as np
import pandas as pd
from typing import Optional


def compute_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs   = gain / (loss + 1e-9)
    return 100 - 100 / (1 + rs)


def compute_macd(close: pd.Series, fast=12, slow=26, signal=9) -> pd.DataFrame:
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return pd.DataFrame({
        'macd': macd_line,
        'macd_signal': signal_line,
        'macd_hist': histogram,
    })


def compute_bollinger(close: pd.Series, period=20, num_std=2.0) -> pd.DataFrame:
    sma = close.rolling(period).mean()
    std = close.rolling(period).std(ddof=0)
    upper = sma + num_std * std
    lower = sma - num_std * std
    width = (upper - lower) / (sma + 1e-9)
    pct_b = (close - lower) / (upper - lower + 1e-9)
    return pd.DataFrame({
        'bb_upper': upper, 'bb_lower': lower, 'bb_mid': sma,
        'bb_width': width, 'bb_pct_b': pct_b,
    })


def build_feature_matrix(df: pd.DataFrame, horizon: int = 1) -> pd.DataFrame:
    """
    Constructs ML feature matrix from OHLCV + ARBM indicators.
    All features are shifted to avoid lookahead:
    - Signal is generated at bar close
    - Features use information available AT close

    Target: 1 if close[t+horizon] > close[t], else 0

    df must already have ARBM columns from compute_regression_features()
    and regime columns from detect_regimes().
    """
    df = df.copy()
    close = df['close']
    volume = df.get('volume', pd.Series(np.nan, index=df.index))

    # ── Returns ───────────────────────────────────────────────────────────
    df['ret_1d']  = close.pct_change(1)
    df['ret_3d']  = close.pct_change(3)
    df['ret_5d']  = close.pct_change(5)
    df['ret_10d'] = close.pct_change(10)
    df['ret_20d'] = close.pct_change(20)

    # Lagged returns
    for lag in [1, 2, 3, 5]:
        df[f'ret_lag_{lag}'] = df['ret_1d'].shift(lag)

    # ── Moving Averages ────────────────────────────────────────────────────
    for w in [5, 10, 20, 50]:
        df[f'sma_{w}'] = close.rolling(w).mean()
        df[f'ema_{w}'] = close.ewm(span=w, adjust=False).mean()

    # Price relative to moving averages (normalized)
    for w in [10, 20, 50]:
        df[f'price_vs_sma_{w}'] = (close - df[f'sma_{w}']) / (df[f'sma_{w}'] + 1e-9)
        df[f'price_vs_ema_{w}'] = (close - df[f'ema_{w}']) / (df[f'ema_{w}'] + 1e-9)

    # ── Oscillators ────────────────────────────────────────────────────────
    df['rsi_14'] = compute_rsi(close, 14)
    df['rsi_7']  = compute_rsi(close, 7)

    macd = compute_macd(close)
    df['macd']        = macd['macd'] / (close + 1e-9)
    df['macd_signal'] = macd['macd_signal'] / (close + 1e-9)
    df['macd_hist']   = macd['macd_hist'] / (close + 1e-9)

    bb = compute_bollinger(close)
    df['bb_width'] = bb['bb_width']
    df['bb_pct_b'] = bb['bb_pct_b']

    # ── Volatility ─────────────────────────────────────────────────────────
    df['vol_5d']  = df['ret_1d'].rolling(5).std()
    df['vol_10d'] = df['ret_1d'].rolling(10).std()
    df['vol_20d'] = df['ret_1d'].rolling(20).std()
    df['vol_ratio'] = df['vol_5d'] / (df['vol_20d'] + 1e-9)  # vol of vol ratio

    # ── Volume ────────────────────────────────────────────────────────────
    if not volume.isna().all():
        df['vol_change'] = volume.pct_change(1)
        df['vol_vs_avg'] = volume / (volume.rolling(20).mean() + 1e-9)
    else:
        df['vol_change'] = 0.0
        df['vol_vs_avg'] = 1.0

    # ── ARBM-derived features ─────────────────────────────────────────────
    if 'reg_basis' in df.columns:
        df['price_vs_reg']   = (close - df['reg_basis']) / (df['reg_basis'] + 1e-9)
        df['price_vs_upper'] = (close - df['upper_band']) / (df['upper_band'] + 1e-9)
        df['price_vs_lower'] = (close - df['lower_band']) / (close + 1e-9)
        df['reg_slope_feat'] = df.get('reg_slope', pd.Series(0, index=df.index))
        df['width_pct_feat'] = df.get('width_pct', pd.Series(50, index=df.index))
        df['is_squeeze_feat'] = df.get('is_squeeze', pd.Series(False, index=df.index)).astype(float)
        df['bull_trigger_feat'] = df.get('bull_trigger', pd.Series(False, index=df.index)).astype(float)
        df['bear_trigger_feat'] = df.get('bear_trigger', pd.Series(False, index=df.index)).astype(float)

    # ── Regime features ────────────────────────────────────────────────────
    if 'regime' in df.columns:
        df['regime_feat'] = df['regime'].astype(float)
        df['vol_pct_feat'] = df.get('vol_percentile', pd.Series(50, index=df.index))

    # ── Target variable ───────────────────────────────────────────────────
    future_close = close.shift(-horizon)
    df['target'] = np.where(future_close.isna(), np.nan, (future_close > close).astype(float))

    return df


def get_feature_columns() -> list:
    """Returns the ordered list of feature column names used for ML."""
    return [
        # Returns
        'ret_1d', 'ret_3d', 'ret_5d', 'ret_10d', 'ret_20d',
        'ret_lag_1', 'ret_lag_2', 'ret_lag_3', 'ret_lag_5',
        # MA relative
        'price_vs_sma_10', 'price_vs_sma_20', 'price_vs_sma_50',
        'price_vs_ema_10', 'price_vs_ema_20', 'price_vs_ema_50',
        # Oscillators
        'rsi_14', 'rsi_7', 'macd', 'macd_signal', 'macd_hist',
        'bb_width', 'bb_pct_b',
        # Volatility
        'vol_5d', 'vol_10d', 'vol_20d', 'vol_ratio',
        # Volume
        'vol_change', 'vol_vs_avg',
        # ARBM
        'price_vs_reg', 'price_vs_upper', 'price_vs_lower',
        'reg_slope_feat', 'width_pct_feat', 'is_squeeze_feat',
        'bull_trigger_feat', 'bear_trigger_feat',
        # Regime
        'regime_feat', 'vol_pct_feat',
    ]
