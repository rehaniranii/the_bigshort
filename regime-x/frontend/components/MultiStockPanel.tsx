'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

const DEFAULT_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'RELIANCE.NS', 'TCS.NS'];

interface ComparisonItem {
  ticker: string;
  latest_price?: number;
  return_1m?: number;
  regime?: number;
  regime_label?: string;
  realized_vol?: number;
  signal?: string;
  error?: string | null;
}

const REGIME_COLORS: Record<number, string> = {
  0: '#10b981',
  1: '#3b82f6',
  2: '#f59e0b',
  3: '#ef4444',
};

export default function MultiStockPanel() {
  const [tickers, setTickers] = useState<string[]>(['AAPL', 'MSFT', 'RELIANCE.NS']);
  const [inputTicker, setInputTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addTicker = () => {
    const t = inputTicker.trim().toUpperCase();
    if (!t) return;
    if (tickers.includes(t)) return;
    if (tickers.length >= 5) {
      setError('Maximum 5 tickers allowed for simultaneous comparison.');
      return;
    }
    setTickers([...tickers, t]);
    setInputTicker('');
    setError(null);
  };

  const removeTicker = (t: string) => {
    setTickers(tickers.filter(x => x !== t));
  };

  const runComparison = async () => {
    if (tickers.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res: any = await api.multiStock(tickers, '2023-01-01');
      setItems(res.comparison || []);
    } catch (e: any) {
      setError(e.message || 'Failed to compare stocks');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '20px', marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Multi-Stock Cross-Asset Comparison
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Compare regimes, realized volatility, and signals across US equities and Indian NSE tickers
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={runComparison}
          disabled={loading || tickers.length === 0}
          style={{ padding: '8px 16px', fontSize: '13px' }}
        >
          {loading ? 'Comparing...' : '▶ Compare Selected'}
        </button>
      </div>

      {/* Selected Tickers & Input */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
        {tickers.map(t => (
          <span
            key={t}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#93c5fd',
            }}
          >
            {t}
            <button
              onClick={() => removeTicker(t)}
              style={{
                background: 'none',
                border: 'none',
                color: '#60a5fa',
                cursor: 'pointer',
                padding: 0,
                fontSize: '14px',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </span>
        ))}

        <div style={{ display: 'inline-flex', gap: '6px' }}>
          <input
            className="input-dark"
            placeholder="Add ticker (e.g. SPY)"
            value={inputTicker}
            onChange={e => setInputTicker(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTicker()}
            style={{ width: '150px', padding: '6px 10px', fontSize: '12px' }}
          />
          <button
            onClick={addTicker}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            + Add
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)', borderRadius: '6px', color: '#fca5a5', fontSize: '12px', marginBottom: '16px' }}>
          ⚠ {error}
        </div>
      )}

      {/* Comparison Grid */}
      {items.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Ticker', 'Latest Price', '1M Return', 'Regime', 'Realized Vol', 'Signal'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.ticker} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {it.ticker}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className="mono">{it.latest_price != null ? `$${it.latest_price.toFixed(2)}` : '—'}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className="mono" style={{ color: (it.return_1m ?? 0) >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                      {it.return_1m != null ? `${it.return_1m > 0 ? '+' : ''}${it.return_1m.toFixed(2)}%` : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {it.regime_label ? (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: `${REGIME_COLORS[it.regime ?? 1]}20`,
                          color: REGIME_COLORS[it.regime ?? 1],
                          border: `1px solid ${REGIME_COLORS[it.regime ?? 1]}50`,
                        }}
                      >
                        {it.regime_label}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className="mono">{it.realized_vol != null ? `${it.realized_vol.toFixed(1)}%` : '—'}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '12px',
                        color: it.signal === 'BULLISH' ? 'var(--green)' : it.signal === 'BEARISH' ? 'var(--red)' : 'var(--text-muted)',
                      }}
                    >
                      {it.signal || 'NEUTRAL'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
