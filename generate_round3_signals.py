"""
KESTREL_EM round 3 signal generator: causal, regime-aware, vol-targeted.

Signal at timestamp t uses ONLY rows <= t-1.
  - Rows 851-900 have no `close`. A row's close is recovered from that same row's
    high/low/order_flow (order_flow = (2*close - high - low)/(high - low), verified
    on rows 1-850). Row t-1's close is known at the close of t-1, so it is a valid input
    for the signal at t. Row t's own fields are never used for the signal at t.
  - Every feature is computed from the close series and then shifted by 1 bar before use.
  - Rolling and EWM windows only look backward. Nothing is fit on rows 851-900.

Usage: python generate_round3_signals.py [dataset.csv] [out.csv]
"""
import sys
import numpy as np
import pandas as pd

# Parameters. These are round, middle-of-the-range values, not tuned to the test window.
TV_NORMAL = 0.006   # daily vol target in calm regime
TV_CRISIS = 0.015   # daily vol target in crisis regime
CAP_CRISIS = 0.5    # max |position| in crisis
SHOCK_K = 2.5       # vol5 > K * baseline vol  -> crisis
HOLD = 15           # bars to stay in crisis mode after a trigger
A_UP = 0.3          # smoothing speed when adding risk (slow, saves costs)
A_DN = 0.8          # smoothing speed when cutting risk / flipping (fast, protects drawdown)


def build_close(df):
    rec = 0.5 * (df.order_flow * (df.high - df.low) + df.high + df.low)
    known = df.close.notna()
    err = (rec[known] - df.close[known]).abs().max()
    assert err < 0.01, f"close reconstruction failed (max err {err})"
    return df.close.fillna(rec)


def target_positions(df, c):
    r = c.pct_change()
    vol20 = r.rolling(20).std()
    vol5 = r.rolling(5).std()
    base = vol20.rolling(120, min_periods=30).median()
    dd60 = c / c.rolling(60, min_periods=1).max() - 1
    sma30 = c.rolling(30).mean()

    trigger = (vol5 > SHOCK_K * base) | (dd60 < -0.12) | (r.abs() > 4 * base)
    crisis = trigger.astype(float).rolling(HOLD, min_periods=1).max().astype(bool)
    vol = np.maximum(vol20, vol5)

    # Calm regime: slow EMA trend, vol-targeted (train returns have positive autocorrelation).
    trend = np.sign(c.ewm(span=10).mean() - c.ewm(span=30).mean())
    normal = trend * np.minimum(TV_NORMAL / vol, 1.0)
    # Crisis regime: short only while price is below its 30d mean, otherwise flat. Small, vol-scaled size.
    bear = np.where(c < sma30, -1.0, 0.0)
    cris = bear * np.minimum(TV_CRISIS / vol, CAP_CRISIS)

    tgt = pd.Series(np.where(crisis, cris, normal), index=df.index).fillna(0.0)
    return tgt.shift(1).fillna(0.0)  # computed at the close of t-1, held during t


def smooth(tgt):
    out, p = np.zeros(len(tgt)), 0.0
    for i, t in enumerate(tgt):
        derisk = abs(t) < abs(p) or np.sign(t) != np.sign(p)
        p += (A_DN if derisk else A_UP) * (t - p)
        out[i] = p
    return np.clip(out, -1.0, 1.0)


def main(path="round2_dataset.csv", out="round_3_submission.csv"):
    df = pd.read_csv(path).sort_values("timestamp").reset_index(drop=True)
    c = build_close(df)
    pos = pd.Series(smooth(target_positions(df, c).values), index=df.index)

    # Look-ahead check: rebuild each test signal with all rows >= t removed. It must match exactly.
    for t in range(851, 901):
        hist = df[df.timestamp < t].copy()
        stub = df[df.timestamp == t].copy()
        stub[["open", "high", "low", "close", "volume", "order_flow"]] = np.nan
        trunc = pd.concat([hist, stub]).reset_index(drop=True)
        tc = trunc.close.copy()
        tc.iloc[:-1] = build_close(trunc.iloc[:-1]).values
        p_t = smooth(target_positions(trunc, tc).values)[-1]
        assert abs(p_t - pos[df.timestamp == t].iloc[0]) < 1e-12, f"look-ahead at t={t}"

    sub = pd.DataFrame({"timestamp": df.timestamp, "signal": pos.round(4)})
    sub = sub[(sub.timestamp >= 851) & (sub.timestamp <= 900)]
    assert len(sub) == 50 and sub.timestamp.tolist() == list(range(851, 901))
    assert sub.signal.between(-1, 1).all() and sub.signal.notna().all()
    sub.to_csv(out, index=False)
    print(f"wrote {out}  (no-look-ahead check passed for all 50 bars)")
    return df, c, pos


if __name__ == "__main__":
    main(*sys.argv[1:])
