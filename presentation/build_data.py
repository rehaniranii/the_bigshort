import sys, json, subprocess, numpy as np, pandas as pd
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import generate_round3_signals as g
OUT = Path(sys.argv[1]); OUT.mkdir(exist_ok=True)

def dump(name, rows):
    (OUT / f'{name}.json').write_text(json.dumps(rows, separators=(',', ':')))

df = pd.read_csv(ROOT / 'round2_dataset.csv')
c = g.build_close(df)
r = c.pct_change()
pos = pd.Series(g.smooth(g.target_positions(df, c).values), index=df.index)
vol20 = r.rolling(20).std(); vol5 = r.rolling(5).std()
base = vol20.rolling(120, min_periods=30).median()
dd60 = c / c.rolling(60, min_periods=1).max() - 1
trig = (vol5 > g.SHOCK_K * base) | (dd60 < -0.12) | (r.abs() > 4 * base)
crisis = trig.astype(float).rolling(g.HOLD, min_periods=1).max().astype(bool).shift(1).fillna(False)

def window(t):
    return 'R1 train' if t <= 800 else ('R1 test' if t <= 850 else 'R2/R3 test')

market = []
for i, row in df.iterrows():
    t = int(row.timestamp)
    market.append(dict(t=t, date=row.date, close=round(float(c[i]), 2), window=window(t),
                       close_given=bool(pd.notna(row.close)), crisis=int(crisis[i]),
                       position=round(float(pos[i]), 4),
                       vol20=None if np.isnan(vol20[i]) else round(float(vol20[i]), 5)))
dump('market', market)

def st(name, a, b):
    rr = r.iloc[a:b]
    return dict(window=name, bars=int(len(rr)), mean_return=round(float(rr.mean()), 5),
                daily_vol=round(float(rr.std()), 5), up_share=round(float((rr > 0).mean()), 4),
                autocorr_1=round(float(rr.autocorr(1)), 4))
dump('regime_windows', [st('Calm (1-800)', 1, 800), st('Pre-crash (801-850)', 800, 850), st('Flash crash (851-900)', 850, 900)])

def git_csv(rev_path):
    return pd.read_csv(pd.io.common.StringIO(subprocess.check_output(['git', '-C', str(ROOT), 'show', rev_path], text=True)))
r1 = git_csv('b1a5941:round_1_submission.csv')  # Round 1 upload, removed from main later
dump('r1_submission', [dict(timestamp=int(a), prediction=int(b), confidence=float(cc)) for a, b, cc in r1.values])

cost = 0.001
# Scorer alignment: the position on row t earns the move from close[t] to close[t+1] (same as the target).
# The last row has no next close, so it earns 0.
p = pos.iloc[850:900].values; rr = c.pct_change().shift(-1).iloc[850:900].fillna(0.0).values; prev = pos.iloc[849:899].values
turn = np.abs(p - prev); pnl = p * rr - turn * cost
eq = np.cumprod(1 + pnl); bh = np.cumprod(1 + rr)
dd = eq / np.maximum.accumulate(eq) - 1; bdd = bh / np.maximum.accumulate(bh) - 1
dump('r3_backtest', [dict(t=851 + k, signal=round(float(p[k]), 4), bar_return=round(float(rr[k]), 5),
                          strategy_equity=round(float(eq[k]), 5), buyhold_equity=round(float(bh[k]), 5),
                          strategy_dd=round(float(dd[k]), 5), buyhold_dd=round(float(bdd[k]), 5),
                          crisis=int(crisis.iloc[850 + k])) for k in range(50)])

# facts: single figures used across the page
import subprocess
old = git_csv('b1a5941:round_3_submission.csv')  # first-draft Round 3 file
up_r2 = git_csv('0394367:round 2 renaissancw.csv')  # final Round 2 upload
up_r3 = git_csv('056f38f:round_3_submission.csv')  # final Round 3 upload (generate_round3_100.py)
next_ret = c.pct_change().shift(-1).iloc[850:899].values
truth = (next_ret > 0).astype(int)
from sklearn.metrics import balanced_accuracy_score, matthews_corrcoef
known = df.close.notna()
rec = 0.5 * (df.order_flow * (df.high - df.low) + df.high + df.low)
rec_err = float((rec[known] - df.close[known]).abs().max())
sma_err = float((c.rolling(10).mean() - df.sma_10).iloc[850:].abs().max())
r1feats = 4 + 4 + 5 + 8 + 4 + 5 + 4
pnl_bh = rr
facts = [
    ('r3_return', 'Final R3 book return, bars 851-900', float(eq[-1] - 1), 'pct'),
    ('bh_return', 'Buy & hold return, bars 851-900', float(bh[-1] - 1), 'pct'),
    ('r3_mdd', 'Final R3 max drawdown', float(dd.min()), 'pct'),
    ('bh_mdd', 'Buy & hold max drawdown', float(bdd.min()), 'pct'),
    ('r3_sharpe', 'Final R3 Sharpe (annualised)', float(pnl.mean() / pnl.std() * np.sqrt(252)), 'num'),
    ('bh_sharpe', 'Buy & hold Sharpe (annualised)', float(pnl_bh.mean() / pnl_bh.std() * np.sqrt(252)), 'num'),
    ('r3_turnover', 'Final R3 turnover (sum |Δposition|)', float(turn.sum()), 'num'),
    ('draft_turnover', 'First-draft R3 turnover', float(np.abs(np.diff(np.r_[0, old.signal.values])).sum()), 'num'),
    ('r3_avg_abs', 'Final R3 average |position|', float(np.abs(p).mean()), 'num'),
    ('r3_crisis_bars', 'Test bars flagged crisis', int(crisis.iloc[850:900].sum()), 'int'),
    ('r3_cost', 'Cost per unit of position change', cost, 'pct'),
    ('r1_features', 'Round 1 engineered features', r1feats, 'int'),
    ('r1_train_rows', 'Round 1 training rows after warm-up', 751, 'int'),
    ('r1_up_calls', 'Round 1 UP calls', int(r1.prediction.sum()), 'int'),
    ('r1_down_calls', 'Round 1 DOWN calls', int((r1.prediction == 0).sum()), 'int'),
    ('r1_mean_conf', 'Round 1 mean confidence', float(r1.confidence.mean()), 'num'),
    ('base_rate', 'Share of UP targets, rows 1-800', float(df.target.iloc[:800].mean()), 'pct'),
    ('rec_err', 'Close reconstruction max error, rows 1-850', rec_err, 'num'),
    ('sma_err', 'sma_10 parity max error, rows 851-900', sma_err, 'num'),
    ('peak_close', 'Peak close (bar 852)', float(c.max()), 'num'),
    ('end_close', 'Close at bar 900', float(c.iloc[899]), 'num'),
    ('crash_drop', 'Peak-to-bar-900 drop', float(c.iloc[899] / c.max() - 1), 'pct'),
    ('submissions', 'Total uploads allowed (all rounds)', 10, 'int'),
    ('lookahead_bars', 'R3 bars re-built with future rows deleted', 50, 'int'),
    ('r2_up_ba', 'Final Round 2 upload balanced accuracy (vs rebuilt closes)', float(balanced_accuracy_score(truth, up_r2.prediction.values[:49])), 'num'),
    ('r2_up_mcc', 'Final Round 2 upload MCC (vs rebuilt closes)', float(matthews_corrcoef(truth, up_r2.prediction.values[:49])), 'num'),
    ('r3_up_match', 'Final Round 3 upload: share of bars matching next-bar direction', float((np.sign(up_r3.signal.values[:49]) == np.sign(next_ret)).mean()), 'pct'),
]
dump('facts', [dict(key=k, label=l, value=v, unit=u) for k, l, v, u in facts])

params = [
 # id, section, component, parameter, value, file
 ('r1-1','r1','Logistic regression','C (L2 strength)','0.10','generate_round1_submission.py'),
 ('r1-2','r1','Logistic regression','Ensemble weight','0.50','generate_round1_submission.py'),
 ('r1-3','r1','HistGradientBoosting','max_depth / max_iter / lr','3 / 80 / 0.03','generate_round1_submission.py'),
 ('r1-4','r1','HistGradientBoosting','Ensemble weight','0.30','generate_round1_submission.py'),
 ('r1-5','r1','LightGBM','num_leaves / depth / subsample','7 / 3 / 0.8','generate_round1_submission.py'),
 ('r1-6','r1','LightGBM','Ensemble weight','0.20','generate_round1_submission.py'),
 ('r1-7','r1','Decision rule','UP if P(up) ≥','0.50','generate_round1_submission.py'),
 ('r3-1','r3','Calm regime','Daily vol target','0.6%','generate_round3_signals.py'),
 ('r3-2','r3','Calm regime','Trend signal','sign(EMA10 − EMA30)','generate_round3_signals.py'),
 ('r3-3','r3','Crisis regime','Daily vol target','1.5%','generate_round3_signals.py'),
 ('r3-4','r3','Crisis regime','Max |position|','0.5','generate_round3_signals.py'),
 ('r3-5','r3','Crisis regime','Rule','short only below SMA30, else flat','generate_round3_signals.py'),
 ('r3-6','r3','Crisis trigger','vol5 > K × baseline vol, K','2.5','generate_round3_signals.py'),
 ('r3-7','r3','Crisis trigger','60-bar drawdown below','−12%','generate_round3_signals.py'),
 ('r3-8','r3','Crisis trigger','|1-bar return| > × baseline','4','generate_round3_signals.py'),
 ('r3-9','r3','Crisis trigger','Hold crisis mode for (bars)','15','generate_round3_signals.py'),
 ('r3-10','r3','Smoother','Speed when adding risk','0.3','generate_round3_signals.py'),
 ('r3-11','r3','Smoother','Speed when cutting / flipping','0.8','generate_round3_signals.py'),
 ('arbm-1','arbm','Regression model','Regression length','50','adaptive_regression_breakout_map.pine'),
 ('arbm-2','arbm','Regression model','Deviation multiplier','2.0','adaptive_regression_breakout_map.pine'),
 ('arbm-3','arbm','Contraction','Squeeze lookback','100','adaptive_regression_breakout_map.pine'),
 ('arbm-4','arbm','Contraction','Squeeze threshold (width percentile)','20%','adaptive_regression_breakout_map.pine'),
 ('arbm-5','arbm','Targets','TP1 / TP2 / TP3 (× bandwidth)','1 / 2 / 3','adaptive_regression_breakout_map.pine'),
 ('arbm-6','arbm','Python port','Fee per leg / slippage','0.10% / 0.05%','regime-x/backend/engine/arbm.py'),
 ('rx-1','rx','Regime engine','LOW_VOL if vol percentile <','25','regime-x/backend/engine/regime.py'),
 ('rx-2','rx','Regime engine','HIGH_VOL if vol percentile ≥','75','regime-x/backend/engine/regime.py'),
 ('rx-3','rx','Regime engine','EXTREME if pct ≥ / DD ≤ / z ≤','95 / −10% / −3σ','regime-x/backend/engine/regime.py'),
 ('rx-4','rx','Signal blend','ML / ARBM / regime weights','0.45 / 0.35 / 0.20','regime-x/backend/engine/signals.py'),
 ('rx-5','rx','Signal blend','Position cap by regime','1.0 / 1.0 / 0.5 / 0.1','regime-x/backend/engine/signals.py'),
 ('rx-6','rx','Signal blend','Flat if |signal| <','0.10','regime-x/backend/engine/signals.py'),
 ('rx-7','rx','ML pipeline','Train / val / test split','60 / 20 / 20, chronological','regime-x/backend/ml/pipeline.py'),
 ('rx-8','rx','ML pipeline','Model pick','best validation MCC','regime-x/backend/ml/pipeline.py'),
]
dump('params', [dict(id=a, section=b, component=cc, parameter=d, value=e, file=f) for a, b, cc, d, e, f in params])

rubric = [
 dict(round='Round 1', name='Foundation', window='801–850', market='Calm', task='Predict UP (1) / DOWN (0) per row', upload='timestamp, prediction, confidence', scoring='Balanced accuracy + MCC vs a coin flip; always-UP ≈ 17 / 100'),
 dict(round='Round 2', name='Signal hunt', window='851–900', market='Flash crash', task='Same task, new regime: adapt the model', upload='timestamp, prediction, confidence', scoring='Balanced accuracy + MCC vs a coin flip; always-UP ≈ 17 / 100'),
 dict(round='Round 3', name='Alpha', window='851–900', market='Flash crash', task='Choose a position from −1 (short) to +1 (long)', upload='timestamp, signal', scoring='Backtest with costs: risk-adjusted return rewarded; deep drawdown and high turnover penalised'),
]
dump('rubric', rubric)

aud = json.load(open(ROOT / 'regime-x/backend/audit_results.json'))
lb, sc = [], []
for tk in ['AAPL', 'SPY', 'RELIANCE.NS']:
    a = aud[tk]
    for m in a['leaderboard']:
        lb.append(dict(key=f"{tk}|{m['model']}", ticker=tk, model=m['model'], balanced_accuracy=m['balanced_accuracy'], mcc=m['mcc'], roc_auc=m['roc_auc'], picked=bool(m['is_best'])))
    per = f"{a['tc']['start'][:4]}–{a['tc']['end'][:4]}"
    rows = [('Buy & hold', a['full_bh']['metrics']), ('ARBM only', dict(total_return=a['full_arbm']['total_return'], sharpe=a['full_arbm']['sharpe_annualized'], max_drawdown=a['full_arbm']['max_drawdown'])),
            ('ML only', a['full_ml']), ('Hybrid (ML + ARBM + regime)', a['full_hybrid'])]
    for name, m in rows:
        sc.append(dict(key=f'{tk}|{name}', ticker=tk, period=per, strategy=name, total_return=round(m['total_return'] / 100, 4), sharpe=round(m['sharpe'], 3), max_drawdown=round(m['max_drawdown'] / 100, 4)))
dump('ml_leaderboard', lb)
dump('strategy_compare', sc)
crash = []
for k in ['SPY_CRASH', 'AAPL_CRASH']:
    a = aud[k]
    m = a['metrics'] or {}
    crash.append(dict(ticker=a['ticker'], scenario=a['scenario']['name'], start=a['scenario']['start'], end=a['scenario']['end'], buyhold_return=round(a['buy_hold_return'] / 100, 4), strategy_return=round((m.get('total_return', 0.0)) / 100, 4), trades=m.get('total_trades', 0)))
dump('crash_test', crash)
print({p.name: p.stat().st_size for p in OUT.iterdir()})
print(crash)
