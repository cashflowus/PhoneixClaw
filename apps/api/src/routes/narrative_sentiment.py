"""
Narrative Sentinel API routes: sentiment feed, fed-watch, social, earnings, analyst-moves, agent create.

Phoenix v2 — NLP-powered sentiment intelligence from the Narrative Sentinel agent.
"""

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v2/narrative", tags=["narrative-sentiment"])


class FeedItemResponse(BaseModel):
    id: str
    ts: str
    source: str
    headline: str
    score: float
    tickers: list[str]
    urgent: bool = False


class FedSpeakerResponse(BaseModel):
    id: str
    name: str
    date: str
    summary: str
    hawkish: float
    dovish: float


class CreateAgentPayload(BaseModel):
    instance_id: str


_MOCK_FEED: list[dict[str, Any]] = [
    {"id": "1", "ts": datetime.now(timezone.utc).isoformat(), "source": "Twitter", "headline": "Fed signals potential rate cut in Q2", "score": 0.42, "tickers": ["SPY", "QQQ"], "urgent": True},
    {"id": "2", "ts": datetime.now(timezone.utc).isoformat(), "source": "News", "headline": "CPI comes in below expectations", "score": 0.68, "tickers": ["TLT"], "urgent": False},
    {"id": "3", "ts": datetime.now(timezone.utc).isoformat(), "source": "Reddit", "headline": "WSB piling into NVDA calls", "score": -0.15, "tickers": ["NVDA"], "urgent": True},
]

_MOCK_METRICS = {
    "marketSentiment": 0.35,
    "fearGreed": 62,
    "twitterVelocity": 0.78,
    "newsSentimentAvg": 0.42,
}

_MOCK_FED: list[dict[str, Any]] = [
    {"id": "1", "name": "Jerome Powell", "date": "2025-03-15", "summary": "Data-dependent stance, no rush to cut", "hawkish": 0.6, "dovish": 0.2},
    {"id": "2", "name": "John Williams", "date": "2025-03-12", "summary": "Soft landing likely, inflation easing", "hawkish": 0.3, "dovish": 0.65},
]

_MOCK_SOCIAL = {
    "cashtags": ["$NVDA", "$TSLA", "$AAPL", "$META", "$GOOGL"],
    "wsbMomentum": ["GME", "AMC", "NVDA", "TSLA", "PLTR"],
    "heatmap": [
        {"ticker": "NVDA", "sentiment": 0.72},
        {"ticker": "TSLA", "sentiment": 0.45},
        {"ticker": "AAPL", "sentiment": 0.12},
    ],
}

_MOCK_EARNINGS: list[dict[str, Any]] = [
    {"ticker": "NVDA", "date": "2025-03-20", "expectation": 0.65, "postRisk": None},
    {"ticker": "ORCL", "date": "2025-03-18", "expectation": 0.22, "postRisk": "Transcript risk: cautious guidance"},
]

_MOCK_ANALYST: list[dict[str, Any]] = [
    {"ticker": "NVDA", "action": "Upgrade", "firm": "Goldman", "target": 950, "impact": "+3.2%"},
    {"ticker": "TSLA", "action": "Downgrade", "firm": "Morgan Stanley", "target": 180, "impact": "-2.1%"},
]


@router.get("/feed")
async def get_feed() -> dict:
    """Sentiment feed with scored headlines and metrics."""
    return {"items": _MOCK_FEED, "metrics": _MOCK_METRICS}


@router.get("/fed-watch")
async def get_fed_watch() -> list[FedSpeakerResponse]:
    """Upcoming Fed speakers and transcript summaries."""
    return [FedSpeakerResponse(**s) for s in _MOCK_FED]


@router.get("/social")
async def get_social() -> dict:
    """Social pulse: cashtags, WSB momentum, sentiment heatmap."""
    return _MOCK_SOCIAL


@router.get("/earnings")
async def get_earnings() -> list[dict[str, Any]]:
    """Earnings intelligence with sentiment expectation and post-earnings risk."""
    return _MOCK_EARNINGS


@router.get("/analyst-moves")
async def get_analyst_moves() -> list[dict[str, Any]]:
    """Recent analyst upgrades/downgrades with expected price impact."""
    return _MOCK_ANALYST


@router.post("/agent/create")
async def create_agent(payload: CreateAgentPayload) -> dict:
    """Deploy sentiment agent on specified instance."""
    return {"status": "created", "instance_id": payload.instance_id, "message": "Sentiment agent deployed"}
