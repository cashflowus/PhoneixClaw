"""Market data and sentiment analysis tools."""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx

from . import register_tool

logger = logging.getLogger(__name__)

API_GATEWAY_URL = os.getenv("API_GATEWAY_URL", "http://api-gateway:8000")


@register_tool(
    name="fetch_market_data",
    description="Gets recent price data, volume, moving averages, and technical indicators for a ticker",
    parameters={
        "ticker": "string (e.g. 'AAPL')",
        "days": "int (default: 30)",
    },
)
async def fetch_market_data(params: dict) -> dict:
    ticker = params.get("ticker", "SPY").upper()
    days = int(params.get("days", 30))

    def _fetch():
        import yfinance as yf
        end = datetime.now()
        start = end - timedelta(days=days)
        df = yf.download(ticker, start=start, end=end, interval="1d", progress=False)
        if df.empty:
            return None
        if hasattr(df.columns, "levels"):
            df.columns = df.columns.get_level_values(0)
        df = df.reset_index()
        return df

    df = await asyncio.to_thread(_fetch)
    if df is None:
        return {"error": f"No market data found for {ticker}"}

    close_prices = df["Close"].tolist()
    volumes = df["Volume"].tolist()

    current_price = close_prices[-1] if close_prices else 0
    prev_price = close_prices[-2] if len(close_prices) >= 2 else current_price
    day_change_pct = ((current_price - prev_price) / prev_price * 100) if prev_price else 0

    sma_20 = sum(close_prices[-20:]) / min(len(close_prices), 20) if close_prices else 0
    sma_50 = sum(close_prices[-50:]) / min(len(close_prices), 50) if close_prices else 0
    avg_volume = sum(volumes[-20:]) / min(len(volumes), 20) if volumes else 0

    high_52w = max(close_prices) if close_prices else 0
    low_52w = min(close_prices) if close_prices else 0

    return {
        "ticker": ticker,
        "current_price": round(current_price, 2),
        "day_change_pct": round(day_change_pct, 2),
        "sma_20": round(sma_20, 2),
        "sma_50": round(sma_50, 2),
        "avg_volume": int(avg_volume),
        "high": round(high_52w, 2),
        "low": round(low_52w, 2),
        "data_points": len(close_prices),
        "period_days": days,
        "trend": "bullish" if current_price > sma_20 > sma_50 else
                 "bearish" if current_price < sma_20 < sma_50 else "neutral",
    }


@register_tool(
    name="analyze_sentiment",
    description="Analyzes market sentiment from Discord messages and news for a ticker using the platform's sentiment pipeline",
    parameters={"ticker": "string (e.g. 'AAPL')"},
)
async def analyze_sentiment(params: dict) -> dict:
    ticker = params.get("ticker", "SPY").upper()

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{API_GATEWAY_URL}/api/v1/sentiment/tickers",
                params={"tickers": ticker},
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and data:
                    s = data[0]
                    return {
                        "ticker": ticker,
                        "sentiment_label": s.get("sentiment_label", "neutral"),
                        "sentiment_score": s.get("sentiment_score", 0.0),
                        "message_count": s.get("message_count", 0),
                        "bullish_count": s.get("bullish_count", 0),
                        "bearish_count": s.get("bearish_count", 0),
                        "neutral_count": s.get("neutral_count", 0),
                        "source": "discord_pipeline",
                    }
    except Exception as e:
        logger.warning("Sentiment API unavailable for %s: %s", ticker, e)

    return {
        "ticker": ticker,
        "sentiment_label": "unavailable",
        "sentiment_score": 0.0,
        "message_count": 0,
        "source": "none",
        "note": "Sentiment pipeline not available. Connect Discord data sources to enable real sentiment.",
    }


@register_tool(
    name="analyze_portfolio",
    description="Checks current portfolio positions, exposure, buying power, and P&L from connected trading accounts",
    parameters={},
)
async def analyze_portfolio(params: dict) -> dict:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{API_GATEWAY_URL}/api/v1/positions")
            if resp.status_code == 200:
                positions = resp.json()
                if isinstance(positions, list):
                    total_value = sum(
                        float(p.get("market_value", 0)) for p in positions
                    )
                    total_pnl = sum(
                        float(p.get("unrealized_pl", 0)) for p in positions
                    )
                    return {
                        "position_count": len(positions),
                        "total_market_value": round(total_value, 2),
                        "total_unrealized_pnl": round(total_pnl, 2),
                        "positions": [
                            {
                                "symbol": p.get("symbol"),
                                "qty": p.get("qty"),
                                "market_value": p.get("market_value"),
                                "unrealized_pl": p.get("unrealized_pl"),
                                "side": p.get("side"),
                            }
                            for p in positions[:10]
                        ],
                        "source": "broker",
                    }
    except Exception as e:
        logger.warning("Portfolio API unavailable: %s", e)

    return {
        "position_count": 0,
        "positions": [],
        "source": "none",
        "note": "No trading accounts connected. Add a trading account to see portfolio data.",
    }
