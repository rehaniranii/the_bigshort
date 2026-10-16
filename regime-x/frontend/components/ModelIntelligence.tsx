'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AnalysisResult } from '@/lib/api';

export default function ModelIntelligence({ result }: { result: AnalysisResult }) {
  const { ml_results } = result;
  const { leaderboard, test_metrics, feature_importance, best_model } = ml_results;

  const fiData = Object.entries(feature_importance)
    .slice(0, 15)
    .map(([name, val]) => ({ name: name.replace(/_feat$/, ''), value: +(val * 100).toFixed(2) }))
    .reverse();

  const cm = test_metrics.confusion_matrix as number[][];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
      {/* Model Leaderboard */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '16px' }}>
          Model Leaderboard
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {leaderboard.map((model, i) => (
            <div
              key={model.model}
              style={{
                padding: '14px 16px',
                background: model.is_best ? 'rgba(59,130,246,0.08)' : 'var(--bg-secondary)',
                border: `1px solid ${model.is_best ? 'var(--blue)' : 'var(--border)'}`,
                borderRadius: '10px',
                boxShadow: model.is_best ? '0 0 15px rgba(59,130,246,0.15)' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: model.is_best ? 'var(--blue)' : 'var(--text-primary)' }}>
                    {i + 1}. {model.model}
                  </span>
                  {model.is_best && (
                    <span style={{
                      marginLeft: '8px', padding: '2px 8px', background: 'rgba(59,130,246,0.2)',
                      border: '1px solid var(--blue)', borderRadius: '10px', fontSize: '10px', color: 'var(--blue)', fontWeight: 600,
                    }}>SELECTED</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[
                  { label: 'Bal. Acc', value: model.balanced_accuracy, color: model.balanced_accuracy > 0.55 ? 'var(--green)' : 'var(--text-secondary)' },
                  { label: 'MCC', value: model.mcc, color: model.mcc > 0.1 ? 'var(--green)' : model.mcc > 0 ? 'var(--amber)' : 'var(--red)' },
                  { label: 'F1', value: model.f1, color: 'var(--text-secondary)' },
                  { label: 'ROC-AUC', value: model.roc_auc, color: model.roc_auc > 0.6 ? 'var(--green)' : 'var(--text-secondary)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
                    <div className="mono" style={{ fontSize: '14px', fontWeight: 700, color }}>{value.toFixed(4)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Test set metrics */}
        <div style={{ marginTop: '16px', padding: '14px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
            Final Test Set — {best_model}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {[
              { label: 'Accuracy', key: 'accuracy' },
              { label: 'Bal. Acc', key: 'balanced_accuracy' },
              { label: 'MCC', key: 'mcc' },
              { label: 'ROC-AUC', key: 'roc_auc' },
            ].map(({ label, key }) => (
              <div key={key} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
                <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--blue)' }}>
                  {((test_metrics[key] as number) || 0).toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Confusion Matrix */}
        {cm && cm.length === 2 && (
          <div style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Confusion Matrix (Test Set)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', maxWidth: '240px' }}>
              {[
                { label: 'TN', value: cm[0][0], color: '#10b981' },
                { label: 'FP', value: cm[0][1], color: '#ef4444' },
                { label: 'FN', value: cm[1][0], color: '#ef4444' },
                { label: 'TP', value: cm[1][1], color: '#10b981' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: 'center', padding: '10px', background: `${color}15`, border: `1px solid ${color}40`, borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
                  <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Feature Importance */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '6px' }}>
          Feature Importance
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Top 15 most predictive indicators for {best_model}
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={fiData} layout="vertical" margin={{ top: 0, right: 30, left: 100, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v.toFixed(1)}%`} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={95} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
              formatter={(v: any) => [`${Number(v ?? 0).toFixed(2)}%`, 'Importance']}
            />
            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
