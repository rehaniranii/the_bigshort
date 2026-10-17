"""
Walk-forward check of the submitted Round 1 configuration.

Rebuilds the exact feature set and models from generate_round1_submission.py, then scores
each model and the 0.5/0.3/0.2 blend with TimeSeriesSplit (5 expanding folds) on rows 1-800,
where the target is known. Nothing from rows 801-850 is used.
Also reports feature importance: LightGBM gain and permutation importance of the blend.

Usage: python validate_round1.py [round1.csv] [out.json]
"""
import sys, json, warnings
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import balanced_accuracy_score, matthews_corrcoef
import lightgbm as lgb

warnings.filterwarnings('ignore')


def features(df):
    # Identical to generate_round1_submission.py
    open_, high, low, vol = df['open'], df['high'], df['low'], df['volume']
    rsi, of, vol_20, vz = df['rsi_14'], df['order_flow'], df['volatility_20'], df['volume_z_20']
    f = pd.DataFrame(index=df.index)
    f['hl_ratio'] = (high - low) / open_
    f['ho_ratio'] = (high - open_) / open_
    f['ol_ratio'] = (open_ - low) / open_
    f['high_low_skew'] = (high - open_) / (open_ - low + 1e-6)
    f['rsi_14'] = rsi; f['order_flow'] = of; f['volatility_20'] = vol_20; f['volume_z_20'] = vz
    for lag in [1, 2, 3, 5, 10]:
        f[f'open_ret_{lag}'] = open_.pct_change(lag)
    for w in [5, 10, 20, 50]:
        f[f'open_vs_sma_{w}'] = (open_ - open_.rolling(w).mean()) / open_
        f[f'open_vs_ema_{w}'] = (open_ - open_.ewm(span=w).mean()) / open_
    f['rsi_diff_1'] = rsi.diff(1); f['rsi_diff_3'] = rsi.diff(3); f['rsi_diff_5'] = rsi.diff(5)
    f['rsi_vs_ma14'] = rsi - rsi.rolling(14).mean()
    f['of_lag1'] = of.shift(1); f['of_lag2'] = of.shift(2); f['of_diff1'] = of.diff(1)
    f['of_ma5'] = of.rolling(5).mean(); f['of_vz_interaction'] = of * vz
    f['vol_ratio'] = vol_20 / (vol_20.rolling(20).mean() + 1e-6)
    f['vol_change_5d'] = vol_20.pct_change(5)
    f['volume_change'] = vol.pct_change(1)
    f['volume_vs_avg20'] = vol / (vol.rolling(20).mean() + 1e-6)
    return f


def models():
    return {
        'Logistic regression': lambda: LogisticRegression(C=0.10, max_iter=1000, random_state=42),
        'HistGradientBoosting': lambda: HistGradientBoostingClassifier(max_iter=80, max_depth=3, learning_rate=0.03, min_samples_leaf=15, random_state=42),
        'LightGBM': lambda: lgb.LGBMClassifier(n_estimators=80, max_depth=3, learning_rate=0.03, num_leaves=7, min_child_samples=15,
                                               colsample_bytree=0.8, subsample=0.8, random_state=42, verbose=-1),
    }


def fit_predict(Xtr, ytr, Xte):
    sc = StandardScaler().fit(Xtr)  # fit on the training fold only
    out = {}
    for name, mk in models().items():
        m = mk()
        if name == 'Logistic regression':
            m.fit(sc.transform(Xtr), ytr); out[name] = m.predict_proba(sc.transform(Xte))[:, 1]
        else:
            m.fit(Xtr, ytr); out[name] = m.predict_proba(Xte)[:, 1]
    out['Blend 0.5 / 0.3 / 0.2'] = 0.5 * out['Logistic regression'] + 0.3 * out['HistGradientBoosting'] + 0.2 * out['LightGBM']
    return out


def main(path, out_path):
    df = pd.read_csv(path)
    X_all = features(df)
    tr = (df.timestamp <= 800) & ~X_all.isna().any(axis=1)
    X, y = X_all[tr].reset_index(drop=True), df.loc[tr, 'target'].astype(int).reset_index(drop=True)

    rows, folds = [], []
    for k, (a, b) in enumerate(TimeSeriesSplit(n_splits=5).split(X)):
        p = fit_predict(X.iloc[a], y.iloc[a], X.iloc[b])
        p['Always UP'] = np.ones(len(b))
        for name, prob in p.items():
            pred = (prob >= 0.5).astype(int)
            rows.append(dict(fold=k + 1, model=name, train_rows=len(a), test_rows=len(b),
                             balanced_accuracy=balanced_accuracy_score(y.iloc[b], pred), mcc=matthews_corrcoef(y.iloc[b], pred)))
        folds.append(dict(fold=k + 1, train_end_row=int(a[-1]), test_rows=len(b)))
    res = pd.DataFrame(rows)
    summary = res.groupby('model', sort=False)[['balanced_accuracy', 'mcc']].agg(['mean', 'std']).round(4)
    print(summary)

    # Feature importance 1: LightGBM gain on all training rows
    m = models()['LightGBM'](); m.fit(X, y)
    gain = pd.Series(m.booster_.feature_importance('gain'), index=X.columns)
    gain = (gain / gain.sum()).sort_values(ascending=False)

    # Feature importance 2: permutation importance of the blend, averaged over the 5 folds (drop in balanced accuracy)
    rng = np.random.default_rng(42)
    perm = pd.Series(0.0, index=X.columns)
    for a, b in TimeSeriesSplit(n_splits=5).split(X):
        base_p = fit_predict(X.iloc[a], y.iloc[a], X.iloc[b])
        base = balanced_accuracy_score(y.iloc[b], (base_p['Blend 0.5 / 0.3 / 0.2'] >= 0.5).astype(int))
        # refit once per fold; permute test columns only
        sc = StandardScaler().fit(X.iloc[a]); ms = {n: mk() for n, mk in models().items()}
        ms['Logistic regression'].fit(sc.transform(X.iloc[a]), y.iloc[a])
        ms['HistGradientBoosting'].fit(X.iloc[a], y.iloc[a]); ms['LightGBM'].fit(X.iloc[a], y.iloc[a])
        for c in X.columns:
            drops = []
            for _ in range(5):
                Xp = X.iloc[b].copy(); Xp[c] = rng.permutation(Xp[c].values)
                pb = (0.5 * ms['Logistic regression'].predict_proba(sc.transform(Xp))[:, 1] + 0.3 * ms['HistGradientBoosting'].predict_proba(Xp)[:, 1]
                      + 0.2 * ms['LightGBM'].predict_proba(Xp)[:, 1])
                drops.append(base - balanced_accuracy_score(y.iloc[b], (pb >= 0.5).astype(int)))
            perm[c] += np.mean(drops) / 5
    perm = perm.sort_values(ascending=False)
    print(gain.head(10).round(3)); print(perm.head(10).round(4))

    json.dump(dict(
        folds=folds,
        per_fold=res.round(4).to_dict('records'),
        summary=[dict(model=mn, balanced_accuracy=float(summary.loc[mn, ('balanced_accuracy', 'mean')]), ba_std=float(summary.loc[mn, ('balanced_accuracy', 'std')]),
                      mcc=float(summary.loc[mn, ('mcc', 'mean')]), mcc_std=float(summary.loc[mn, ('mcc', 'std')])) for mn in summary.index],
        lgbm_gain=[dict(feature=k, share=round(float(v), 4)) for k, v in gain.items()],
        permutation=[dict(feature=k, ba_drop=round(float(v), 4)) for k, v in perm.items()],
    ), open(out_path, 'w'), indent=1)


if __name__ == '__main__':
    main(*(sys.argv[1:] or ['round1_dataset.csv', 'presentation/data/r1_validation.json']))
