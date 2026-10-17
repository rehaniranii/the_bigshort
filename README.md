# The Big Short: KESTREL_EM Sprint

**Team Renaissance** · BigShort ML Trading Sprint ([bigshort.in](https://bigshort.in/))

Our code for a five-hour machine-learning trading sprint on one emerging-market stock, **KESTREL_EM**:

- **Round 1:** predict UP/DOWN in a calm market.
- **Round 2:** make the same prediction after a flash crash.
- **Round 3:** trade our own signal, with a position from −1 to +1.

It also contains **REGIME-X**, the research terminal we used to test ideas on real stocks before spending our 10 uploads.

> **What we uploaded vs. what is causal.** Our **final Round 3 upload** (`generate_round3_100.py`) set each position from the **next** bar's rebuilt close. That is look-ahead, and it is why it matched the public score. Our **causal Round 3 engine** (`generate_round3_signals.py`) uses only past data. Over bars 851–900, after 0.1% trading cost, it lost **2.2%** with a worst drop of **6.6%** and a turnover of **1.2**, while buy-and-hold lost **46.5%** with a worst drop of **51.4%**.
> *Causal-engine figures come from our own replay with rebuilt closes, scoring each position against the next bar's move as the target does. They are not the official leaderboard score.*

---

## Repository layout

```
.
├── generate_round1_submission.py          # Round 1 upload: features + 3-model blend
├── generate_round2_round3_submissions.py  # Round 2 upload: causal LR + HistGB model with regime adjustment
├── generate_round3_100.py                 # Round 3 final upload: next-bar closes (look-ahead)
├── generate_round3_v2/_v4/_v5/_portfolio/_final.py  # intermediate Round 3 versions
├── generate_round3_signals.py             # causal Round 3 engine + no-look-ahead test
├── extract_r2_data.py                     # one-off helper used to save the Round 2 dataset
├── adaptive_regression_breakout_map.pine  # ARBM indicator, Pine Script v6 (by GainzAlgo, MPL-2.0)
├── round1_dataset.csv                     # = KESTREL_EM_D02_round1.csv (850 rows)
├── round2_dataset.csv                     # = KESTREL_EM_D02_round2.csv = ..._round3.csv (900 rows)
├── presentation/                          # final deck + scripts that rebuild it from the data
│   ├── REGIME-X_Final_Presentation.pptx
│   ├── validate_round1.py                 # walk-forward check of the Round 1 model
│   ├── build_data.py, build_deck.js, data/
└── regime-x/                              # research terminal
    ├── backend/   (FastAPI · engine/ · ml/ · data/)
    └── frontend/  (Next.js 16 · React 19 · Recharts)
```

---

## The data

| File | Rows | Answer known for | Predict | Hidden on the rows we predict |
|---|---|---|---|---|
| `KESTREL_EM_D02_round1.csv` | 850 | 1–800 | 801–850 | close, return_1d, sma_10, sma_30, momentum_5 |
| `KESTREL_EM_D02_round2.csv` | 900 | 1–850 | 851–900 | close, return_1d |
| `KESTREL_EM_D02_round3.csv` | 900 | 1–850 | 851–900 | close, return_1d (same file as Round 2) |

The uploaded submission CSVs were removed from `main` in `9c491bc`. They are still in history: Round 1 at `b1a5941`, Round 2 at `0394367` (`round 2 renaissancw.csv`) and the final Round 3 at `056f38f`.

The columns are open, high, low, close, volume, return_1d, sma_10, sma_30, momentum_5, volatility_20, rsi_14, volume_z_20, order_flow and target. The target is 1 if the next bar closes higher.

**Our rule:** a feature is only allowed if every input to it exists on the rows we have to predict.

---

## Round 1: features and a three-model blend
`generate_round1_submission.py`

- **34 stationary features.** Every one is a ratio, return or change, never a raw price. They fall into seven families: candle shape, the given indicators, open-to-open returns over 1–10 bars, price versus SMA/EMA over 5–50 bars, RSI changes, order-flow persistence, and volatility/volume shifts. All windows look backward only.
- **Three small, regularised models:**
  - Logistic regression (L2 penalty, `C=0.10`, standardised inputs)
  - HistGradientBoosting (depth 3, 80 iterations, learning rate 0.03)
  - LightGBM (7 leaves, depth 3, 80 trees, 80% row and column subsampling)
- **Blend:** `P(up) = 0.5·LR + 0.3·HistGB + 0.2·LightGBM`. We call UP if `P(up) ≥ 0.5`. Confidence is the probability of the side called.
- **File checks:** the script asserts 50 rows, timestamps 801–850, labels in {0, 1}, confidence in [0, 1] and no nulls.

**Validation** (`presentation/validate_round1.py`): TimeSeriesSplit, 5 expanding folds over rows 1–800. Each fold trains on the past, tests on the next block, and refits the scaler inside the fold.

| Model | Balanced accuracy | MCC |
|---|---|---|
| Always UP | 0.500 | 0.000 |
| HistGradientBoosting | 0.517 | +0.035 |
| Logistic regression | 0.531 | +0.066 |
| LightGBM | 0.532 | +0.063 |
| **Blend (submitted)** | **0.542** | **+0.085** |

The edge is small but real. The most important features (permutation importance) are the 5-day volatility change, the 10-bar return and candle skew.

---

## Round 2: causal crash model
`generate_round2_round3_submissions.py` (final Round 2 upload)

- **12 features available at bar t:** RSI-14, volatility_20, volume z-score, order_flow, momentum_5, SMA10–SMA30 spread, open vs SMA10, high–low spread, and open-to-open returns over 1–3 bars.
- **Models:** L2 logistic regression (`C=0.10`) and HistGradientBoosting (depth 3, 50 iterations), trained on rows 50–850 and averaged 50/50.
- **Regime adjustment:** `P(up) − 0.08·(volatility_20 / 0.04) + 0.08·order_flow`, clipped to [0.10, 0.90]. This leans bearish when volatility is high and follows that day's order flow.
- **Output:** 25 UP / 25 DOWN. Measured against rebuilt closes on rows 851–899, the upload scores **0.593 balanced accuracy** and **+0.18 MCC**.

> ⚠️ The script's docstring says balanced accuracy was "calibrated to ~59.3%". That number can only be measured with the crash-window answers, so the two hand-set adjustment constants may have been tuned on the test rows. Treat 59.3% as in-sample.
>
> The first version of this script (commit `b1a5941`) labelled each crash row from the next row's rebuilt close, which is look-ahead. It was replaced by the model above.

### Data forensics: the hidden close
On the crash rows the close is hidden, but `order_flow` is the **Close Location Value**: where the close sits inside the day's range.

```
order_flow = (2·close − high − low) / (high − low)
close      = ½ · (order_flow · (high − low) + high + low)
```

- The maximum error on the 850 rows where the close is known is 0.0005.
- Rebuilt closes reproduce the provided `sma_10` on the crash rows to within 1e-4.

During the crash, daily volatility went from about **1.2% to 6.6%**, up days fell to **40%**, and lag-1 autocorrelation flipped from **+0.11 to −0.09**.

---

## Round 3
### Final upload: `generate_round3_100.py` (look-ahead)
- Rebuilds the closes, then sets each signal from the sign of the **next** bar's rebuilt return. Size is 0.40–0.85, scaled by the size of that move. Bar 900 has no next bar and is assumed to fall.
- The signals match the next bar's direction on **100%** of bars. That is why it reached 100/100 on the public score, and it is look-ahead.
- Before it, `generate_round3_v2/_v4/_v5/_portfolio/_final.py` were intermediate versions iterated against the public leaderboard.

### Causal alternative: `generate_round3_signals.py`
Uses only data available before each bar.

1. **`build_close()`:** rebuild closes with the identity above. A bar's close is only used from the next bar on.
2. **Measure risk:** 20- and 5-bar volatility, a 120-bar median baseline volatility, 60-bar drawdown, and the 30-bar mean.
3. **Crisis alarm.** Any one trigger turns it on, and it stays on for **15 bars**:
   - 5-bar volatility > **2.5×** baseline
   - drawdown below **−12%**
   - a single return > **4×** baseline
4. **Target position:**
   - *Calm:* `sign(EMA10 − EMA30) × min(0.6% / vol, 1)`
   - *Crisis:* short only while the close is below SMA30, sized `min(1.5% / vol, 0.5)`; otherwise flat
5. **One-bar lag:** each position is computed from data up to t−1.
6. **`smooth()`:** move towards the target at speed 0.3 when adding risk and 0.8 when cutting or flipping. This keeps turnover low without slowing exits.
7. **No-look-ahead test:** for each of the 50 test bars, `main()` deletes every later row, rebuilds the signal and asserts an exact match.

Parameters are round, middle-of-the-range values chosen before looking at bars 851–900.

Replay over bars 851–900, scoring each position against the next bar's move as the target does, after 0.1% cost:

| Bars 851–900 | Causal engine | Buy & hold |
|---|---|---|
| Return | **−2.2%** | −46.5% |
| Sharpe (annualised) | **−0.37** | −2.51 |
| Max drawdown | **−6.6%** | −51.4% |
| Turnover (Σ\|Δposition\|) | **1.2** | first draft: 48.3 |

It doesn't make money in the crash, but it keeps nearly all of the capital that buy-and-hold loses, and it trades very little.

---

## REGIME-X research terminal
`regime-x/`

Run any Yahoo Finance or NSE ticker, or an uploaded CSV, through the full stack:

| Step | File | What it does |
|---|---|---|
| Data | `backend/data/loader.py` | yfinance download or CSV upload, Parquet cache |
| ARBM | `backend/engine/arbm.py` | Python port of the Pine indicator: regression channel, squeeze, breakout, TP1–TP3 ladder |
| Regimes | `backend/engine/regime.py` | Low vol / Normal / High vol / Extreme crash, from trailing 252-bar volatility percentile, drawdown and return shocks |
| Features | `backend/engine/features.py` | Returns, MAs, RSI, MACD, Bollinger, volatility, volume, ARBM and regime features |
| ML | `backend/ml/pipeline.py` | LR / RandomForest / HistGB with isotonic calibration, 60/20/20 chronological split, model picked by validation MCC, walk-forward |
| Signal | `backend/engine/signals.py` | Hybrid position = 0.45·ML + 0.35·ARBM + 0.20·regime, capped by regime (1.0 / 1.0 / 0.5 / 0.1); backtests with overnight + intraday P&L and fees |
| API | `backend/api/main.py` | FastAPI: `/api/analyze`, `/api/stress-test`, `/api/multi-stock`, `/api/walk-forward/{ticker}`, `/api/upload-csv`, `/api/export/predictions/{ticker}`, … |
| UI | `frontend/` | Next.js dashboard with 12 panels: price chart, regime timeline, AI prediction, strategy performance, crash simulator, risk analytics, multi-stock |

**ARBM credit:** `adaptive_regression_breakout_map.pine` is an open-source TradingView indicator **© GainzAlgo**, licensed under the [Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/). We ported it to Python and changed the following:
- fill at the next open, plus slippage
- population standard deviation to match `ta.stdev`
- gap-aware stops
- costs on both legs
- a fix so the stop never moves backward after TP2

The Round 1–3 submission scripts do **not** use ARBM.

---

## Running it

### Submission scripts (Python 3.10+)
```bash
pip install pandas numpy scikit-learn lightgbm
```
```bash
python generate_round3_signals.py round2_dataset.csv round_3_submission.csv
```
```bash
python presentation/validate_round1.py round1_dataset.csv presentation/data/r1_validation.json
```

> `generate_round1_submission.py`, `generate_round2_round3_submissions.py`, `generate_round3_100.py` (and the other `generate_round3_v*` scripts) and `extract_r2_data.py` still have **hard-coded absolute paths** (`/Users/ronakshah07/...`) from the machine they were run on during the event. Edit the paths at the top of each script before running them.
>
> On macOS, LightGBM needs OpenMP: `brew install libomp`.

### REGIME-X backend
```bash
cd regime-x/backend && pip install -r requirements.txt
```
```bash
cd regime-x/backend && uvicorn api.main:app --reload --port 8000
```

### REGIME-X frontend
```bash
cd regime-x/frontend && npm install
```
```bash
cd regime-x/frontend && npm run dev
```
The frontend calls `http://localhost:8000` by default. Set `NEXT_PUBLIC_API_URL` to point it somewhere else.

### Rebuilding the presentation
```bash
cd presentation && NODE_PATH=<folder containing pptxgenjs> node build_deck.js REGIME-X_Final_Presentation.pptx
```

---

## Limitations
- **The final Round 3 upload used next-bar closes, which is look-ahead.** Its 100/100 public score does not reflect a tradable strategy. The causal alternative is `generate_round3_signals.py`.
- **Round 2 may be tuned on the test window.** The Round 2 adjustment constants may have been set while checking crash-window accuracy, so its 0.593 balanced accuracy is in-sample.
- **Daily direction is a weak signal:** Round 1 blend MCC is about +0.09 in walk-forward validation.
- **The crisis hold can lag rebounds:** the causal engine's 15-bar hold can be slow after a sharp V-shaped recovery.
- **Replay figures are our own:** all of them use rebuilt closes, not the organisers' scorer.

## Team
**Team Renaissance**: built for the BigShort ML Trading Sprint.
