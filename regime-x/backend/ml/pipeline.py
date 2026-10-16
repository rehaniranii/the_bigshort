"""
ML Pipeline — REGIME-X
Chronological train/val/test splits, 3 classifiers, calibration, evaluation.
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score, matthews_corrcoef,
    precision_score, recall_score, f1_score, roc_auc_score,
    confusion_matrix,
)
from sklearn.pipeline import Pipeline
import warnings
warnings.filterwarnings('ignore')


MODELS = {
    "LogisticRegression": LogisticRegression(
        max_iter=1000, C=0.1, class_weight='balanced', random_state=42
    ),
    "RandomForest": RandomForestClassifier(
        n_estimators=200, max_depth=6, min_samples_leaf=20,
        class_weight='balanced', random_state=42, n_jobs=-1
    ),
    "HistGradientBoosting": HistGradientBoostingClassifier(
        max_iter=200, max_depth=4, learning_rate=0.05,
        min_samples_leaf=20, random_state=42,
    ),
}


def chronological_split(df: pd.DataFrame, train_pct=0.6, val_pct=0.2):
    """
    Split DataFrame chronologically into train / validation / test.
    Never shuffle — preserves time order to prevent lookahead.
    """
    n = len(df)
    train_end = int(n * train_pct)
    val_end   = int(n * (train_pct + val_pct))
    return (
        df.iloc[:train_end],
        df.iloc[train_end:val_end],
        df.iloc[val_end:],
    )


def prepare_xy(df: pd.DataFrame, feature_cols: list):
    """Extract X, y from DataFrame, dropping rows with NaN."""
    valid_cols = [c for c in feature_cols if c in df.columns]
    subset = df[valid_cols + ['target']].dropna()
    X = subset[valid_cols]
    y = subset['target']
    return X, y, subset.index


def train_and_evaluate(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    feature_cols: list,
) -> dict:
    """
    Train all three classifiers on train_df, evaluate on val_df.
    Select best model by MCC (then balanced accuracy).
    Evaluate selected model on test_df.

    Returns full results dict.
    """
    X_train, y_train, _ = prepare_xy(train_df, feature_cols)
    X_val,   y_val,   val_idx = prepare_xy(val_df,   feature_cols)
    X_test,  y_test,  test_idx = prepare_xy(test_df, feature_cols)

    if len(X_train) < 30:
        raise ValueError("Insufficient training data (< 30 samples after dropping NaN).")

    results = {}
    best_name = None
    best_mcc  = -2.0
    best_pipeline = None

    for name, clf in MODELS.items():
        # Build pipeline with scaler (important for LogReg)
        pipe = Pipeline([
            ('scaler', StandardScaler()),
            ('clf', CalibratedClassifierCV(clf, method='isotonic', cv=3)),
        ])

        pipe.fit(X_train, y_train)

        # Validation metrics (used for model selection)
        val_preds = pipe.predict(X_val)
        val_proba = pipe.predict_proba(X_val)[:, 1]
        val_metrics = _compute_classification_metrics(y_val, val_preds, val_proba, split="val")

        results[name] = {
            "pipeline":     pipe,
            "val_metrics":  val_metrics,
            "val_preds":    val_preds,
            "val_proba":    val_proba,
            "val_idx":      val_idx,
        }

        # Feature importance (for RF and HGB)
        if hasattr(pipe.named_steps['clf'], 'estimator') and hasattr(
            pipe.named_steps['clf'].estimator, 'feature_importances_'
        ):
            imp = pipe.named_steps['clf'].estimator.feature_importances_
        elif hasattr(pipe.named_steps['clf'], 'calibrated_classifiers_'):
            # try from calibrated
            try:
                imp = np.mean([
                    c.estimator.feature_importances_
                    for c in pipe.named_steps['clf'].calibrated_classifiers_
                ], axis=0)
            except Exception:
                imp = np.ones(len(X_train.columns)) / len(X_train.columns)
        else:
            imp = np.ones(len(X_train.columns)) / len(X_train.columns)

        results[name]["feature_importance"] = dict(zip(X_train.columns, imp))

        # Best model selection by validation MCC
        mcc = val_metrics['mcc']
        if mcc > best_mcc:
            best_mcc = mcc
            best_name = name
            best_pipeline = pipe

    # Evaluate best model on FINAL test set
    test_preds = best_pipeline.predict(X_test)
    test_proba = best_pipeline.predict_proba(X_test)[:, 1]
    test_metrics = _compute_classification_metrics(y_test, test_preds, test_proba, split="test")

    return {
        "model_results":    results,
        "best_model_name":  best_name,
        "best_pipeline":    best_pipeline,
        "test_metrics":     test_metrics,
        "test_preds":       test_preds,
        "test_proba":       test_proba,
        "test_idx":         test_idx,
        "feature_cols":     list(X_train.columns),
    }


def _compute_classification_metrics(y_true, y_pred, y_proba, split: str) -> dict:
    cm = confusion_matrix(y_true, y_pred)
    try:
        auc = roc_auc_score(y_true, y_proba)
    except Exception:
        auc = 0.5

    return {
        "split":            split,
        "accuracy":         round(accuracy_score(y_true, y_pred), 4),
        "balanced_accuracy": round(balanced_accuracy_score(y_true, y_pred), 4),
        "mcc":              round(matthews_corrcoef(y_true, y_pred), 4),
        "precision":        round(precision_score(y_true, y_pred, zero_division=0), 4),
        "recall":           round(recall_score(y_true, y_pred, zero_division=0), 4),
        "f1":               round(f1_score(y_true, y_pred, zero_division=0), 4),
        "roc_auc":          round(auc, 4),
        "confusion_matrix": cm.tolist(),
        "n_samples":        len(y_true),
        "n_positive":       int(y_true.sum()),
        "n_negative":       int((y_true == 0).sum()),
    }


def walk_forward_validate(
    df: pd.DataFrame,
    feature_cols: list,
    model_name: str,
    initial_train_pct: float = 0.5,
    step_pct: float = 0.05,
    retrain_window: int = None,  # None = expanding window
) -> list:
    """
    Walk-forward validation: train on past, predict next step.
    Returns list of step results with metrics.

    retrain_window=None → expanding window (grows with more data)
    retrain_window=252  → rolling window of ~1 year
    """
    n = len(df)
    init_size = int(n * initial_train_pct)
    step_size = max(int(n * step_pct), 10)

    clf_class = MODELS[model_name]
    step_results = []

    for start in range(init_size, n - step_size, step_size):
        if retrain_window is None:
            train_df = df.iloc[:start]
        else:
            train_df = df.iloc[max(0, start - retrain_window):start]

        test_df = df.iloc[start:start + step_size]

        X_train, y_train, _ = prepare_xy(train_df, feature_cols)
        X_test,  y_test,  test_idx = prepare_xy(test_df, feature_cols)

        if len(X_train) < 20 or len(X_test) < 5:
            continue

        pipe = Pipeline([
            ('scaler', StandardScaler()),
            ('clf', CalibratedClassifierCV(clf_class, method='isotonic', cv=3)),
        ])
        pipe.fit(X_train, y_train)

        preds = pipe.predict(X_test)
        proba = pipe.predict_proba(X_test)[:, 1]
        metrics = _compute_classification_metrics(y_test, preds, proba, "wfv")

        step_results.append({
            "step_start": start,
            "step_end":   start + step_size,
            "train_size": len(X_train),
            "metrics":    metrics,
            "preds":      preds.tolist(),
            "proba":      proba.tolist(),
            "idx":        test_idx.tolist(),
        })

    return step_results


def generate_latest_prediction(
    df: pd.DataFrame,
    pipeline,
    feature_cols: list,
) -> dict:
    """Generate prediction for the most recent bar."""
    valid_cols = [c for c in feature_cols if c in df.columns]
    last_row = df[valid_cols].iloc[-1:].dropna(axis=1)

    # If any features missing, fill with 0
    for c in valid_cols:
        if c not in last_row.columns:
            last_row[c] = 0.0

    last_row = last_row[valid_cols]

    prob_up   = pipeline.predict_proba(last_row)[0][1]
    direction = "BULLISH" if prob_up > 0.5 else "BEARISH"

    return {
        "prob_up":   round(float(prob_up), 4),
        "prob_down": round(1.0 - float(prob_up), 4),
        "direction": direction,
        "confidence": round(abs(prob_up - 0.5) * 200, 1),  # 0-100%
    }
