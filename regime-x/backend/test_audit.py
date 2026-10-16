"""
REGIME-X Technical and Quantitative Audit Test Suite
Runs end-to-end testing across 3 stocks under diverse market conditions
and a historical crash scenario.
"""

import sys
import json
from pathlib import Path
import pandas as pd
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))

from api.main import run_full_pipeline, AnalysisRequest, stress_test, StressTestRequest
from engine.regime import get_stress_periods

def run_tests():
    print("=" * 70)
    print("REGIME-X QUANTITATIVE AUDIT: RUNNING END-TO-END TESTS")
    print("=" * 70)

    test_cases = [
        {"ticker": "AAPL", "start": "2021-01-01", "end": "2024-01-01", "desc": "US Tech Growth (AAPL)"},
        {"ticker": "SPY",  "start": "2020-01-01", "end": "2023-01-01", "desc": "US Broad Market (SPY) inc. 2020/2022"},
        {"ticker": "RELIANCE.NS", "start": "2021-01-01", "end": "2024-01-01", "desc": "NSE Large Cap (RELIANCE.NS)"},
    ]

    all_results = {}

    for tc in test_cases:
        print(f"\n--- Testing {tc['desc']} [{tc['ticker']}] ---")
        req = AnalysisRequest(
            ticker=tc['ticker'],
            start=tc['start'],
            end=tc['end'],
            horizon=1,
        )
        try:
            res = run_full_pipeline(req)
            ml = res['ml_results']
            best_model = ml['best_model']
            test_metrics = ml['test_metrics']
            leaderboard = ml['leaderboard']
            regime = res['current_regime']
            sig = res['position_signal']
            oos = res['out_of_sample_comparison']
            full_arbm = res['arbm_backtest']['metrics']
            full_hybrid = res['hybrid_backtest']['metrics']
            full_ml = res['ml_only_backtest']['metrics']
            full_bh = res['buy_hold']

            print(f"Data Points: {res['data_points']} | Full Date Range: {res['date_range']['start']} to {res['date_range']['end']}")
            print(f"Test Set Range: {res['test_date_range']['start']} to {res['test_date_range']['end']}")
            print(f"Current Regime: {regime['label']} (Vol Percentile: {regime['vol_percentile']}%)")
            print(f"Latest Signal: {sig['direction']} ({sig['position']}) | Reason: {sig['reason']}")
            print(f"Best ML Model: {best_model}")
            print(f"Test Set Metrics: Acc={test_metrics['accuracy']:.4f}, BalAcc={test_metrics['balanced_accuracy']:.4f}, MCC={test_metrics['mcc']:.4f}, ROC-AUC={test_metrics['roc_auc']:.4f}")
            print("\nLeaderboard (Val Set):")
            for m in leaderboard:
                print(f"  - {m['model']}: BalAcc={m['balanced_accuracy']:.4f}, MCC={m['mcc']:.4f}, ROC-AUC={m['roc_auc']:.4f} {'[BEST]' if m['is_best'] else ''}")

            print("\nFull-Period Strategy Comparison:")
            print(f"  - Buy & Hold: Total Ret={full_bh['total_return']:.2f}%, Sharpe={full_bh['metrics'].get('sharpe', 'N/A')}, MaxDD={full_bh['metrics'].get('max_drawdown', 'N/A')}%")
            print(f"  - ARBM Only:  Total Ret={full_arbm.get('total_return', 0):.2f}%, Sharpe={full_arbm.get('sharpe_annualized', 0):.2f}, MaxDD={full_arbm.get('max_drawdown', 0):.2f}%, Trades={full_arbm.get('total_trades', 0)}")
            print(f"  - ML-Only:    Total Ret={full_ml.get('total_return', 0):.2f}%, Sharpe={full_ml.get('sharpe', 0):.2f}, MaxDD={full_ml.get('max_drawdown', 0):.2f}%")
            print(f"  - Hybrid:     Total Ret={full_hybrid.get('total_return', 0):.2f}%, Sharpe={full_hybrid.get('sharpe', 0):.2f}, MaxDD={full_hybrid.get('max_drawdown', 0):.2f}%")

            print("\nStrict Out-of-Sample (OOS) Test Period Comparison:")
            print(f"  - Buy & Hold: Total Ret={oos['buy_hold'].get('total_return', 0):.2f}%, Sharpe={oos['buy_hold'].get('sharpe', 0):.2f}, MaxDD={oos['buy_hold'].get('max_drawdown', 0):.2f}%")
            print(f"  - ARBM Only:  Total Ret={oos['arbm'].get('total_return', 0):.2f}%, Sharpe={oos['arbm'].get('sharpe_annualized', 0):.2f}, MaxDD={oos['arbm'].get('max_drawdown', 0):.2f}%, Trades={oos['arbm'].get('total_trades', 0)}")
            print(f"  - ML-Only:    Total Ret={oos['ml_only'].get('total_return', 0):.2f}%, Sharpe={oos['ml_only'].get('sharpe', 0):.2f}, MaxDD={oos['ml_only'].get('max_drawdown', 0):.2f}%")
            print(f"  - Hybrid:     Total Ret={oos['hybrid'].get('total_return', 0):.2f}%, Sharpe={oos['hybrid'].get('sharpe', 0):.2f}, MaxDD={oos['hybrid'].get('max_drawdown', 0):.2f}%")

            all_results[tc['ticker']] = {
                "tc": tc,
                "data_points": res['data_points'],
                "test_metrics": test_metrics,
                "best_model": best_model,
                "leaderboard": leaderboard,
                "full_bh": full_bh,
                "full_arbm": full_arbm,
                "full_ml": full_ml,
                "full_hybrid": full_hybrid,
                "oos": oos,
            }
        except Exception as e:
            print(f"Error testing {tc['ticker']}: {e}")
            import traceback
            traceback.print_exc()

    # Historical Crash Scenario
    print("\n" + "=" * 70)
    print("RUNNING HISTORICAL CRASH SCENARIOS (COVID-19 CRASH: Feb-Apr 2020)")
    print("=" * 70)
    for ticker in ["SPY", "AAPL"]:
        try:
            s_req = StressTestRequest(ticker=ticker, scenario_name="COVID-19 Crash")
            s_res = stress_test(s_req)
            m = s_res['metrics']
            print(f"\nCrash Results for {ticker}:")
            print(f"  - Buy & Hold Return: {s_res['buy_hold_return']:.2f}%")
            print(f"  - Strategy Return:   {m.get('total_return', 0):.2f}%")
            print(f"  - Strategy Max DD:   {m.get('max_drawdown', 0):.2f}%")
            print(f"  - Trades Taken:      {m.get('total_trades', 0)}")
            all_results[f"{ticker}_CRASH"] = s_res
        except Exception as e:
            print(f"Error running crash simulation for {ticker}: {e}")

    # Output JSON summary for audit report
    with open("audit_results.json", "w") as f:
        # Convert non-serializable if any
        def default_conv(o):
            if isinstance(o, (np.integer, np.int64)): return int(o)
            if isinstance(o, (np.floating, np.float64)): return float(o)
            if isinstance(o, np.ndarray): return o.tolist()
            return str(o)
        json.dump(all_results, f, indent=2, default=default_conv)
    print("\nSaved detailed test results to audit_results.json")

if __name__ == "__main__":
    run_tests()
