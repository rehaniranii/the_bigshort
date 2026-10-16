'use client';

import { AnalysisResult } from '@/lib/api';

const REGIME_CONFIG = {
  LOW_VOLATILITY:  { color: '#10b981', label: 'LOW VOL',  icon: '▾' },
  NORMAL:          { color: '#3b82f6', label: 'NORMAL',   icon: '◉' },
  HIGH_VOLATILITY: { color: '#f59e0b', label: 'HIGH VOL', icon: '▲' },
  EXTREME_CRASH:   { color: '#ef4444', label: 'EXTREME',  icon: '⚠' },
};

function MetricBox({ label, value, sub, color, glow }: { label: string; value: string; sub?: string; color?: string; glow?: string }) {
  return (
    <div className="metric-card" style={{ flex: 1, minWidth: '140px', ...(glow ? { boxShadow: `0 0 20px ${glow}` } : {}) }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: '24px', fontWeight: 700, color: color || 'var(--text-primary)', marginBottom: '2px' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

export default function MarketOverview({ result }: { result: AnalysisResult }) {
  const { latest_price, latest_prediction, position_signal, current_regime } = result;
  const regimeCfg = REGIME_CONFIG[current_regime.label as keyof typeof REGIME_CONFIG] || REGIME_CONFIG.NORMAL;
  const isUp = latest_prediction.direction === 'BULLISH';
  const posDir = position_signal.direction;

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Ticker header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>{result.ticker}</span>
            <span className="mono" style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              ${latest_price.close.toFixed(2)}
            </span>
            <span style={{
              fontSize: '16px',
              fontWeight: 600,
              color: latest_price.change_pct >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {latest_price.change_pct >= 0 ? '+' : ''}{latest_price.change_pct.toFixed(2)}%
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {result.date_range.start} → {result.date_range.end} · {result.data_points} bars
          </div>
        </div>

        {/* Key badges */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`badge ${isUp ? 'badge-bullish' : 'badge-bearish'}`}>
            {isUp ? '▲' : '▼'} {latest_prediction.direction}
          </span>
          <span className="badge" style={{ background: `${regimeCfg.color}20`, color: regimeCfg.color, border: `1px solid ${regimeCfg.color}` }}>
            {regimeCfg.icon} {regimeCfg.label}
          </span>
          <span className={`badge ${posDir === 'LONG' ? 'badge-bullish' : posDir === 'SHORT' ? 'badge-bearish' : 'badge-neutral'}`}>
            {posDir === 'LONG' ? '↑' : posDir === 'SHORT' ? '↓' : '—'} {posDir} {position_signal.position > 0 ? '+' : ''}{position_signal.position.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Metric row */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <MetricBox
          label="ML Confidence"
          value={`${latest_prediction.confidence.toFixed(1)}%`}
          sub={`P(UP) = ${(latest_prediction.prob_up * 100).toFixed(1)}%`}
          color={isUp ? 'var(--green)' : 'var(--red)'}
          glow={isUp ? 'var(--green-glow)' : 'var(--red-glow)'}
        />
        <MetricBox
          label="Position Signal"
          value={`${position_signal.position > 0 ? '+' : ''}${position_signal.position.toFixed(3)}`}
          sub={position_signal.direction}
          color={posDir === 'LONG' ? 'var(--green)' : posDir === 'SHORT' ? 'var(--red)' : 'var(--text-secondary)'}
        />
        <MetricBox
          label="Market Regime"
          value={regimeCfg.label}
          sub={`Vol pct: ${current_regime.vol_percentile.toFixed(0)}th`}
          color={regimeCfg.color}
        />
        <MetricBox
          label="Regime Vol Pct"
          value={`${current_regime.vol_percentile.toFixed(0)}th`}
          sub="Percentile rank"
          color={current_regime.vol_percentile > 80 ? 'var(--red)' : current_regime.vol_percentile > 60 ? 'var(--amber)' : 'var(--green)'}
        />
        <MetricBox
          label="Strategy Win Rate"
          value={`${result.arbm_backtest.metrics.win_rate ?? 0}%`}
          sub={`${result.arbm_backtest.trade_count} trades`}
          color={(result.arbm_backtest.metrics.win_rate ?? 0) >= 50 ? 'var(--green)' : 'var(--red)'}
        />
        <MetricBox
          label="ARBM Sharpe"
          value={`${result.arbm_backtest.metrics.sharpe_annualized ?? 0}`}
          sub="Annualized"
          color={(result.arbm_backtest.metrics.sharpe_annualized ?? 0) >= 1 ? 'var(--green)' : 'var(--text-secondary)'}
        />
      </div>

      {/* Signal explanation */}
      <div style={{
        marginTop: '14px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '12px 16px',
        fontSize: '13px',
        color: 'var(--text-secondary)',
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-start',
      }}>
        <span style={{ color: 'var(--blue)', fontWeight: 700 }}>⬡ Signal Rationale:</span>
        <span>{position_signal.reason}</span>
      </div>
    </div>
  );
}
