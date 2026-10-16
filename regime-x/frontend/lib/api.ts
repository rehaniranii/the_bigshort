// API Client for REGIME-X backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface AnalysisRequest {
  ticker: string;
  start: string;
  end?: string;
  horizon?: number;
  arbm_length?: number;
  arbm_dev_mult?: number;
  arbm_sqz_len?: number;
  arbm_sqz_pct?: number;
  tp1_mult?: number;
  tp2_mult?: number;
  tp3_mult?: number;
  use_sample_data?: boolean;
}

export interface AnalysisResult {
  ticker: string;
  data_points: number;
  date_range: { start: string; end: string };
  latest_price: { close: number; change_pct: number };
  latest_prediction: {
    prob_up: number;
    prob_down: number;
    direction: string;
    confidence: number;
  };
  position_signal: {
    position: number;
    ml_score: number;
    arbm_score: number;
    regime_score: number;
    regime_cap: number;
    direction: string;
    reason: string;
  };
  current_regime: {
    id: number;
    label: string;
    color: string;
    vol_percentile: number;
  };
  ml_results: {
    best_model: string;
    test_metrics: Record<string, number | number[][]>;
    leaderboard: Array<{
      model: string;
      balanced_accuracy: number;
      mcc: number;
      f1: number;
      roc_auc: number;
      is_best: boolean;
    }>;
    feature_importance: Record<string, number>;
  };
  arbm_backtest: {
    metrics: Record<string, number>;
    trade_count: number;
    equity?: number[];
  };
  hybrid_backtest: {
    metrics: Record<string, number>;
    equity: number[];
  };
  ml_only_backtest?: {
    metrics: Record<string, number>;
    equity: number[];
  };
  buy_hold: {
    total_return: number;
    metrics?: Record<string, number>;
    equity: number[];
  };
  out_of_sample_comparison?: {
    buy_hold: Record<string, number>;
    arbm: Record<string, number>;
    ml_only: Record<string, number>;
    hybrid: Record<string, number>;
  };
  chart_data: ChartBar[];
}

export interface ChartBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  reg_basis: number | null;
  upper_band: number | null;
  lower_band: number | null;
  is_squeeze: boolean;
  bull_trigger: boolean;
  bear_trigger: boolean;
  regime: number;
  regime_label: string;
  prob_up: number;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'API error');
  }
  return res.json();
}

export const api = {
  analyze: (req: AnalysisRequest) =>
    apiFetch<AnalysisResult>('/api/analyze', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  sampleDemo: () =>
    apiFetch<AnalysisResult>('/api/sample-demo'),

  tickers: () =>
    apiFetch<{ US: string[]; NSE: string[] }>('/api/tickers'),

  stressPeriods: () =>
    apiFetch<Array<{ name: string; start: string; end: string; description: string }>>('/api/stress-periods'),

  stressTest: (ticker: string, scenario_name: string, initial_capital = 100000) =>
    apiFetch('/api/stress-test', {
      method: 'POST',
      body: JSON.stringify({ ticker, scenario_name, initial_capital }),
    }),

  multiStock: (tickers: string[], start: string, end?: string) =>
    apiFetch('/api/multi-stock', {
      method: 'POST',
      body: JSON.stringify({ tickers, start, end }),
    }),

  price: (ticker: string) =>
    apiFetch<{ price: number; change_pct: number; currency: string }>(`/api/price/${ticker}`),

  exportPredictions: (ticker: string) =>
    `${API_BASE}/api/export/predictions/${ticker}`,
};
