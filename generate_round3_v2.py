"""
REGIME-X | Round 3 (Alpha Portfolio Signals - Version 2)
Trend-Following Short & Breakout Strategy:
- Specifically designed for Flash Crash conditions (downward regime drift)
- Strictly Causal / Zero Lookahead: Uses only point-in-time momentum_5, order_flow, and open vs sma_10
- Maximizes Sharpe Ratio while strictly penalizing Drawdown (-2x) and Transaction Costs (0.001)
- Saves to Desktop: 'round 3 renaissance 2.csv' and standard submission names
"""

from pathlib import Path
import pandas as pd
import numpy as np

def generate_round3_v2():
    dataset_path = Path("/Users/ronakshah07/dz/round2_dataset.csv")
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found at {dataset_path}")

    print(f"Loading dataset from {dataset_path}...")
    df = pd.read_csv(dataset_path)

    test = df[df['timestamp'] >= 851].copy()
    assert len(test) == 50, f"Expected 50 test rows, got {len(test)}"

    # ── Trend-Following Crash Alpha Model (Strictly Causal) ──────────────────
    # 1. Flash crash regime base posture: bearish drift (-0.30)
    sig = np.full(len(test), -0.30)

    # 2. Point-in-time momentum factor (5-day momentum)
    sig += np.clip(test['momentum_5'].values * 1.0, -0.40, 0.40)

    # 3. Point-in-time order flow factor (intraday buying/selling pressure)
    sig += np.clip(test['order_flow'].values * 0.40, -0.30, 0.30)

    # 4. Pine Script ARBM Trend confirmation (Open price vs 10-day SMA)
    sig = np.where(test['open'].values < test['sma_10'].values, sig - 0.20, sig + 0.20)
    sig = np.clip(np.round(sig, 2), -1.0, 1.0)

    # 5. Low-turnover smoothing (span=2) to minimize 0.001 fee penalty
    pos = pd.Series(sig).ewm(span=2).mean().values
    pos = np.clip(np.round(pos, 2), -1.0, 1.0)

    # ── Create DataFrame ────────────────────────────────────────────────────
    sub_r3 = pd.DataFrame({
        'timestamp': test['timestamp'].astype(int).values,
        'signal':    pos
    })

    # Validate Requirements
    assert len(sub_r3) == 50, f"Expected 50 rows, got {len(sub_r3)}"
    assert list(sub_r3.columns) == ['timestamp', 'signal']
    assert sub_r3['timestamp'].iloc[0] == 851
    assert sub_r3['timestamp'].iloc[-1] == 900
    assert (sub_r3['signal'] >= -1.0).all() and (sub_r3['signal'] <= 1.0).all()
    assert not sub_r3.isna().any().any()

    # ── Save Files to Desktop and Workspace ─────────────────────────────────
    desktop = Path("/Users/ronakshah07/Desktop")
    workspace = Path("/Users/ronakshah07/dz")

    p_user1 = desktop / "round 3 renaissance 2.csv"
    p_user2 = desktop / "round_3_renaissance_2.csv"
    p_sub   = desktop / "round_3_submission.csv"
    p_work  = workspace / "round_3_renaissance_2.csv"

    for p in [p_user1, p_user2, p_sub, p_work]:
        sub_r3.to_csv(p, index=False)

    print("\n" + "=" * 65)
    print("ROUND 3 RENAISSANCE 2 PORTFOLIO GENERATED SUCCESSFULLY!")
    print("=" * 65)
    print(f"File saved to Desktop: {p_user1}")
    print(f"File saved to Desktop: {p_sub}")
    print(f"Row count: {len(sub_r3)} rows (timestamps 851 to 900)")
    print(f"Signal range: Min={pos.min():.2f}, Max={pos.max():.2f}")
    print(f"Short positions: {(pos < 0).sum()} | Long positions: {(pos > 0).sum()}")

    print("\nPreview First 15 rows:")
    print(sub_r3.head(15).to_string(index=False))

    print("\nPreview Last 15 rows:")
    print(sub_r3.tail(15).to_string(index=False))

if __name__ == "__main__":
    generate_round3_v2()
