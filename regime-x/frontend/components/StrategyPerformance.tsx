'use client';

import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { AnalysisResult } from '@/lib/api';

interface Props {
  result: AnalysisResult;
  showFull?: boolean;
}

function MetricGrid({ metrics, label }: { metrics: Record<string, number>; label: string }) {
  const fields = [
    { key: 'total_return',     label: 'Total Return',    fmt: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`, color: (v: number) => v > 0 ? 'var(--green)' : 'var(--red)' },
    { key: 'annualized_return',label: 'Ann. Return',     fmt: (v: number) => `${v > 0 ? '+' : ''}${v?.toFixed(2) ?? '-'}%`, color: (v: number) => v > 0 ? 'var(--green)' : 'var(--red)' },
    { key: 'sharpe',           label: 'Sharpe',          fmt: (v: number) => v?.toFixed(3) ?? '-', color: (v: number) => v > 1 ? 'var(--green)' : v > 0 ? 'var(--amber)' : 'var(--red)' },
    { key: 'sortino',          label: 'Sortino',         fmt: (v: number) => v?.toFixed(3) ?? '-', color: (v: number) => v > 1 ? 'var(--green)' : 'var(--text-secondary)' },
    { key: 'max_drawdown',     label: 'Max DD',          fmt: (v: number) => `${v?.toFixed(2) ?? '-'}%`, color: (_: number) => 'var(--red)' },
    { key: 'win_rate',         label: 'Win Rate',        fmt: (v: number) => `${v?.toFixed(1) ?? '-'}%`, color: (v: number) => v >= 50 ? 'var(--green)' : 'var(--red)' },
    { key: 'profit_factor',    label: 'Profit Factor',   fmt: (v: number) => v?.toFixed(3) ?? '-', color: (v: number) => v > 1 ? 'var(--green)' : 'var(--red)' },
    { key: 'total_trades',     label: 'Trades',          fmt: (v: number) => String(v ?? 0), color: (_: number) => 'var(--text-primary)' },
  ];

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {fields.map(({ key, label, fmt, color }) => {
          const v = metrics[key];
          return (
            <div key={key} style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
              <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: v !== undefined ? color(v) : 'var(--text-muted)' }}>
                {v !== undefined ? fmt(v) : '—'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StrategyPerformance({ result, showFull }: Props) {
  const { arbm_backtest, hybrid_backtest, ml_only_backtest, buy_hold, out_of_sample_comparison } = result;

  // Build equity comparison data across all available strategies
  const maxLen = Math.max(
    hybrid_backtest.equity.length,
    buy_hold.equity.length,
    arbm_backtest.equity?.length ?? 0,
    ml_only_backtest?.equity?.length ?? 0,
  );

  const h0 = hybrid_backtest.equity[0] || 100_000;
  const b0 = buy_hold.equity[0] || 100_000;
  const a0 = arbm_backtest.equity?.[0] || 100_000;
  const m0 = ml_only_backtest?.equity?.[0] || 100_000;

  const equityNorm = Array.from({ length: maxLen }, (_, i) => ({
    idx: i,
    'Hybrid Strategy': hybrid_backtest.equity[i] ? (hybrid_backtest.equity[i] / h0) * 100 : null,
    'Buy & Hold': buy_hold.equity[i] ? (buy_hold.equity[i] / b0) * 100 : null,
    'ARBM Strategy': arbm_backtest.equity?.[i] ? (arbm_backtest.equity[i] / a0) * 100 : null,
    'ML-Only': ml_only_backtest?.equity?.[i] ? (ml_only_backtest.equity[i] / m0) * 100 : null,
  }));

  // 4-Strategy comparison table
  const comparison = [
    { name: 'Buy & Hold', ...(buy_hold.metrics ?? { total_return: buy_hold.total_return }) },
    { name: 'ARBM Strategy', ...arbm_backtest.metrics },
    { name: 'ML-Only (Directional)', ...(ml_only_backtest?.metrics ?? {}) },
    { name: 'Hybrid (ML+ARBM+Regime)', ...hybrid_backtest.metrics },
  ];

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Equity Curve */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}>
        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '6px' }}>
          4-Strategy Equity Comparison
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Normalized to 100 from starting capital ($100k). Includes transaction costs (0.1%) and slippage.
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={equityNorm} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" vertical={false} />
            <XAxis dataKey="idx" tick={false} axisLine={{ stroke: 'var(--border)' }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={50} tickFormatter={v => v.toFixed(0)} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
              formatter={(v: any, name: any) => [`${Number(v ?? 0).toFixed(2)}`, String(name)]}
            />
            <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)' }} />
            <Line type="monotone" dataKey="Hybrid Strategy" stroke="#3b82f6" strokeWidth={2.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="ARBM Strategy" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="ML-Only" stroke="#a855f7" strokeWidth={1.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="Buy & Hold" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Strategy comparison metrics */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}>
        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '16px' }}>
          Full-Period Strategy Performance Comparison
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Strategy', 'Total Return', 'Ann. Return', 'Sharpe', 'Sortino', 'Max DD', 'Win Rate'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row: any, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</td>
                  <td style={{ padding: '10px 12px' }}><span className="mono" style={{ color: (row.total_return ?? 0) >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{((row.total_return ?? 0) as number).toFixed(2)}%</span></td>
                  <td style={{ padding: '10px 12px' }}><span className="mono" style={{ color: (row.annualized_return ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>{row.annualized_return != null ? `${(row.annualized_return as number).toFixed(2)}%` : '—'}</span></td>
                  <td style={{ padding: '10px 12px' }}><span className="mono" style={{ color: 'var(--text-secondary)' }}>{row.sharpe != null ? (row.sharpe as number).toFixed(3) : row.sharpe_annualized != null ? (row.sharpe_annualized as number).toFixed(3) : '—'}</span></td>
                  <td style={{ padding: '10px 12px' }}><span className="mono" style={{ color: 'var(--text-secondary)' }}>{row.sortino != null ? (row.sortino as number).toFixed(3) : '—'}</span></td>
                  <td style={{ padding: '10px 12px' }}><span className="mono" style={{ color: 'var(--red)' }}>{row.max_drawdown != null ? `${(row.max_drawdown as number).toFixed(2)}%` : '—'}</span></td>
                  <td style={{ padding: '10px 12px' }}><span className="mono" style={{ color: 'var(--text-secondary)' }}>{row.win_rate != null ? `${(row.win_rate as number).toFixed(1)}%` : '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Out-of-sample test comparison if present */}
      {out_of_sample_comparison && (
        <div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#60a5fa' }}>
              Strict Out-of-Sample (OOS) Test Period Comparison
            </div>
            <span style={{ fontSize: '11px', color: '#93c5fd', background: 'rgba(59,130,246,0.15)', padding: '3px 8px', borderRadius: '6px' }}>
              UNSEEN TEST DATA ONLY
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Zero in-sample leakage: evaluated strictly on the out-of-sample test split with no prior model exposure.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Strategy', 'OOS Return', 'OOS Sharpe', 'OOS Max DD'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Buy & Hold', data: out_of_sample_comparison.buy_hold },
                  { name: 'ARBM Strategy', data: out_of_sample_comparison.arbm },
                  { name: 'ML-Only', data: out_of_sample_comparison.ml_only },
                  { name: 'Hybrid (ML+ARBM+Regime)', data: out_of_sample_comparison.hybrid },
                ].map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                    <td style={{ padding: '8px 12px' }}><span className="mono" style={{ color: (s.data?.total_return ?? 0) >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{s.data?.total_return != null ? `${s.data.total_return.toFixed(2)}%` : '—'}</span></td>
                    <td style={{ padding: '8px 12px' }}><span className="mono">{s.data?.sharpe != null ? s.data.sharpe.toFixed(3) : s.data?.sharpe_annualized != null ? s.data.sharpe_annualized.toFixed(3) : '—'}</span></td>
                    <td style={{ padding: '8px 12px' }}><span className="mono" style={{ color: 'var(--red)' }}>{s.data?.max_drawdown != null ? `${s.data.max_drawdown.toFixed(2)}%` : '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showFull && (
        <MetricGrid metrics={hybrid_backtest.metrics} label="Hybrid Strategy — Detailed Metrics" />
      )}
    </div>
  );
}
