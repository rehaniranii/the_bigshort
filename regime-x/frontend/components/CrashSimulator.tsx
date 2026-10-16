'use client';

import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/lib/api';

const SCENARIOS = [
  { name: 'COVID-19 Crash', period: 'Feb 2020 – Apr 2020', icon: '🦠', color: '#ef4444' },
  { name: '2022 Rate Hike Selloff', period: 'Jan 2022 – Oct 2022', icon: '📉', color: '#f59e0b' },
  { name: '2018 Q4 Correction', period: 'Oct 2018 – Dec 2018', icon: '⬇', color: '#f97316' },
  { name: '2020 Recovery Rally', period: 'Apr 2020 – Aug 2020', icon: '🚀', color: '#10b981' },
];

interface Props {
  ticker: string;
}

export default function CrashSimulator({ ticker }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.stressTest(ticker, selected);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '24px', marginBottom: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <div style={{
          width: '48px', height: '48px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid var(--red)',
          borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '24px',
          boxShadow: '0 0 20px rgba(239,68,68,0.2)',
        }}>⚡</div>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--red)', letterSpacing: '0.5px' }}>
            CRASH SIMULATION
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Replay historical stress periods on {ticker} — uses real historical data
          </div>
        </div>
      </div>

      {/* Scenario selection */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
        {SCENARIOS.map(scenario => (
          <button
            key={scenario.name}
            onClick={() => setSelected(scenario.name)}
            style={{
              padding: '14px 16px',
              background: selected === scenario.name ? `${scenario.color}15` : 'var(--bg-secondary)',
              border: `1px solid ${selected === scenario.name ? scenario.color : 'var(--border)'}`,
              borderRadius: '10px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              boxShadow: selected === scenario.name ? `0 0 15px ${scenario.color}30` : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: selected === scenario.name ? scenario.color : 'var(--text-primary)', marginBottom: '4px' }}>
                  {scenario.icon} {scenario.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{scenario.period}</div>
              </div>
              {selected === scenario.name && (
                <span style={{ fontSize: '16px', color: scenario.color }}>✓</span>
              )}
            </div>
          </button>
        ))}
      </div>

      <button
        className="btn-danger"
        onClick={runSimulation}
        disabled={!selected || loading}
        style={{ width: '100%', fontSize: '14px', padding: '12px' }}
      >
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span className="spin" style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
            Running simulation...
          </span>
        ) : `⚡ Simulate: ${selected || 'Select a scenario'}`}
      </button>

      {error && (
        <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)', borderRadius: '8px', fontSize: '13px', color: '#fca5a5' }}>
          ⚠ {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '20px' }} className="fade-in">
          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '14px' }}>
            {result.scenario.name} — Results for {result.ticker}
          </div>

          {/* Metric comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
            {[
              { label: 'Strategy Return', value: `${(result.metrics.total_return ?? 0).toFixed(2)}%`, color: (result.metrics.total_return ?? 0) > 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Buy & Hold', value: `${(result.buy_hold_return ?? 0).toFixed(2)}%`, color: (result.buy_hold_return ?? 0) > 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Max Drawdown', value: `${(result.metrics.max_drawdown ?? 0).toFixed(2)}%`, color: 'var(--red)' },
              { label: 'Trades', value: result.metrics.total_trades ?? 0, color: 'var(--text-secondary)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
                <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Equity curve */}
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={result.equity.map((v: number, i: number) => ({ i, equity: v }))} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="stressGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" vertical={false} />
              <XAxis dataKey="i" tick={false} axisLine={{ stroke: 'var(--border)' }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={65} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                formatter={(v: any) => [`$${Number(v ?? 0).toFixed(2)}`, 'Equity']}
              />
              <Area type="monotone" dataKey="equity" stroke="#ef4444" fill="url(#stressGrad)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>

          <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            ⚠ This simulation uses actual historical price data for the selected period. Results reflect the ARBM strategy response to real market conditions. Not indicative of future performance.
          </div>
        </div>
      )}
    </div>
  );
}
