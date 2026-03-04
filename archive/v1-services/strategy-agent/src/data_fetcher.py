import asyncio
import logging
import os
from datetime import datetime, timedelta

import pandas as pd

logger = logging.getLogger(__name__)

CACHE_DIR = "/tmp/strategy_data_cache"


async def fetch_historical_data(
    ticker: str,
    period_years: int = 2,
    interval: str = "1d",
) -> pd.DataFrame:
    """Fetch historical OHLCV data using yfinance, with filesystem cache."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_key = f"{ticker}_{period_years}y_{interval}"
    cache_path = os.path.join(CACHE_DIR, f"{cache_key}.parquet")

    if os.path.exists(cache_path):
        mtime = datetime.fromtimestamp(os.path.getmtime(cache_path))
        if datetime.now() - mtime < timedelta(hours=6):
            logger.info("Loading cached data for %s", ticker)
            return pd.read_parquet(cache_path)

    def _download():
        import yfinance as yf
        end = datetime.now()
        start = end - timedelta(days=period_years * 365)
        data = yf.download(ticker, start=start, end=end, interval=interval, progress=False)
        return data

    logger.info("Downloading %d years of %s data for %s", period_years, interval, ticker)
    df = await asyncio.to_thread(_download)

    if df.empty:
        logger.warning("No data returned for %s", ticker)
        return df

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df = df.reset_index()
    df.columns = [c.lower() for c in df.columns]

    try:
        df.to_parquet(cache_path)
    except Exception:
        logger.warning("Failed to cache data for %s", ticker)

    return df
