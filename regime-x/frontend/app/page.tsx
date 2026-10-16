'use client';

import { useState, useCallback, useEffect } from 'react';
import { api, AnalysisResult, AnalysisRequest } from '@/lib/api';

// Components
import Navbar from '@/components/Navbar';
import ControlPanel from '@/components/ControlPanel';
import MarketOverview from '@/components/MarketOverview';
import PriceChart from '@/components/PriceChart';
import AIPredictionPanel from '@/components/AIPredictionPanel';
import StrategyPerformance from '@/components/StrategyPerformance';
import ModelIntelligence from '@/components/ModelIntelligence';
import RegimeTimeline from '@/components/RegimeTimeline';
import CrashSimulator from '@/components/CrashSimulator';
import RiskAnalytics from '@/components/RiskAnalytics';
import MultiStockPanel from '@/components/MultiStockPanel';
import LoadingOverlay from '@/components/LoadingOverlay';

type Tab = 'overview' | 'predictions' | 'regimes' | 'strategy' | 'backtesting' | 'risk';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');

  // Load sample demo on mount
  useEffect(() => {
    handleDemo();
  }, []);

  const handleDemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadingMsg('Loading sample data and running ML pipeline...');
    try {
      const data = await api.sampleDemo();
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load demo');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAnalyze = useCallback(async (req: AnalysisRequest) => {
    setLoading(true);
    setError(null);
    setLoadingMsg(`Fetching ${req.ticker} data and training models...`);
    try {
      const data = await api.analyze(req);
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview',    label: 'Overview',       icon: '◈' },
    { id: 'predictions', label: 'Predictions',    icon: '⬡' },
    { id: 'regimes',     label: 'Market Regimes', icon: '◉' },
    { id: 'strategy',    label: 'Strategy Lab',   icon: '⬟' },
    { id: 'backtesting', label: 'Backtesting',    icon: '◎' },
    { id: 'risk',        label: 'Risk Analytics', icon: '⊕' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />

      {loading && <LoadingOverlay message={loadingMsg} />}

      {/* Tab Bar */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        display: 'flex',
        gap: '4px',
        overflowX: 'auto',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '14px 20px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.3px',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--blue)' : '2px solid transparent',
            }}
          >
            <span style={{ marginRight: '6px', opacity: 0.7 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ padding: '20px 24px', maxWidth: '1600px', margin: '0 auto' }}>
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid var(--red)',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '20px',
            color: '#fca5a5',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>⚠ {error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px' }}>×</button>
          </div>
        )}

        {/* Control Panel always visible */}
        <ControlPanel onAnalyze={handleAnalyze} onDemo={handleDemo} loading={loading} />

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="fade-in">
            {result && <MarketOverview result={result} />}
            {result && <PriceChart chartData={result.chart_data} ticker={result.ticker} />}
            {result && <RegimeTimeline chartData={result.chart_data} />}
          </div>
        )}

        {activeTab === 'predictions' && (
          <div className="fade-in">
            {result && <AIPredictionPanel result={result} />}
            {result && <ModelIntelligence result={result} />}
          </div>
        )}

        {activeTab === 'regimes' && (
          <div className="fade-in">
            {result && <RegimeTimeline chartData={result.chart_data} detailed />}
            <CrashSimulator ticker={result?.ticker || 'AAPL'} />
          </div>
        )}

        {activeTab === 'strategy' && (
          <div className="fade-in">
            {result && <StrategyPerformance result={result} />}
          </div>
        )}

        {activeTab === 'backtesting' && (
          <div className="fade-in">
            {result && <StrategyPerformance result={result} showFull />}
          </div>
        )}

        {activeTab === 'risk' && (
          <div className="fade-in">
            {result && <RiskAnalytics result={result} />}
            <MultiStockPanel />
          </div>
        )}

        {!result && !loading && (
          <div style={{
            textAlign: 'center',
            padding: '80px 20px',
            color: 'var(--text-secondary)',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>◈</div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              REGIME-X Ready
            </div>
            <div>Select a ticker and click Analyze, or load the Sample Demo above.</div>
          </div>
        )}
      </div>
    </div>
  );
}
