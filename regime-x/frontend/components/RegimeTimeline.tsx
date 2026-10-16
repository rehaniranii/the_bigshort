'use client';

import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, BarChart, Bar } from 'recharts';
import { ChartBar } from '@/lib/api';

const REGIME_COLORS: Record<number, string> = {
  0: '#10b981', 1: '#3b82f6', 2: '#f59e0b', 3: '#ef4444',
};
const REGIME_LABELS: Record<number, string> = {
  0: 'Low Vol', 1: 'Normal', 2: 'High Vol', 3: 'Extreme',
};

interface Props {
  chartData: ChartBar[];
  detailed?: boolean;
}

export default function RegimeTimeline({ chartData, detailed }: Props) {
  // Downsample for performance
  const data = useMemo(() => {
    const step = Math.max(1, Math.floor(chartData.length / 300));
    return chartData.filter((_, i) => i % step === 0);
  }, [chartData]);

  // Regime distribution
  const regimeDist = useMemo(() => {
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    chartData.forEach(d => counts[d.regime] = (counts[d.regime] || 0) + 1);
    return Object.entries(counts).map(([k, v]) => ({
      regime: REGIME_LABELS[+k],
      count: v,
      pct: +(v / chartData.length * 100).toFixed(1),
      color: REGIME_COLORS[+k],
    }));
  }, [chartData]);

  return (
    <div className="glass-card" style={{ padding: '20px', marginBottom: '20px' }}>
      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '6px' }}>
        Market Regime Timeline
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        4-regime classification: Low Volatility · Normal · High Volatility · Extreme/Crash
      </div>

      {/* Price + regime color bands */}
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 5, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval={Math.floor(data.length / 6)} />
          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={55} tickFormatter={v => `$${v.toFixed(0)}`} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
            formatter={(v: any, name: any) => [`$${Number(v ?? 0).toFixed(2)}`, String(name)]}
          />
          <Area type="monotone" dataKey="close" stroke="#e2e8f0" fill="rgba(226,232,240,0.05)" strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>

      {/* Regime strip */}
      <div style={{ height: '20px', display: 'flex', marginTop: '4px', borderRadius: '4px', overflow: 'hidden' }}>
        {data.map((d, i) => (
          <div
            key={i}
            title={`${d.date}: ${d.regime_label}`}
            style={{
              flex: 1,
              background: REGIME_COLORS[d.regime] || '#3b82f6',
              opacity: 0.75,
            }}
          />
        ))}
      </div>

      {/* Regime legend */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
        {Object.entries(REGIME_LABELS).map(([k, label]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: REGIME_COLORS[+k], display: 'inline-block' }} />
            {label}
          </div>
        ))}
      </div>

      {detailed && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
            Regime Distribution
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {regimeDist.map(({ regime, count, pct, color }) => (
              <div key={regime} style={{ flex: 1, padding: '14px', background: `${color}15`, border: `1px solid ${color}40`, borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace' }}>{pct}%</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{regime}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{count} bars</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
