"""
Data Pipeline — REGIME-X
Handles Yahoo Finance downloads, NSE tickers, caching, and CSV uploads.
"""

import os
import json
import hashlib
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional

try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False

CACHE_DIR = Path(__file__).parent.parent.parent / "data" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

SAMPLE_TICKERS_US = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "SPY", "QQQ",
]
SAMPLE_TICKERS_NSE = [
    "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS",
    "WIPRO.NS", "TATAMOTORS.NS", "NIFTY50.NS", "BAJFINANCE.NS",
]


def _cache_key(ticker: str, start: str, end: str) -> str:
    raw = f"{ticker}_{start}_{end}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def _cache_path(key: str) -> Path:
    return CACHE_DIR / f"{key}.parquet"


def load_ohlcv(
    ticker: str,
    start: str,
    end: Optional[str] = None,
    use_cache: bool = True,
) -> pd.DataFrame:
    """
    Download OHLCV data from Yahoo Finance with local disk caching.
    Falls back gracefully if yfinance unavailable.

    Returns DataFrame with columns: open, high, low, close, volume
    Index: DatetimeIndex
    """
    if end is None:
        end = datetime.today().strftime("%Y-%m-%d")

    key  = _cache_key(ticker, start, end)
    path = _cache_path(key)

    # Serve from cache if recent (< 1 hour old)
    if use_cache and path.exists():
        age = datetime.now().timestamp() - path.stat().st_mtime
        if age < 3600:
            df = pd.read_parquet(path)
            df.columns = [c.lower() for c in df.columns]
            return df

    if not YFINANCE_AVAILABLE:
        raise RuntimeError("yfinance not installed. Install with: pip install yfinance")

    ticker_obj = yf.Ticker(ticker)
    raw = ticker_obj.history(start=start, end=end, auto_adjust=True)

    if raw.empty:
        raise ValueError(f"No data returned for ticker '{ticker}'. Check ticker symbol.")

    df = raw[['Open', 'High', 'Low', 'Close', 'Volume']].copy()
    df.columns = ['open', 'high', 'low', 'close', 'volume']
    df.index.name = 'date'
    df = df.dropna(subset=['close'])
    df.to_parquet(path)
    return df


def load_from_csv(filepath: str) -> pd.DataFrame:
    """
    Load OHLCV data from a CSV file.
    Expects columns: date, open, high, low, close (and optionally volume)
    """
    df = pd.read_csv(filepath)
    df.columns = [c.lower().strip() for c in df.columns]

    # Try to parse date column
    date_cols = [c for c in df.columns if 'date' in c or 'time' in c]
    if date_cols:
        df['date'] = pd.to_datetime(df[date_cols[0]])
        df = df.set_index('date').sort_index()

    required = ['open', 'high', 'low', 'close']
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"CSV missing required columns: {missing}")

    if 'volume' not in df.columns:
        df['volume'] = np.nan

    return df[['open', 'high', 'low', 'close', 'volume']].dropna(subset=['close'])


def get_current_price(ticker: str) -> dict:
    """Returns latest price info for a ticker."""
    if not YFINANCE_AVAILABLE:
        return {"price": None, "change_pct": None, "error": "yfinance not available"}

    try:
        t = yf.Ticker(ticker)
        info = t.fast_info
        price = info.last_price
        prev  = info.previous_close
        change_pct = (price - prev) / prev * 100 if prev else 0
        return {
            "ticker":     ticker,
            "price":      round(float(price), 2),
            "prev_close": round(float(prev), 2),
            "change_pct": round(float(change_pct), 2),
            "currency":   info.currency,
            "timestamp":  datetime.now().isoformat(),
        }
    except Exception as e:
        return {"ticker": ticker, "price": None, "error": str(e)}


def generate_sample_data(n: int = 500, seed: int = 42) -> pd.DataFrame:
    """
    Generate synthetic OHLCV data for offline demonstration.
    Uses geometric Brownian motion with volatility clustering.
    Clearly labeled as synthetic — not real market data.
    """
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range(
        end=datetime.today(),
        periods=n,
    )

    # GBM parameters
    mu    = 0.0003
    sigma = 0.015
    price = 100.0
    prices = [price]

    # Volatility clustering (GARCH-like)
    vol = sigma
    for i in range(1, n):
        shock = rng.normal(0, 1)
        vol   = 0.9 * vol + 0.1 * sigma * abs(shock)
        ret   = mu + vol * shock
        price = prices[-1] * np.exp(ret)
        prices.append(price)

    prices = np.array(prices)

    # Simulate OHLCV
    noise  = rng.uniform(0.995, 1.005, n)
    opens  = prices * noise
    highs  = prices * rng.uniform(1.000, 1.015, n)
    lows   = prices * rng.uniform(0.985, 1.000, n)
    closes = prices
    vols   = rng.integers(100_000, 10_000_000, n).astype(float)

    df = pd.DataFrame({
        'open':   opens,
        'high':   highs,
        'low':    lows,
        'close':  closes,
        'volume': vols,
    }, index=dates)
    df.index.name = 'date'

    # Inject some crash periods for stress testing
    crash_start = int(n * 0.6)
    crash_end   = int(n * 0.65)
    df.iloc[crash_start:crash_end, df.columns.get_loc('close')] *= np.linspace(1.0, 0.80, crash_end - crash_start)

    return df


def get_sample_tickers() -> dict:
    return {
        "US": SAMPLE_TICKERS_US,
        "NSE": SAMPLE_TICKERS_NSE,
    }
