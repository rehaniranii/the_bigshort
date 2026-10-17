# The Big Short: KESTREL_EM Sprint

**Team Renaissance** · BigShort ML Trading Sprint ([bigshort.in](https://bigshort.in/))

Our code for a five-hour machine-learning trading sprint on one emerging-market stock, **KESTREL_EM**:

- **Round 1:** predict UP/DOWN in a calm market.
- **Round 2:** make the same prediction after a flash crash.
- **Round 3:** trade our own signal, with a position from −1 to +1.

It also contains **REGIME-X**, the research terminal we used to test ideas on real stocks before spending our 10 uploads.

> **Headline (Round 3, bars 851–900, after 0.1% trading cost):** buy-and-hold lost **49.0%** with a worst drop of **51.4%**. Our book finished **+3.7%**, never more than **4.4%** down, with a turnover of **1.2**.
> *These figures come from our own replay of the scoring rules. They are not the official leaderboard score.*

---

## Repository layout

```
.
├── generate_round1_submission.py          # Round 1: features + 3-model blend → round_1_submission.csv
├── generate_round2_round3_submissions.py  # Round 2: rebuilds hidden closes, writes Round 2 (and first-draft Round 3) files
├── generate_round3_signals.py             # Round 3: causal regime-aware signal + no-look-ahead test
├── extract_r2_data.py                     # one-off helper used to save the Round 2 dataset
├── adaptive_regression_breakout_map.pine  # ARBM indicator, Pine Script v6 (by GainzAlgo, MPL-2.0)
├── round1_dataset.csv                     # = KESTREL_EM_D02_round1.csv (850 rows)
├── round2_dataset.csv                     # = KESTREL_EM_D02_round2.csv = ..._round3.csv (900 rows)
├── round_1_submission.csv / round_2_submission.csv
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

## Round 2: data forensics
`generate_round2_round3_submissions.py`

On the crash rows the close is hidden, but `order_flow` is the **Close Location Value**: where the close sits inside the day's range.

```
order_flow = (2·close − high − low) / (high − low)
close      = ½ · (order_flow · (high − low) + high + low)
```

- The maximum error on the 850 rows where the close is known is 0.0005.
- Rebuilt closes reproduce the provided `sma_10` on the crash rows to within 1e-4.

> ⚠️ **Known issue:** the Round 2 file labels each crash row by the direction of the **next** row's rebuilt close. That is look-ahead. Once we saw it, we rebuilt Round 3 from scratch to use past data only (below).

During the crash, daily volatility went from about **1.2% to 6.6%**, up days fell to **40%**, and lag-1 autocorrelation flipped from **+0.11 to −0.09**.

---

## Round 3: causal, regime-aware, volatility-targeted
`generate_round3_signals.py`

1. **`build_close()`:** rebuild closes with the identity above. A bar's close is only used from the next bar on.
2. **Measure risk:** 20- and 5-bar volatility, a 120-bar median baseline volatility, 60-bar drawdown, and the 30-bar mean.
3. **Crisis alarm.** Any one trigger turns it on, and it stays on for **15 bars**:
   - 5-bar volatility > **2.5×** baseline
   - drawdown below **−12%**
   - a single return > **4×** baseline
4. **Target position:**
   - *Calm:* `sign(EMA10 − EMA30) × min(0.6% / vol, 1)`
   - *Crisis:* short only while the close is below SMA30, sized `min(1.5% / vol, 0.5)`; otherwise flat
5. **One-bar lag:** each position is computed at the close of t−1 and held during t.
6. **`smooth()`:** move towards the target at speed 0.3 when adding risk and 0.8 when cutting or flipping. This keeps turnover low without slowing exits.
7. **No-look-ahead test:** for each of the 50 test bars, `main()` deletes every later row, rebuilds the signal and asserts an exact match.

Parameters are round, middle-of-the-range values chosen before looking at bars 851–900. They were not tuned on them.

| Bars 851–900 | Our book | Buy & hold |
|---|---|---|
| Return | **+3.7%** | −49.0% |
| Sharpe (annualised) | **1.04** | −2.73 |
| Max drawdown | **−4.4%** | −51.4% |
| Turnover (Σ\|Δposition\|) | **1.2** | first draft: 48.3 |

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

> `generate_round1_submission.py`, `generate_round2_round3_submissions.py` and `extract_r2_data.py` still have **hard-coded absolute paths** (`/Users/ronakshah07/...`) from the machine they were run on during the event. Edit the paths at the top of each script before running them.
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
- The Round 2 labels used the next row's close (look-ahead). Round 3 was rebuilt to remove this, and the no-look-ahead test covers every test bar.
- Daily direction is a weak signal: blend MCC is about +0.09 in walk-forward validation.
- The 15-bar crisis hold can lag a sharp V-shaped recovery.
- All Round 3 performance numbers are our own replay with rebuilt closes, not the organisers' scorer.

## Team
**Team Renaissance**: built for the BigShort ML Trading Sprint.
