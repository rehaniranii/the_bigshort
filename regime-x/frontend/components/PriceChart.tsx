'use client';

import { useState, useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Scatter,
} from 'recharts';
import { ChartBar } from '@/lib/api';

const REGIME_COLORS: Record<number, string> = {
  0: '#10b981', 1: '#3b82f6', 2: '#f59e0b', 3: '#ef4444',
};

interface Props {
  chartData: ChartBar[];
  ticker: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as ChartBar;
  if (!d) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: '10px', padding: '12px 16px', fontSize: '12px',
    }}>
      <div style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>{d.date}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', color: 'var(--text-secondary)' }}>
        <span>Open</span><span className="mono" style={{ color: 'var(--text-primary)' }}>{d.open?.toFixed(2)}</span>
        <span>High</span><span className="mono" style={{ color: 'var(--green)' }}>{d.high?.toFixed(2)}</span>
        <span>Low</span><span className="mono" style={{ color: 'var(--red)' }}>{d.low?.toFixed(2)}</span>
        <span>Close</span><span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{d.close?.toFixed(2)}</span>
        {d.reg_basis && <><span>Reg Mid</span><span className="mono">{d.reg_basis?.toFixed(2)}</span></>}
        <span>P(UP)</span><span className="mono" style={{ color: d.prob_up > 0.5 ? 'var(--green)' : 'var(--red)' }}>{(d.prob_up * 100).toFixed(1)}%</span>
        <span>Regime</span><span style={{ color: REGIME_COLORS[d.regime] }}>{d.regime_label}</span>
      </div>
      {d.is_squeeze && <div style={{ marginTop: '6px', color: 'var(--amber)', fontWeight: 600, fontSize: '11px' }}>● SQUEEZE</div>}
      {d.bull_trigger && <div style={{ marginTop: '4px', color: 'var(--green)', fontWeight: 700, fontSize: '11px' }}>▲ BULL BREAKOUT</div>}
      {d.bear_trigger && <div style={{ marginTop: '4px', color: 'var(--red)', fontWeight: 700, fontSize: '11px' }}>▼ BEAR BREAKOUT</div>}
    </div>
  );
};

export default function PriceChart({ chartData, ticker }: Props) {
  const [showReg, setShowReg] = useState(true);
  const [showBands, setShowBands] = useState(true);
  const [showSignals, setShowSignals] = useState(true);
  const [showProb, setShowProb] = useState(true);
  const [zoom, setZoom] = useState<number>(200);

  const sliced = useMemo(() => {
    return chartData.slice(-zoom);
  }, [chartData, zoom]);

  const toggleBtn = (active: boolean, label: string, onClick: () => void, color: string) => (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: '20px',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        background: active ? `${color}20` : 'transparent',
        color: active ? color : 'var(--text-muted)',
        fontSize: '11px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="glass-card" style={{ padding: '20px', marginBottom: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{ticker} — Price Chart</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Adaptive Regression Breakout Map</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {toggleBtn(showReg, 'Reg Mid', () => setShowReg(!showReg), 'var(--blue)')}
          {toggleBtn(showBands, 'Bands', () => setShowBands(!showBands), 'var(--purple)')}
          {toggleBtn(showSignals, 'Signals', () => setShowSignals(!showSignals), 'var(--green)')}
          {toggleBtn(showProb, 'ML Prob', () => setShowProb(!showProb), 'var(--amber)')}
          <select
            className="select-dark"
            value={zoom}
            onChange={e => setZoom(+e.target.value)}
            style={{ width: '90px', fontSize: '12px' }}
          >
            <option value={50}>50 bars</option>
            <option value={100}>100 bars</option>
            <option value={200}>200 bars</option>
            <option value={500}>500 bars</option>
          </select>
        </div>
      </div>

      {/* Main Chart */}
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={sliced} margin={{ top: 10, right: 40, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            interval={Math.floor(sliced.length / 8)}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={60}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Regression bands area fill */}
          {showBands && (
            <>
              <Area dataKey="upper_band" fill="url(#bandGrad)" stroke="#8b5cf6" strokeWidth={1} strokeDasharray="4 2" dot={false} />
              <Area dataKey="lower_band" fill="url(#bandGrad)" stroke="#8b5cf6" strokeWidth={1} strokeDasharray="4 2" dot={false} />
            </>
          )}

          {/* Price close line */}
          <Line type="monotone" dataKey="close" stroke="#e2e8f0" strokeWidth={1.5} dot={false} />

          {/* Regression midline */}
          {showReg && (
            <Line type="monotone" dataKey="reg_basis" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="6 2" />
          )}

          {/* Bull/Bear signals as scatter */}
          {showSignals && (
            <>
              <Scatter
                data={sliced.filter(d => d.bull_trigger).map(d => ({ ...d, signalY: d.low * 0.995 }))}
                dataKey="signalY"
                fill="#10b981"
                shape={({ cx, cy }: any) => (
                  <text x={cx} y={cy} textAnchor="middle" fontSize={14} fill="#10b981">▲</text>
                )}
              />
              <Scatter
                data={sliced.filter(d => d.bear_trigger).map(d => ({ ...d, signalY: d.high * 1.005 }))}
                dataKey="signalY"
                fill="#ef4444"
                shape={({ cx, cy }: any) => (
                  <text x={cx} y={cy} textAnchor="middle" fontSize={14} fill="#ef4444">▼</text>
                )}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* ML Probability sub-chart */}
      {showProb && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ML Probability P(UP)
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <ComposedChart data={sliced} margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis domain={[0, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} width={40} />
              <ReferenceLine y={0.5} stroke="#475569" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="prob_up" stroke="var(--amber)" fill="var(--amber-glow)" strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '14px', flexWrap: 'wrap' }}>
        {[
          { color: '#e2e8f0', label: 'Price' },
          { color: '#3b82f6', label: 'Regression Mid' },
          { color: '#8b5cf6', label: 'Dev Bands' },
          { color: '#10b981', label: '▲ Breakout Long' },
          { color: '#ef4444', label: '▼ Breakout Short' },
          { color: '#f59e0b', label: 'ML P(UP)' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span style={{ width: '12px', height: '3px', background: color, borderRadius: '2px', display: 'inline-block' }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
