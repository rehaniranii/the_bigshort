'use client';

import { AnalysisResult } from '@/lib/api';

function ProbabilityBar({ prob, label }: { prob: number; label: string }) {
  const pct = (prob * 100).toFixed(1);
  const isUp = label === 'UP';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <span>{label}</span>
        <span className="mono" style={{ color: isUp ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: isUp ? 'linear-gradient(90deg, #059669, #10b981)' : 'linear-gradient(90deg, #b91c1c, #ef4444)',
          borderRadius: '4px',
          transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  );
}

function PositionMeter({ position }: { position: number }) {
  const pct = Math.abs(position) * 100;
  const isLong = position > 0;
  const isNeutral = position === 0;

  return (
    <div style={{ margin: '20px 0' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
        Recommended Exposure
      </div>
      <div style={{ position: 'relative', height: '24px', background: 'var(--bg-secondary)', borderRadius: '12px', overflow: 'hidden' }}>
        {/* Center line */}
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', background: 'var(--border)', zIndex: 2 }} />

        {/* Fill */}
        {!isNeutral && (
          <div style={{
            position: 'absolute',
            height: '100%',
            width: `${pct / 2}%`,
            left: isLong ? '50%' : `${50 - pct / 2}%`,
            background: isLong
              ? 'linear-gradient(90deg, #059669, #10b981)'
              : 'linear-gradient(90deg, #ef4444, #b91c1c)',
            borderRadius: isLong ? '0 12px 12px 0' : '12px 0 0 12px',
          }} />
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
        <span>MAX SHORT -1.0</span>
        <span>NEUTRAL 0</span>
        <span>MAX LONG +1.0</span>
      </div>
      <div style={{ textAlign: 'center', marginTop: '8px' }}>
        <span className="mono" style={{
          fontSize: '32px',
          fontWeight: 800,
          color: isLong ? 'var(--green)' : isNeutral ? 'var(--text-secondary)' : 'var(--red)',
          textShadow: isLong ? '0 0 20px var(--green-glow)' : isNeutral ? 'none' : '0 0 20px var(--red-glow)',
        }}>
          {position > 0 ? '+' : ''}{position.toFixed(3)}
        </span>
      </div>
    </div>
  );
}

export default function AIPredictionPanel({ result }: { result: AnalysisResult }) {
  const { latest_prediction, position_signal, current_regime, ml_results } = result;
  const isUp = latest_prediction.direction === 'BULLISH';

  const REGIME_CFG: Record<string, { color: string; icon: string; desc: string }> = {
    LOW_VOLATILITY:  { color: '#10b981', icon: '▾', desc: 'Market is calm with low realized volatility' },
    NORMAL:          { color: '#3b82f6', icon: '◉', desc: 'Ordinary market conditions' },
    HIGH_VOLATILITY: { color: '#f59e0b', icon: '▲', desc: 'Elevated uncertainty — reduced exposure recommended' },
    EXTREME_CRASH:   { color: '#ef4444', icon: '⚠', desc: 'Extreme volatility or crash-like conditions' },
  };
  const rc = REGIME_CFG[current_regime.label] || REGIME_CFG.NORMAL;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
      {/* Left: Prediction */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px' }}>
          AI PREDICTION
        </div>

        {/* Direction */}
        <div style={{
          textAlign: 'center',
          padding: '24px',
          background: isUp ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
          borderRadius: '12px',
          border: `1px solid ${isUp ? 'var(--green)' : 'var(--red)'}`,
          marginBottom: '20px',
          boxShadow: isUp ? '0 0 30px var(--green-glow)' : '0 0 30px var(--red-glow)',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>{isUp ? '▲' : '▼'}</div>
          <div style={{
            fontSize: '28px',
            fontWeight: 800,
            color: isUp ? 'var(--green)' : 'var(--red)',
            letterSpacing: '2px',
          }}>
            {latest_prediction.direction}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Confidence: <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{latest_prediction.confidence.toFixed(1)}%</span>
          </div>
        </div>

        {/* Probability bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <ProbabilityBar prob={latest_prediction.prob_up} label="UP" />
          <ProbabilityBar prob={latest_prediction.prob_down} label="DOWN" />
        </div>

        {/* Disclaimer */}
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          ⚠ Probability is calibrated on historical data. Past model accuracy does not guarantee future performance.
          Best model: <span style={{ color: 'var(--blue)', fontWeight: 600 }}>{ml_results.best_model}</span>
        </div>
      </div>

      {/* Right: Position Signal */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px' }}>
          POSITION SIZING
        </div>

        <PositionMeter position={position_signal.position} />

        {/* Signal decomposition */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
          {[
            { label: 'ML Score', value: position_signal.ml_score.toFixed(3), color: 'var(--blue)', weight: '45%' },
            { label: 'ARBM Signal', value: position_signal.arbm_score.toFixed(3), color: 'var(--purple)', weight: '35%' },
            { label: 'Regime Scale', value: position_signal.regime_score.toFixed(3), color: 'var(--amber)', weight: '20%' },
          ].map(({ label, value, color, weight }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginRight: '8px' }}>{label}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({weight} weight)</span>
              </div>
              <span className="mono" style={{ fontSize: '14px', fontWeight: 700, color }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Regime status */}
        <div style={{
          marginTop: '14px',
          padding: '12px 14px',
          background: `${rc.color}10`,
          border: `1px solid ${rc.color}40`,
          borderRadius: '8px',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '18px', color: rc.color }}>{rc.icon}</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: rc.color, marginBottom: '2px' }}>
              {current_regime.label.replace('_', ' ')}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{rc.desc}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Regime cap: <span style={{ color: rc.color, fontWeight: 600 }}>×{position_signal.regime_cap}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
