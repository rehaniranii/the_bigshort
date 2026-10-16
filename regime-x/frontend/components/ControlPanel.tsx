'use client';

import { useState, useEffect } from 'react';
import { api, AnalysisRequest } from '@/lib/api';

const US_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 'AMZN', 'META', 'SPY', 'QQQ'];
const NSE_TICKERS = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'TATAMOTORS.NS'];

interface Props {
  onAnalyze: (req: AnalysisRequest) => void;
  onDemo: () => void;
  loading: boolean;
}

export default function ControlPanel({ onAnalyze, onDemo, loading }: Props) {
  const [ticker, setTicker] = useState('AAPL');
  const [customTicker, setCustomTicker] = useState('');
  const [start, setStart] = useState('2020-01-01');
  const [end, setEnd] = useState('');
  const [horizon, setHorizon] = useState(1);
  const [arbmLength, setArbmLength] = useState(50);
  const [devMult, setDevMult] = useState(2.0);
  const [advanced, setAdvanced] = useState(false);

  const effectiveTicker = customTicker.trim().toUpperCase() || ticker;

  const handleAnalyze = () => {
    onAnalyze({
      ticker: effectiveTicker,
      start,
      end: end || undefined,
      horizon,
      arbm_length: arbmLength,
      arbm_dev_mult: devMult,
    });
  };

  return (
    <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {/* Ticker Select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ticker</label>
          <select
            className="select-dark"
            value={ticker}
            onChange={e => { setTicker(e.target.value); setCustomTicker(''); }}
            style={{ width: '140px' }}
          >
            <optgroup label="US Markets">
              {US_TICKERS.map(t => <option key={t}>{t}</option>)}
            </optgroup>
            <optgroup label="NSE India">
              {NSE_TICKERS.map(t => <option key={t}>{t}</option>)}
            </optgroup>
          </select>
        </div>

        {/* Custom ticker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Custom</label>
          <input
            className="input-dark"
            placeholder="e.g. BAJFINANCE.NS"
            value={customTicker}
            onChange={e => setCustomTicker(e.target.value)}
            style={{ width: '150px' }}
          />
        </div>

        {/* Start date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>From</label>
          <input type="date" className="input-dark" value={start} onChange={e => setStart(e.target.value)} style={{ width: '140px' }} />
        </div>

        {/* End date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>To</label>
          <input type="date" className="input-dark" value={end} onChange={e => setEnd(e.target.value)} style={{ width: '140px' }} />
        </div>

        {/* Horizon */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Horizon (days)</label>
          <select className="select-dark" value={horizon} onChange={e => setHorizon(+e.target.value)} style={{ width: '100px' }}>
            {[1, 2, 3, 5, 10].map(h => <option key={h} value={h}>{h}d</option>)}
          </select>
        </div>

        {/* Reg Length */}
        {advanced && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reg Length</label>
              <input type="number" className="input-dark" value={arbmLength} onChange={e => setArbmLength(+e.target.value)} style={{ width: '90px' }} min={10} max={200} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dev Mult</label>
              <input type="number" className="input-dark" value={devMult} onChange={e => setDevMult(+e.target.value)} style={{ width: '80px' }} step={0.1} min={0.5} max={5} />
            </div>
          </>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={handleAnalyze} disabled={loading}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="spin" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
                Analyzing...
              </span>
            ) : '▶ Analyze'}
          </button>

          <button
            onClick={onDemo}
            disabled={loading}
            style={{
              background: 'rgba(139,92,246,0.15)',
              border: '1px solid var(--purple)',
              color: 'var(--purple)',
              borderRadius: '8px',
              padding: '10px 16px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            ⬡ Sample Demo
          </button>

          <button
            onClick={() => setAdvanced(!advanced)}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              borderRadius: '8px',
              padding: '10px 14px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            {advanced ? '− Less' : '+ ARBM Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
