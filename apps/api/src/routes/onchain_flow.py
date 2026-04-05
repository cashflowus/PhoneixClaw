"""
On-Chain/Flow API routes: whale alerts, Mag 7, meme stocks, sectors, indices.

Phoenix v3 — Live options flow data from Unusual Whales API.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Query

from shared.unusual_whales.client import UnusualWhalesClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v2/onchain-flow", tags=["onchain-flow"])

_uw = UnusualWhalesClient()

MAG7_TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA"]
MEME_TICKERS = ["GME", "AMC", "BBBY", "PLTR", "SOFI", "RIVN"]
INDEX_TICKERS = ["SPY", "QQQ", "IWM", "DIA"]
SECTOR_ETFS = {
    "Technology": "XLK", "Healthcare": "XLV", "Financials": "XLF",
    "Energy": "XLE", "Consumer Discretionary": "XLY", "Consumer Staples": "XLP",
    "Industrials": "XLI", "Materials": "XLB", "Utilities": "XLU",
    "Real Estate": "XLRE", "Communications": "XLC",
}


async def _get_ticker_flow_summary(ticker: str) -> dict:
    """Fetch flow for a single ticker and summarize."""
    flows = await _uw.get_options_flow(ticker, limit=30)
    if not flows:
        return {"ticker": ticker, "call_put_ratio": 0, "total_premium": 0, "sentiment": "NEUTRAL", "whale_trades": []}

    call_vol = sum(f.volume for f in flows if f.option_type == "CALL")
    put_vol = sum(f.volume for f in flows if f.option_type == "PUT")
    ratio = round(call_vol / put_vol, 2) if put_vol > 0 else (99.0 if call_vol > 0 else 0)
    total_premium = sum(f.premium or 0 for f in flows)

    bullish = sum(1 for f in flows if f.sentiment and f.sentiment.upper() == "BULLISH")
    bearish = sum(1 for f in flows if f.sentiment and f.sentiment.upper() == "BEARISH")
    if bullish > bearish * 1.5:
        inst_flow = "ACCUMULATING"
    elif bearish > bullish * 1.5:
        inst_flow = "DISTRIBUTING"
    else:
        inst_flow = "NEUTRAL"

    # Top whale trades (>$500k premium)
    whales = sorted(flows, key=lambda f: f.premium or 0, reverse=True)[:3]
    whale_strs = [
        f"${(f.premium or 0) / 1e6:.1f}M {f.option_type.lower()} {f.trade_type or 'block'} {f.strike}{f.option_type[0]}"
        for f in whales if (f.premium or 0) >= 500000
    ]

    return {
        "ticker": ticker,
        "call_put_ratio": ratio,
        "total_premium": total_premium,
        "institutional_flow": inst_flow,
        "whale_trades": whale_strs,
    }


@router.get("/whale-alerts")
async def get_whale_alerts(min_premium: int = Query(500000, ge=0)):
    """Recent large options trades (whale alerts) across all tickers."""
    flows = await _uw.get_options_flow(limit=100)
    whales = [f for f in flows if (f.premium or 0) >= min_premium]
    whales.sort(key=lambda f: f.premium or 0, reverse=True)

    return [
        {
            "timestamp": f.timestamp or datetime.now(timezone.utc).isoformat(),
            "ticker": f.ticker,
            "type": f.option_type,
            "strike": f.strike,
            "size": f.volume,
            "premium": f.premium,
            "sentiment": f.sentiment or "UNKNOWN",
            "trade_type": f.trade_type,
        }
        for f in whales[:20]
    ]


@router.get("/mag7")
async def get_mag7_flow():
    """Mag 7 options flow summary."""
    tickers = []
    for ticker in MAG7_TICKERS:
        summary = await _get_ticker_flow_summary(ticker)
        tickers.append(summary)
    return {"tickers": tickers}


@router.get("/meme")
async def get_meme_flow():
    """Meme stock options flow with institutional direction."""
    tickers = []
    for ticker in MEME_TICKERS:
        summary = await _get_ticker_flow_summary(ticker)
        tickers.append(summary)
    return {"tickers": tickers}


@router.get("/sectors")
async def get_sector_flow():
    """Sector flow via sector ETFs."""
    sectors = []
    for sector_name, etf in SECTOR_ETFS.items():
        summary = await _get_ticker_flow_summary(etf)
        sectors.append({
            "sector": sector_name,
            "etf": etf,
            "net_direction": summary["institutional_flow"],
            "call_put_ratio": summary["call_put_ratio"],
            "total_premium": summary["total_premium"],
        })
    return {"sectors": sectors}


@router.get("/indices")
async def get_index_flow():
    """Index flow with GEX and volume data."""
    indices = []
    for symbol in INDEX_TICKERS:
        gex = await _uw.get_gex(symbol)
        flows = await _uw.get_options_flow(symbol, limit=50)

        call_vol = sum(f.volume for f in flows if f.option_type == "CALL")
        put_vol = sum(f.volume for f in flows if f.option_type == "PUT")
        ratio = round(put_vol / call_vol, 2) if call_vol > 0 else 0

        indices.append({
            "symbol": symbol,
            "gex_total": gex.total_gex,
            "call_gex": gex.call_gex,
            "put_gex": gex.put_gex,
            "zero_gamma": gex.zero_gamma_level,
            "call_volume": call_vol,
            "put_volume": put_vol,
            "put_call_ratio": ratio,
        })
    return {"indices": indices}
