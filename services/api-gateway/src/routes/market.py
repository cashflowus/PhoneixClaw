"""
Market data endpoints for the Global Market Command Center.

All yfinance calls run via asyncio.to_thread with in-memory TTL caching
to avoid rate-limiting and keep response times low.
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta

from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/market", tags=["market"])

_cache: dict[str, tuple[float, object]] = {}
CACHE_TTL = 300  # 5 minutes


def _get_cached(key: str):
    entry = _cache.get(key)
    if entry and time.time() - entry[0] < CACHE_TTL:
        return entry[1]
    return None


def _set_cached(key: str, data: object):
    _cache[key] = (time.time(), data)


# ── Fear & Greed ──────────────────────────────────────────────────────────────

@router.get("/fear-greed")
async def fear_greed():
    cached = _get_cached("fear-greed")
    if cached:
        return cached

    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get("https://production.dataviz.cnn.io/index/fearandgreed/graphdata")
            if resp.status_code == 200:
                data = resp.json()
                fg = data.get("fear_and_greed", {})
                result = {
                    "score": fg.get("score", 50),
                    "rating": fg.get("rating", "Neutral"),
                    "previous_close": fg.get("previous_close", 50),
                    "one_week_ago": fg.get("previous_1_week", 50),
                    "one_month_ago": fg.get("previous_1_month", 50),
                    "one_year_ago": fg.get("previous_1_year", 50),
                    "timestamp": datetime.utcnow().isoformat(),
                }
                _set_cached("fear-greed", result)
                return result
    except Exception as e:
        logger.warning("Fear & Greed fetch failed: %s", e)

    fallback = {"score": 50, "rating": "Neutral", "timestamp": datetime.utcnow().isoformat(), "source": "fallback"}
    return fallback


# ── Mag 7 ─────────────────────────────────────────────────────────────────────

MAG7_TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"]

@router.get("/mag7")
async def mag7():
    cached = _get_cached("mag7")
    if cached:
        return cached

    def _fetch():
        import yfinance as yf
        data = []
        for ticker in MAG7_TICKERS:
            try:
                t = yf.Ticker(ticker)
                info = t.fast_info
                hist = t.history(period="2d")
                if len(hist) >= 2:
                    prev = hist["Close"].iloc[-2]
                    curr = hist["Close"].iloc[-1]
                    change_pct = ((curr - prev) / prev) * 100
                else:
                    curr = getattr(info, "last_price", 0) or 0
                    change_pct = 0
                data.append({
                    "ticker": ticker,
                    "price": round(float(curr), 2),
                    "change_pct": round(float(change_pct), 2),
                    "market_cap": getattr(info, "market_cap", 0) or 0,
                })
            except Exception:
                data.append({"ticker": ticker, "price": 0, "change_pct": 0, "market_cap": 0})
        return data

    result = await asyncio.to_thread(_fetch)
    _set_cached("mag7", result)
    return result


# ── Sector Performance ────────────────────────────────────────────────────────

SECTOR_ETFS = {
    "Technology": "XLK", "Financials": "XLF", "Healthcare": "XLV",
    "Energy": "XLE", "Consumer Disc.": "XLY", "Consumer Staples": "XLP",
    "Industrials": "XLI", "Materials": "XLB", "Real Estate": "XLRE",
    "Utilities": "XLU", "Communication": "XLC",
}

@router.get("/sectors")
async def sectors():
    cached = _get_cached("sectors")
    if cached:
        return cached

    def _fetch():
        import yfinance as yf
        data = []
        for name, etf in SECTOR_ETFS.items():
            try:
                hist = yf.Ticker(etf).history(period="2d")
                if len(hist) >= 2:
                    prev = hist["Close"].iloc[-2]
                    curr = hist["Close"].iloc[-1]
                    change_pct = ((curr - prev) / prev) * 100
                else:
                    curr, change_pct = 0, 0
                data.append({"sector": name, "etf": etf, "price": round(float(curr), 2), "change_pct": round(float(change_pct), 2)})
            except Exception:
                data.append({"sector": name, "etf": etf, "price": 0, "change_pct": 0})
        data.sort(key=lambda x: x["change_pct"], reverse=True)
        return data

    result = await asyncio.to_thread(_fetch)
    _set_cached("sectors", result)
    return result


# ── Top Movers ────────────────────────────────────────────────────────────────

@router.get("/top-movers")
async def top_movers():
    cached = _get_cached("top-movers")
    if cached:
        return cached

    def _fetch():
        import yfinance as yf
        watchlist = [
            "SPY", "QQQ", "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
            "AMD", "NFLX", "CRM", "COIN", "PLTR", "SOFI", "NIO", "RIVN", "BABA",
            "DIS", "JPM", "BA", "PYPL", "SQ", "ROKU", "SNAP",
        ]
        results = []
        for ticker in watchlist:
            try:
                hist = yf.Ticker(ticker).history(period="2d")
                if len(hist) >= 2:
                    prev = hist["Close"].iloc[-2]
                    curr = hist["Close"].iloc[-1]
                    change_pct = ((curr - prev) / prev) * 100
                    results.append({"ticker": ticker, "price": round(float(curr), 2), "change_pct": round(float(change_pct), 2)})
            except Exception:
                pass
        results.sort(key=lambda x: x["change_pct"], reverse=True)
        return {"gainers": results[:5], "losers": results[-5:][::-1]}

    result = await asyncio.to_thread(_fetch)
    _set_cached("top-movers", result)
    return result


# ── Bond Yields ───────────────────────────────────────────────────────────────

BOND_TICKERS = {"2Y": "^IRX", "5Y": "^FVX", "10Y": "^TNX", "30Y": "^TYX"}

@router.get("/bond-yields")
async def bond_yields():
    cached = _get_cached("bond-yields")
    if cached:
        return cached

    def _fetch():
        import yfinance as yf
        data = []
        for label, ticker in BOND_TICKERS.items():
            try:
                hist = yf.Ticker(ticker).history(period="5d")
                if not hist.empty:
                    curr = hist["Close"].iloc[-1]
                    prev = hist["Close"].iloc[-2] if len(hist) >= 2 else curr
                    data.append({
                        "maturity": label,
                        "yield_pct": round(float(curr), 3),
                        "change": round(float(curr - prev), 3),
                    })
            except Exception:
                data.append({"maturity": label, "yield_pct": 0, "change": 0})
        return data

    result = await asyncio.to_thread(_fetch)
    _set_cached("bond-yields", result)
    return result


# ── Market Breadth ────────────────────────────────────────────────────────────

@router.get("/breadth")
async def market_breadth():
    cached = _get_cached("breadth")
    if cached:
        return cached

    def _fetch():
        import yfinance as yf
        indices = {"S&P 500": "^GSPC", "Nasdaq": "^IXIC", "Dow Jones": "^DJI", "Russell 2000": "^RUT"}
        data = []
        for name, ticker in indices.items():
            try:
                hist = yf.Ticker(ticker).history(period="2d")
                if len(hist) >= 2:
                    prev = hist["Close"].iloc[-2]
                    curr = hist["Close"].iloc[-1]
                    change_pct = ((curr - prev) / prev) * 100
                    data.append({
                        "index": name, "ticker": ticker,
                        "price": round(float(curr), 2),
                        "change_pct": round(float(change_pct), 2),
                    })
            except Exception:
                data.append({"index": name, "ticker": ticker, "price": 0, "change_pct": 0})
        return data

    result = await asyncio.to_thread(_fetch)
    _set_cached("breadth", result)
    return result
