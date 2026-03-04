"""
Risk Guardian API routes: status, position-limits, checks, compliance, hedging, agent create, circuit-breaker reset.

Phoenix v2 — Real-time risk monitoring from the Risk Guardian agent.
"""

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v2/risk", tags=["risk-compliance"])


class CreateAgentPayload(BaseModel):
    instance_id: str


_MOCK_STATUS = {
    "var": 12500,
    "dailyPnlPct": -0.8,
    "marginUsagePct": 45,
    "circuitBreaker": "NORMAL",
    "circuit": {
        "state": "NORMAL",
        "dailyLossPct": -1.2,
        "thresholdPct": -5,
        "confidence": 0.92,
        "consecutiveLosses": 0,
    },
}

_MOCK_POSITION_LIMITS = {
    "sectors": [
        {"name": "Technology", "exposure": 32, "max": 40},
        {"name": "Healthcare", "exposure": 18, "max": 25},
        {"name": "Financials", "exposure": 22, "max": 30},
        {"name": "Energy", "exposure": 8, "max": 15},
    ],
    "tickerConcentration": [
        {"ticker": "NVDA", "pct": 12},
        {"ticker": "AAPL", "pct": 8},
        {"ticker": "MSFT", "pct": 7},
    ],
    "marginUsagePct": 45,
}

_MOCK_CHECKS: list[dict[str, Any]] = [
    {"ts": datetime.now(timezone.utc).isoformat(), "symbol": "NVDA", "checkType": "position_limit", "result": "PASS", "reason": "Within limit"},
    {"ts": datetime.now(timezone.utc).isoformat(), "symbol": "TSLA", "checkType": "sector_exposure", "result": "WARN", "reason": "Tech at 38%"},
    {"ts": datetime.now(timezone.utc).isoformat(), "symbol": "SPY", "checkType": "daily_loss", "result": "BLOCK", "reason": "Would exceed -5% daily"},
]

_MOCK_COMPLIANCE: list[dict[str, Any]] = [
    {"id": "1", "type": "wash_sale", "message": "Wash sale: NVDA sold 3 days ago, similar lot", "severity": "High"},
    {"id": "2", "type": "pdt", "message": "PDT warning: 3 day trades this week", "severity": "Medium"},
]

_MOCK_HEDGING = {
    "blackSwanStatus": "ACTIVE",
    "protectivePuts": [{"symbol": "SPY", "strike": 450, "cost": 2.3, "qty": 10}],
    "hedgeCostPct": 0.8,
    "portfolioBeta": 1.12,
}


@router.get("/status")
async def get_status() -> dict:
    """Overall risk status and circuit breaker state."""
    return _MOCK_STATUS


@router.get("/position-limits")
async def get_position_limits() -> dict:
    """Sector and ticker exposure vs limits."""
    return _MOCK_POSITION_LIMITS


@router.get("/checks")
async def get_checks() -> list[dict[str, Any]]:
    """Recent risk check log."""
    return _MOCK_CHECKS


@router.get("/compliance")
async def get_compliance() -> list[dict[str, Any]]:
    """Compliance alerts: wash sale, PDT, agent conflict."""
    return _MOCK_COMPLIANCE


@router.get("/hedging")
async def get_hedging() -> dict:
    """Hedge status: black swan, protective puts, beta."""
    return _MOCK_HEDGING


@router.post("/agent/create")
async def create_agent(payload: CreateAgentPayload) -> dict:
    """Deploy Risk Guardian agent on specified instance."""
    return {"status": "created", "instance_id": payload.instance_id, "message": "Risk Guardian deployed"}


@router.post("/circuit-breaker/reset")
async def reset_circuit_breaker() -> dict:
    """Manual reset of circuit breaker."""
    return {"status": "reset", "message": "Circuit breaker reset"}
