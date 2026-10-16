'use client';

import { AnalysisResult } from '@/lib/api';

function RiskGauge({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = Math.min(100, Math.abs(value) / Math.abs(max) * 100);
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</span>
        <span className="mono" style={{ fontSize: '13px', fontWeight: 700, color }}>{typeof value === 'number' ? value.toFixed(4) : value}</span>
      </div>
      <div style={{ height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

export default function RiskAnalytics({ result }: { result: AnalysisResult }) {
  const hm = result.hybrid_backtest.metrics;
  const am = result.arbm_backtest.metrics;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
      {/* Hybrid Risk */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '6px' }}>
          Hybrid Strategy — Risk Profile
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          ML + ARBM + Regime adaptive position sizing
        </div>

        <RiskGauge value={hm.sharpe ?? 0} max={3} label="Annualized Sharpe" color={(hm.sharpe ?? 0) > 1 ? 'var(--green)' : (hm.sharpe ?? 0) > 0 ? 'var(--amber)' : 'var(--red)'} />
        <RiskGauge value={hm.sortino ?? 0} max={3} label="Sortino Ratio" color={(hm.sortino ?? 0) > 1 ? 'var(--green)' : 'var(--text-secondary)'} />
        <RiskGauge value={Math.abs(hm.max_drawdown ?? 0)} max={50} label="Max Drawdown" color="var(--red)" />
        <RiskGauge value={hm.annualized_vol ?? 0} max={50} label="Annualized Volatility %" color="var(--amber)" />

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { label: 'Total Return', value: `${(hm.total_return ?? 0).toFixed(2)}%`, color: (hm.total_return ?? 0) > 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Ann. Return', value: `${(hm.annualized_return ?? 0).toFixed(2)}%`, color: (hm.annualized_return ?? 0) > 0 ? 'var(--green)' : 'var(--red)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
                <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ARBM Risk */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '6px' }}>
          ARBM Strategy — Risk Profile
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Original adaptive regression breakout strategy
        </div>

        <RiskGauge value={am.sharpe_annualized ?? 0} max={3} label="Annualized Sharpe" color={(am.sharpe_annualized ?? 0) > 1 ? 'var(--green)' : (am.sharpe_annualized ?? 0) > 0 ? 'var(--amber)' : 'var(--red)'} />
        <RiskGauge value={am.sortino ?? 0} max={3} label="Sortino Ratio" color={(am.sortino ?? 0) > 1 ? 'var(--green)' : 'var(--text-secondary)'} />
        <RiskGauge value={Math.abs(am.max_drawdown ?? 0)} max={50} label="Max Drawdown" color="var(--red)" />
        <RiskGauge value={am.win_rate ?? 0} max={100} label="Win Rate %" color={(am.win_rate ?? 0) >= 50 ? 'var(--green)' : 'var(--red)'} />

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { label: 'Profit Factor', value: (am.profit_factor ?? 0).toFixed(3), color: (am.profit_factor ?? 0) > 1 ? 'var(--green)' : 'var(--red)' },
              { label: 'Total Trades', value: String(am.total_trades ?? 0), color: 'var(--text-primary)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
                <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk disclaimer */}
      <div style={{ gridColumn: '1 / -1', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '14px 18px', fontSize: '12px', color: 'var(--text-muted)' }}>
        <strong style={{ color: 'var(--amber)' }}>⚠ Risk Disclaimer:</strong> All metrics are derived from historical backtesting with transaction costs included (0.1% per leg + 0.05% slippage). Backtested performance does not guarantee future results. This platform is for quantitative research and paper trading only. No real money execution.
      </div>
    </div>
  );
}
