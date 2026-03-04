"""
On-Chain/Flow API routes: whale alerts, Mag 7, meme stocks, sectors, indices, flow monitor agent.
"""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v2/onchain-flow", tags=["onchain-flow"])


class DeployFlowMonitorBody(BaseModel):
    instance_id: str = "inst-1"
    watched_tickers: list[str] = []
    min_premium: int = 500000
    min_size: int = 100


@router.get("/whale-alerts")
async def get_whale_alerts():
    """Return recent whale alerts."""
    return [
        {"timestamp": "2025-03-03T14:32:00Z", "ticker": "NVDA", "type": "CALL", "size": 500, "premium": 2400000, "sentiment": "BULLISH", "exchange": "CBOE"},
        {"timestamp": "2025-03-03T14:28:00Z", "ticker": "SPY", "type": "PUT", "size": 1200, "premium": 1800000, "sentiment": "BEARISH", "exchange": "PHLX"},
        {"timestamp": "2025-03-03T14:25:00Z", "ticker": "AAPL", "type": "STOCK", "size": 25000, "premium": 4500000, "sentiment": "BULLISH", "exchange": "DARK"},
        {"timestamp": "2025-03-03T14:20:00Z", "ticker": "TSLA", "type": "PUT", "size": 800, "premium": 1200000, "sentiment": "BEARISH", "exchange": "CBOE"},
        {"timestamp": "2025-03-03T14:15:00Z", "ticker": "AMZN", "type": "CALL", "size": 600, "premium": 3100000, "sentiment": "BULLISH", "exchange": "ISE"},
    ]


@router.get("/mag7")
async def get_mag7_flow():
    """Return Mag 7 flow data."""
    return {
        "tickers": [
            {"ticker": "AAPL", "whale_trades": ["$12M call sweep 180C", "$8M put block 175P"], "call_put_ratio": 1.42, "dark_pool_pct": 35, "institutional_flow": "ACCUMULATING"},
            {"ticker": "MSFT", "whale_trades": ["$15M call block 420C"], "call_put_ratio": 1.85, "dark_pool_pct": 42, "institutional_flow": "ACCUMULATING"},
            {"ticker": "GOOGL", "whale_trades": ["$6M put sweep 150P"], "call_put_ratio": 0.92, "dark_pool_pct": 31, "institutional_flow": "NEUTRAL"},
            {"ticker": "AMZN", "whale_trades": ["$22M call block 185C"], "call_put_ratio": 2.1, "dark_pool_pct": 45, "institutional_flow": "ACCUMULATING"},
            {"ticker": "META", "whale_trades": ["$9M put block 480P"], "call_put_ratio": 1.12, "dark_pool_pct": 38, "institutional_flow": "NEUTRAL"},
            {"ticker": "NVDA", "whale_trades": ["$45M call sweep 900C"], "call_put_ratio": 2.8, "dark_pool_pct": 52, "institutional_flow": "ACCUMULATING"},
            {"ticker": "TSLA", "whale_trades": ["$14M put sweep 240P"], "call_put_ratio": 0.78, "dark_pool_pct": 41, "institutional_flow": "DISTRIBUTING"},
        ]
    }


@router.get("/meme")
async def get_meme_flow():
    """Return meme stock flow with social sentiment."""
    return {
        "tickers": [
            {"ticker": "GME", "whale_trades": ["$3.2M call sweep 28C"], "call_put_ratio": 1.65, "dark_pool_pct": 28, "institutional_flow": "NEUTRAL", "social_sentiment": 78},
            {"ticker": "AMC", "whale_trades": ["$1.8M put block 4P"], "call_put_ratio": 0.85, "dark_pool_pct": 22, "institutional_flow": "DISTRIBUTING", "social_sentiment": 45},
            {"ticker": "BBBY", "whale_trades": ["$0.5M call sweep"], "call_put_ratio": 1.2, "dark_pool_pct": 18, "institutional_flow": "NEUTRAL", "social_sentiment": 62},
        ]
    }


@router.get("/sectors")
async def get_sector_flow():
    """Return sector flow with net direction and top movers."""
    return {
        "sectors": [
            {"sector": "Technology", "net_direction": "ACCUMULATING", "top_movers": [{"ticker": "NVDA", "flow_pct": 12.4}, {"ticker": "AMD", "flow_pct": 8.2}]},
            {"sector": "Healthcare", "net_direction": "NEUTRAL", "top_movers": [{"ticker": "PFE", "flow_pct": -2.1}, {"ticker": "JNJ", "flow_pct": 1.3}]},
            {"sector": "Energy", "net_direction": "DISTRIBUTING", "top_movers": [{"ticker": "XOM", "flow_pct": -4.2}, {"ticker": "CVX", "flow_pct": -2.8}]},
            {"sector": "Financials", "net_direction": "ACCUMULATING", "top_movers": [{"ticker": "JPM", "flow_pct": 5.1}, {"ticker": "BAC", "flow_pct": 3.2}]},
            {"sector": "Consumer", "net_direction": "NEUTRAL", "top_movers": [{"ticker": "AMZN", "flow_pct": 2.4}, {"ticker": "WMT", "flow_pct": -1.1}]},
        ]
    }


@router.get("/indices")
async def get_index_flow():
    """Return index flow with GEX, 0DTE volume, put/call skew, dark pool."""
    return {
        "indices": [
            {"symbol": "SPY", "gex_level": "$4.2B", "odte_volume": "2.1M", "put_call_skew": 1.12, "dark_pool_pct": 44},
            {"symbol": "QQQ", "gex_level": "$2.8B", "odte_volume": "1.8M", "put_call_skew": 1.08, "dark_pool_pct": 48},
            {"symbol": "IWM", "gex_level": "$0.6B", "odte_volume": "0.4M", "put_call_skew": 1.25, "dark_pool_pct": 35},
            {"symbol": "DIA", "gex_level": "$0.9B", "odte_volume": "0.3M", "put_call_skew": 1.15, "dark_pool_pct": 38},
        ]
    }


@router.post("/agent/create")
async def deploy_flow_monitor_agent(body: DeployFlowMonitorBody):
    """Deploy flow monitor agent to an instance."""
    return {"status": "deployed", "instance_id": body.instance_id, "agent": "flow-monitor"}
