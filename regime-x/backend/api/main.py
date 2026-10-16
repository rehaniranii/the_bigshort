"""
REGIME-X FastAPI Backend
All endpoints return JSON. No real-money execution.
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import io

# Internal modules
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from engine.arbm    import compute_regression_features, run_backtest, ARBMConfig
from engine.regime  import detect_regimes, RegimeConfig, get_regime_params, get_stress_periods
from engine.features import build_feature_matrix, get_feature_columns
from engine.signals  import (
    SignalConfig, compute_position_signal,
    hybrid_backtest_strategy, ml_only_backtest_strategy, _equity_to_metrics
)
from ml.pipeline    import (
    train_and_evaluate, chronological_split,
    walk_forward_validate, generate_latest_prediction
)
from data.loader    import (
    load_ohlcv, load_from_csv, get_current_price,
    generate_sample_data, get_sample_tickers
)

app = FastAPI(
    title="REGIME-X Quant Trading API",
    description="Adaptive Regression Breakout Map — ML-enhanced quant platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────────────────────
# In-memory model store (session-scoped)
# ──────────────────────────────────────────────────────────────────────────────
_model_store: dict = {}


def _numpy_safe(obj):
    """Convert numpy types to Python native for JSON serialization."""
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _numpy_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_numpy_safe(v) for v in obj]
    return obj


# ──────────────────────────────────────────────────────────────────────────────
# Request / Response models
# ──────────────────────────────────────────────────────────────────────────────

class AnalysisRequest(BaseModel):
    ticker: str = "AAPL"
    start: str = "2020-01-01"
    end: Optional[str] = None
    horizon: int = 1
    model_name: Optional[str] = None   # if None, auto-select best
    arbm_length: int = 50
    arbm_dev_mult: float = 2.0
    arbm_sqz_len: int = 100
    arbm_sqz_pct: float = 20.0
    tp1_mult: float = 1.0
    tp2_mult: float = 2.0
    tp3_mult: float = 3.0
    use_sample_data: bool = False


class StressTestRequest(BaseModel):
    ticker: str = "AAPL"
    scenario_name: str = "COVID-19 Crash"
    initial_capital: float = 100_000


class MultiStockRequest(BaseModel):
    tickers: List[str]
    start: str = "2022-01-01"
    end: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# Core pipeline helper
# ──────────────────────────────────────────────────────────────────────────────

def run_full_pipeline(req: AnalysisRequest) -> dict:
    """
    Execute the complete analysis pipeline for a given ticker.
    Returns all analysis results as a JSON-safe dict.
    """
    # 1. Load data
    if req.use_sample_data:
        df = generate_sample_data(n=600)
    else:
        df = load_ohlcv(req.ticker, req.start, req.end)

    if len(df) < 150:
        raise HTTPException(status_code=400, detail="Insufficient data (< 150 bars). Try a wider date range.")

    # 2. ARBM indicators
    arbm_cfg = ARBMConfig(
        length=req.arbm_length,
        dev_mult=req.arbm_dev_mult,
        sqz_len=req.arbm_sqz_len,
        sqz_pct=req.arbm_sqz_pct,
        tp1_mult=req.tp1_mult,
        tp2_mult=req.tp2_mult,
        tp3_mult=req.tp3_mult,
    )
    df = compute_regression_features(df, arbm_cfg)

    # 3. Market regime
    df = detect_regimes(df)

    # 4. Feature engineering
    df = build_feature_matrix(df, horizon=req.horizon)
    feature_cols = get_feature_columns()

    # 5. Chronological split
    train_df, val_df, test_df = chronological_split(df.dropna(subset=['target']))

    # 6. ML training + evaluation
    ml_results = train_and_evaluate(train_df, val_df, test_df, feature_cols)
    best_pipe  = ml_results['best_pipeline']

    # 7. Generate predictions for full df (for chart overlay)
    valid_feat = [c for c in feature_cols if c in df.columns]
    X_full = df[valid_feat].fillna(0)
    full_proba = best_pipe.predict_proba(X_full)[:, 1]

    # 8. Latest prediction
    latest_pred = generate_latest_prediction(df, best_pipe, feature_cols)
    latest_regime = int(df['regime'].iloc[-1])
    latest_arbm = 1 if df['bull_trigger'].iloc[-1] else (-1 if df['bear_trigger'].iloc[-1] else 0)
    latest_vol_pct = float(df['vol_percentile'].iloc[-1]) if not pd.isna(df['vol_percentile'].iloc[-1]) else 50.0

    position_sig = compute_position_signal(
        ml_prob_up=latest_pred['prob_up'],
        arbm_signal=latest_arbm,
        regime=latest_regime,
        regime_vol_pct=latest_vol_pct,
    )

    # 9. ARBM backtest
    arbm_bt = run_backtest(df.dropna(subset=['band_width']).copy(), arbm_cfg)

    # 10. Hybrid strategy backtest
    df_bt = df.copy().reset_index(drop=True)
    hybrid_bt = hybrid_backtest_strategy(
        df_bt, full_proba, arbm_cfg,
        initial_capital=100_000,
    )

    # 11. ML-only strategy backtest
    ml_only_bt = ml_only_backtest_strategy(
        df_bt, full_proba,
        initial_capital=100_000,
    )

    # 12. Buy & hold benchmark
    bh_ret = (df['close'].iloc[-1] - df['close'].iloc[0]) / df['close'].iloc[0] * 100
    bh_equity = (df['close'] / df['close'].iloc[0] * 100_000).tolist()
    bh_metrics = _equity_to_metrics(bh_equity, 100_000)

    # 13. Strict Out-of-Sample (OOS) Test Period Comparison
    test_start = len(train_df) + len(val_df)
    test_slice = df.iloc[test_start:].copy().reset_index(drop=True)
    test_proba = full_proba[test_start:]
    oos_hybrid = hybrid_backtest_strategy(test_slice, test_proba, arbm_cfg, initial_capital=100_000)
    oos_ml_only = ml_only_backtest_strategy(test_slice, test_proba, initial_capital=100_000)
    oos_arbm = run_backtest(test_slice.dropna(subset=['band_width']).copy(), arbm_cfg)
    oos_bh_eq = (test_slice['close'] / test_slice['close'].iloc[0] * 100_000).tolist() if len(test_slice) > 0 else [100_000]
    oos_bh_metrics = _equity_to_metrics(oos_bh_eq, 100_000)

    # 14. Build chart data
    chart_data = _build_chart_data(df, full_proba)

    # 15. Feature importance for best model
    fi = ml_results['model_results'][ml_results['best_model_name']].get('feature_importance', {})
    fi_sorted = dict(sorted(fi.items(), key=lambda x: x[1], reverse=True)[:20])

    # 16. Model leaderboard
    leaderboard = []
    for mname, mres in ml_results['model_results'].items():
        vm = mres['val_metrics']
        leaderboard.append({
            "model":            mname,
            "balanced_accuracy": vm['balanced_accuracy'],
            "mcc":              vm['mcc'],
            "f1":               vm['f1'],
            "roc_auc":          vm['roc_auc'],
            "is_best":          mname == ml_results['best_model_name'],
        })

    # Store pipeline for future prediction calls
    _model_store[req.ticker] = {
        "pipeline":     best_pipe,
        "feature_cols": feature_cols,
        "last_df":      df,
        "arbm_cfg":     arbm_cfg,
    }

    result = {
        "ticker":          req.ticker,
        "data_points":     len(df),
        "date_range":      {
            "start": str(df.index[0])[:10],
            "end":   str(df.index[-1])[:10],
        },
        "test_date_range": {
            "start": str(test_df.index[0])[:10] if len(test_df) > 0 else "",
            "end":   str(test_df.index[-1])[:10] if len(test_df) > 0 else "",
        },
        "latest_price": {
            "close":      float(df['close'].iloc[-1]),
            "change_pct": float(df['close'].pct_change().iloc[-1] * 100),
        },
        "latest_prediction":   latest_pred,
        "position_signal":     position_sig,
        "current_regime": {
            "id":    latest_regime,
            "label": df['regime_label'].iloc[-1],
            "color": df['regime_color'].iloc[-1],
            "vol_percentile": round(latest_vol_pct, 1),
        },
        "ml_results": {
            "best_model":     ml_results['best_model_name'],
            "test_metrics":   ml_results['test_metrics'],
            "leaderboard":    leaderboard,
            "feature_importance": fi_sorted,
        },
        "arbm_backtest": {
            "metrics":    arbm_bt['metrics'],
            "trade_count": len(arbm_bt['trades']),
            "equity":     arbm_bt['metrics'].get('equity_curve', [])[::5],
        },
        "hybrid_backtest": {
            "metrics":   hybrid_bt['metrics'],
            "equity":    hybrid_bt['equity'][::5],  # downsample for chart
        },
        "ml_only_backtest": {
            "metrics":   ml_only_bt['metrics'],
            "equity":    ml_only_bt['equity'][::5],
        },
        "buy_hold": {
            "total_return": round(bh_ret, 4),
            "metrics":      bh_metrics,
            "equity":       bh_equity[::5],
        },
        "out_of_sample_comparison": {
            "buy_hold": oos_bh_metrics,
            "arbm":     oos_arbm['metrics'],
            "ml_only":  oos_ml_only['metrics'],
            "hybrid":   oos_hybrid['metrics'],
        },
        "chart_data":    chart_data,
    }

    return _numpy_safe(result)


def _build_chart_data(df: pd.DataFrame, full_proba: np.ndarray) -> list:
    """Build OHLCV + indicator data for frontend chart."""
    records = []
    for i in range(len(df)):
        row = df.iloc[i]
        ts  = str(df.index[i])[:10]
        records.append({
            "date":        ts,
            "open":        round(float(row['open']), 4),
            "high":        round(float(row['high']), 4),
            "low":         round(float(row['low']), 4),
            "close":       round(float(row['close']), 4),
            "volume":      float(row.get('volume', 0) or 0),
            "reg_basis":   None if pd.isna(row.get('reg_basis', np.nan)) else round(float(row['reg_basis']), 4),
            "upper_band":  None if pd.isna(row.get('upper_band', np.nan)) else round(float(row['upper_band']), 4),
            "lower_band":  None if pd.isna(row.get('lower_band', np.nan)) else round(float(row['lower_band']), 4),
            "is_squeeze":  bool(row.get('is_squeeze', False)),
            "bull_trigger": bool(row.get('bull_trigger', False)),
            "bear_trigger": bool(row.get('bear_trigger', False)),
            "regime":      int(row.get('regime', 1)),
            "regime_label": str(row.get('regime_label', 'NORMAL')),
            "prob_up":     round(float(full_proba[i]), 4) if i < len(full_proba) else 0.5,
        })
    return records


# ──────────────────────────────────────────────────────────────────────────────
# API Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"name": "REGIME-X API", "version": "1.0.0", "status": "running"}


@app.get("/api/tickers")
def list_tickers():
    return get_sample_tickers()


@app.get("/api/stress-periods")
def list_stress_periods():
    return get_stress_periods()


@app.post("/api/analyze")
def analyze(req: AnalysisRequest):
    try:
        result = run_full_pipeline(req)
        return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/price/{ticker}")
def current_price(ticker: str):
    return get_current_price(ticker)


@app.post("/api/stress-test")
def stress_test(req: StressTestRequest):
    """Run strategy through a historical stress scenario."""
    scenarios = {s['name']: s for s in get_stress_periods()}
    if req.scenario_name not in scenarios:
        raise HTTPException(400, f"Unknown scenario. Available: {list(scenarios.keys())}")

    scenario = scenarios[req.scenario_name]
    start = scenario['start']
    end   = scenario['end']

    try:
        df = load_ohlcv(req.ticker, start, end)
    except Exception as e:
        raise HTTPException(400, f"Could not load data for {req.ticker} in scenario period: {e}")

    if len(df) < 20:
        raise HTTPException(400, f"Insufficient data for {req.ticker} in {req.scenario_name} period.")

    arbm_cfg = ARBMConfig(initial_capital=req.initial_capital)
    df = compute_regression_features(df, arbm_cfg)
    df = detect_regimes(df)

    backtest = run_backtest(df.dropna(subset=['band_width']).copy(), arbm_cfg)
    bh_ret   = (df['close'].iloc[-1] - df['close'].iloc[0]) / df['close'].iloc[0] * 100

    regime_transitions = (
        df[['regime', 'regime_label']].copy()
        .reset_index()
        .rename(columns={df.index.name or 'index': 'date'})
        .to_dict('records')
    )

    return _numpy_safe({
        "ticker":    req.ticker,
        "scenario":  scenario,
        "metrics":   backtest['metrics'],
        "buy_hold_return": round(bh_ret, 4),
        "equity":    backtest['equity'][::max(1, len(backtest['equity'])//200)],
        "regime_transitions": regime_transitions[:200],
    })


@app.post("/api/multi-stock")
def multi_stock(req: MultiStockRequest):
    """Compare multiple stocks."""
    if len(req.tickers) > 5:
        raise HTTPException(400, "Maximum 5 tickers for comparison.")

    results = []
    for ticker in req.tickers:
        try:
            df = load_ohlcv(ticker, req.start, req.end)
            df = compute_regression_features(df, ARBMConfig())
            df = detect_regimes(df)
            df = build_feature_matrix(df)

            latest_regime = int(df['regime'].iloc[-1])
            vol = float(df['realized_vol'].iloc[-1]) if not pd.isna(df['realized_vol'].iloc[-1]) else 0.0
            ret_1m = float(df['close'].pct_change(21).iloc[-1] * 100)
            bull = bool(df['bull_trigger'].iloc[-1])
            bear = bool(df['bear_trigger'].iloc[-1])
            signal = "BULLISH" if bull else ("BEARISH" if bear else "NEUTRAL")

            results.append({
                "ticker": ticker,
                "latest_price":  round(float(df['close'].iloc[-1]), 2),
                "return_1m":     round(ret_1m, 2),
                "regime":        latest_regime,
                "regime_label":  str(df['regime_label'].iloc[-1]),
                "realized_vol":  round(vol, 2),
                "signal":        signal,
                "error":         None,
            })
        except Exception as e:
            results.append({"ticker": ticker, "error": str(e)})

    return _numpy_safe({"comparison": results})


@app.post("/api/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """Accept CSV upload for offline analysis."""
    content = await file.read()
    df = load_from_csv(io.StringIO(content.decode('utf-8')))
    return {
        "rows": len(df),
        "columns": list(df.columns),
        "date_range": {"start": str(df.index[0])[:10], "end": str(df.index[-1])[:10]},
        "preview": df.head(5).reset_index().to_dict('records'),
    }


@app.get("/api/export/predictions/{ticker}")
def export_predictions(ticker: str):
    """Download predictions CSV for a previously analyzed ticker."""
    if ticker not in _model_store:
        raise HTTPException(404, f"No model found for {ticker}. Run /api/analyze first.")

    store = _model_store[ticker]
    df    = store['last_df']
    pipe  = store['pipeline']
    fcols = store['feature_cols']

    valid_cols = [c for c in fcols if c in df.columns]
    X = df[valid_cols].fillna(0)
    proba = pipe.predict_proba(X)[:, 1]

    out = df[['close']].copy()
    out['prob_up']   = proba
    out['direction'] = (proba > 0.5).astype(int).map({1: 'UP', 0: 'DOWN'})
    out['regime']    = df.get('regime', 1)

    csv_content = out.to_csv()
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={ticker}_predictions.csv"},
    )


@app.get("/api/walk-forward/{ticker}")
def walk_forward_endpoint(ticker: str, retrain_window: Optional[int] = Query(None)):
    """Run rolling walk-forward validation to detect concept drift."""
    if ticker not in _model_store:
        raise HTTPException(404, f"No model found for {ticker}. Run /api/analyze first.")

    store = _model_store[ticker]
    df = store['last_df']
    fcols = store['feature_cols']

    results = walk_forward_validate(
        df=df.dropna(subset=['target']),
        feature_cols=fcols,
        model_name="RandomForest",
        initial_train_pct=0.4,
        step_pct=0.08,
        retrain_window=retrain_window,
    )
    return _numpy_safe({"ticker": ticker, "walk_forward_steps": results})


@app.get("/api/sample-demo")
def sample_demo():
    """Run full analysis on synthetic sample data."""
    req = AnalysisRequest(
        ticker="SAMPLE",
        start="2021-01-01",
        use_sample_data=True,
    )
    try:
        return run_full_pipeline(req)
    except Exception as e:
        raise HTTPException(500, str(e))
