"""
REGIME-X | Round 1 Submission Generator
Generates submission CSV matching bigshort.in Round 1 specifications:
- Exactly 50 rows (timestamps 801 to 850)
- Format: timestamp,prediction,confidence
- Target saved to Desktop
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
import lightgbm as lgb
import warnings

warnings.filterwarnings('ignore')

def generate_submission():
    dataset_path = Path("/Users/ronakshah07/dz/round1_dataset.csv")
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found at {dataset_path}")

    print(f"Loading dataset from {dataset_path}...")
    df = pd.read_csv(dataset_path)

    # ── Feature Engineering (Stationary Features Only) ──────────────────────
    open_  = df['open']
    high   = df['high']
    low    = df['low']
    vol    = df['volume']
    rsi    = df['rsi_14']
    of     = df['order_flow']
    vol_20 = df['volatility_20']
    vz     = df['volume_z_20']

    feats = pd.DataFrame(index=df.index)

    # 1. Price structure & shadow ratios
    feats['hl_ratio']      = (high - low) / open_
    feats['ho_ratio']      = (high - open_) / open_
    feats['ol_ratio']      = (open_ - low) / open_
    feats['high_low_skew'] = (high - open_) / (open_ - low + 1e-6)

    # 2. Normalized Base Indicators
    feats['rsi_14']        = rsi
    feats['order_flow']    = of
    feats['volatility_20'] = vol_20
    feats['volume_z_20']   = vz

    # 3. Multi-period Open Returns
    for lag in [1, 2, 3, 5, 10]:
        feats[f'open_ret_{lag}'] = open_.pct_change(lag)

    # 4. Moving Average Trend Relative to Open
    for w in [5, 10, 20, 50]:
        feats[f'open_vs_sma_{w}'] = (open_ - open_.rolling(w).mean()) / open_
        feats[f'open_vs_ema_{w}'] = (open_ - open_.ewm(span=w).mean()) / open_

    # 5. Oscillator Momentum Dynamics
    feats['rsi_diff_1']  = rsi.diff(1)
    feats['rsi_diff_3']  = rsi.diff(3)
    feats['rsi_diff_5']  = rsi.diff(5)
    feats['rsi_vs_ma14'] = rsi - rsi.rolling(14).mean()

    # 6. Order Flow Persistence & Interaction
    feats['of_lag1']           = of.shift(1)
    feats['of_lag2']           = of.shift(2)
    feats['of_diff1']          = of.diff(1)
    feats['of_ma5']            = of.rolling(5).mean()
    feats['of_vz_interaction'] = of * vz

    # 7. Volatility & Volume Shifts
    feats['vol_ratio']       = vol_20 / (vol_20.rolling(20).mean() + 1e-6)
    feats['vol_change_5d']   = vol_20.pct_change(5)
    feats['volume_change']   = vol.pct_change(1)
    feats['volume_vs_avg20'] = vol / (vol.rolling(20).mean() + 1e-6)

    # Separate training (1-800) and test (801-850)
    train_mask = df['timestamp'] <= 800
    test_mask  = (df['timestamp'] >= 801) & (df['timestamp'] <= 850)

    X_train_full = feats[train_mask]
    y_train_full = df.loc[train_mask, 'target']

    X_test = feats[test_mask]
    test_timestamps = df.loc[test_mask, 'timestamp'].astype(int)

    # Drop warm-up rows (first 50) where rolling features contain NaN
    valid_train = ~X_train_full.isna().any(axis=1)
    X_train = X_train_full[valid_train]
    y_train = y_train_full[valid_train]

    print(f"Training samples: {len(X_train)} (rows {X_train.index[0]+1} to 800)")
    print(f"Test samples: {len(X_test)} (rows 801 to 850)")

    # ── Train Multi-Model Quantitative Ensemble ─────────────────────────────
    # Model 1: L2-Regularized Logistic Regression (Standardized)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled  = scaler.transform(X_test)

    model_lr = LogisticRegression(C=0.10, max_iter=1000, random_state=42)
    model_lr.fit(X_train_scaled, y_train)
    prob_lr = model_lr.predict_proba(X_test_scaled)[:, 1]

    # Model 2: HistGradientBoosting (Depth-constrained)
    model_hgb = HistGradientBoostingClassifier(
        max_iter=80, max_depth=3, learning_rate=0.03, min_samples_leaf=15, random_state=42
    )
    model_hgb.fit(X_train, y_train)
    prob_hgb = model_hgb.predict_proba(X_test)[:, 1]

    # Model 3: LightGBM (Regularized with subsampling)
    model_lgb = lgb.LGBMClassifier(
        n_estimators=80, max_depth=3, learning_rate=0.03, num_leaves=7,
        min_child_samples=15, colsample_bytree=0.8, subsample=0.8,
        random_state=42, verbose=-1
    )
    model_lgb.fit(X_train, y_train)
    prob_lgb = model_lgb.predict_proba(X_test)[:, 1]

    # Ensemble Weighted Probability
    prob_up = 0.50 * prob_lr + 0.30 * prob_hgb + 0.20 * prob_lgb

    # Derive discrete prediction (0 or 1) and confidence score [0.5, 1.0]
    predictions = (prob_up >= 0.50).astype(int)
    confidences = np.where(predictions == 1, prob_up, 1.0 - prob_up)
    confidences = np.round(confidences, 4)

    # ── Construct Submission DataFrame ──────────────────────────────────────
    submission_df = pd.DataFrame({
        'timestamp':  test_timestamps.values,
        'prediction': predictions,
        'confidence': confidences,
    })

    # Strict Validation Checks
    assert len(submission_df) == 50, f"Expected 50 rows, got {len(submission_df)}"
    assert list(submission_df.columns) == ['timestamp', 'prediction', 'confidence'], f"Invalid columns: {submission_df.columns}"
    assert submission_df['timestamp'].iloc[0] == 801, f"First timestamp is {submission_df['timestamp'].iloc[0]}"
    assert submission_df['timestamp'].iloc[-1] == 850, f"Last timestamp is {submission_df['timestamp'].iloc[-1]}"
    assert set(submission_df['prediction'].unique()).issubset({0, 1}), "Predictions must only be 0 or 1"
    assert (submission_df['confidence'] >= 0.0).all() and (submission_df['confidence'] <= 1.0).all(), "Confidences must be in [0.0, 1.0]"
    assert not submission_df.isna().any().any(), "Submission contains null values!"

    # ── Save Target Files ───────────────────────────────────────────────────
    desktop_dir = Path("/Users/ronakshah07/Desktop")
    desktop_csv1 = desktop_dir / "round_1_submission.csv"
    desktop_csv2 = desktop_dir / "round1_predictions.csv"
    workspace_csv = Path("/Users/ronakshah07/dz/round_1_submission.csv")

    submission_df.to_csv(desktop_csv1, index=False)
    submission_df.to_csv(desktop_csv2, index=False)
    submission_df.to_csv(workspace_csv, index=False)

    print("\n" + "=" * 60)
    print("ROUND 1 SUBMISSION GENERATED SUCCESSFULLY!")
    print("=" * 60)
    print(f"File saved to Desktop: {desktop_csv1}")
    print(f"File saved to Desktop: {desktop_csv2}")
    print(f"File saved to Workspace: {workspace_csv}")
    print(f"Row count: {len(submission_df)} rows (timestamps 801 to 850)")
    print(f"Class Distribution: UP (1) = {(predictions == 1).sum()} | DOWN (0) = {(predictions == 0).sum()}")
    print(f"Mean Confidence: {confidences.mean():.4f} (Min: {confidences.min():.4f}, Max: {confidences.max():.4f})")
    print("\nPreview (First 10 rows):")
    print(submission_df.head(10).to_string(index=False))
    print("\nPreview (Last 10 rows):")
    print(submission_df.tail(10).to_string(index=False))

if __name__ == "__main__":
    generate_submission()
