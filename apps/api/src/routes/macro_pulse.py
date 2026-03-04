"""
Macro-Pulse API routes: regime, calendar, indicators, geopolitical, implications, agent create.

Phoenix v2 — Macro economic intelligence from the Macro-Pulse agent.
"""

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v2/macro-pulse", tags=["macro-pulse"])


class RegimeResponse(BaseModel):
    regime: str
    confidence: float
    updated_at: str


class CalendarEventResponse(BaseModel):
    id: str
    date: str
    event: str
    impact: str


class IndicatorResponse(BaseModel):
    name: str
    value: str
    trend: str | None = None


class GeopoliticalResponse(BaseModel):
    id: str
    title: str
    severity: str
    sectors: list[str]
    impact: str


class CreateAgentPayload(BaseModel):
    instance_id: str


# Mock data
_MOCK_REGIME = {
    "regime": "RISK-ON",
    "confidence": 0.82,
    "updated_at": datetime.now(timezone.utc).isoformat(),
}

_MOCK_CALENDAR: list[dict[str, Any]] = [
    {"id": "1", "date": "2025-03-12", "event": "FOMC Meeting", "impact": "HIGH"},
    {"id": "2", "date": "2025-03-13", "event": "CPI Release", "impact": "HIGH"},
    {"id": "3", "date": "2025-03-14", "event": "Jobs Report", "impact": "HIGH"},
    {"id": "4", "date": "2025-03-20", "event": "GDP Release", "impact": "MEDIUM"},
]

_MOCK_INDICATORS: list[dict[str, Any]] = [
    {"name": "CPI YoY", "value": "3.2%", "trend": "down"},
    {"name": "Unemployment", "value": "3.7%", "trend": "up"},
    {"name": "Fed Funds", "value": "4.50%", "trend": "neutral"},
    {"name": "10Y Yield", "value": "4.25%", "trend": "up"},
    {"name": "DXY", "value": "103.8", "trend": "down"},
    {"name": "Gold", "value": "$2,045", "trend": "up"},
]

_MOCK_GEOPOLITICAL: list[dict[str, Any]] = [
    {
        "id": "1",
        "title": "Middle East tensions",
        "severity": "High",
        "sectors": ["Energy", "Defense"],
        "impact": "Oil +5%, flight to safety",
    },
    {
        "id": "2",
        "title": "China trade policy",
        "severity": "Medium",
        "sectors": ["Tech", "Semiconductors"],
        "impact": "Supply chain volatility",
    },
]

_MOCK_IMPLICATIONS: list[str] = [
    "Avoid tech stocks today (Fed hawkish)",
    "Favor energy sector (geopolitical premium)",
    "Reduce duration in bonds (yield curve steepening)",
    "Gold as hedge (risk-off sentiment building)",
]


@router.get("/regime", response_model=RegimeResponse)
async def get_regime() -> RegimeResponse:
    """Current regime assessment."""
    return RegimeResponse(**_MOCK_REGIME)


@router.get("/calendar", response_model=list[CalendarEventResponse])
async def get_calendar() -> list[CalendarEventResponse]:
    """Economic calendar: FOMC, CPI, jobs, GDP."""
    return [CalendarEventResponse(**e) for e in _MOCK_CALENDAR]


@router.get("/indicators", response_model=list[IndicatorResponse])
async def get_indicators() -> list[IndicatorResponse]:
    """Economic indicators: CPI, unemployment, Fed funds, 10Y, DXY, gold."""
    return [IndicatorResponse(**i) for i in _MOCK_INDICATORS]


@router.get("/geopolitical", response_model=list[GeopoliticalResponse])
async def get_geopolitical() -> list[GeopoliticalResponse]:
    """Geopolitical risks with severity and market impact."""
    return [GeopoliticalResponse(**g) for g in _MOCK_GEOPOLITICAL]


@router.get("/implications")
async def get_implications() -> list[str]:
    """AI-generated trade implications."""
    return _MOCK_IMPLICATIONS


@router.post("/agent/create")
async def create_agent(payload: CreateAgentPayload) -> dict:
    """Create macro-pulse agent on specified instance."""
    return {
        "status": "created",
        "instance_id": payload.instance_id,
        "message": "Macro-Pulse agent created",
    }
