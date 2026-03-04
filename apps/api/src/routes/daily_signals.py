"""
Daily Signals API routes: list signals, pipeline status, deploy pipeline, signal detail.

Phoenix v2 — 3-agent pipeline (Research → Technical → Risk).
"""

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter(prefix="/api/v2/daily-signals", tags=["daily-signals"])


class SignalResponse(BaseModel):
    id: str
    time: str
    symbol: str
    direction: str
    confidence: float
    source_agent: str
    entry_price: float
    stop_loss: float
    take_profit: float
    risk_reward: float
    status: str
    research_note: str | None = None
    technical_chart_ref: str | None = None
    risk_analysis: str | None = None


class PipelineAgentResponse(BaseModel):
    id: str
    name: str
    status: str
    last_run: str
    signals_produced: int


class PipelineStatusResponse(BaseModel):
    status: str
    instance_id: str | None
    agents: list[PipelineAgentResponse]


class DeployPayload(BaseModel):
    instance_id: str


# Mock data for development
_MOCK_SIGNALS: list[dict[str, Any]] = [
    {"id": "1", "time": "2025-03-03T09:35:00Z", "symbol": "NVDA", "direction": "LONG", "confidence": 0.87,
     "source_agent": "Risk Analyzer", "entry_price": 142.50, "stop_loss": 138.20, "take_profit": 152.00,
     "risk_reward": 2.2, "status": "NEW", "research_note": "Strong AI narrative momentum.",
     "technical_chart_ref": "NVDA 1D — VWAP support.", "risk_analysis": "VaR within limits."},
    {"id": "2", "time": "2025-03-03T09:42:00Z", "symbol": "AAPL", "direction": "SHORT", "confidence": 0.72,
     "source_agent": "Risk Analyzer", "entry_price": 178.90, "stop_loss": 181.50, "take_profit": 172.00,
     "risk_reward": 2.6, "status": "ACTIVE", "research_note": "Sector rotation out of mega-cap tech.",
     "technical_chart_ref": "AAPL 4H — Failed breakout.", "risk_analysis": "Circuit breaker at -3%."},
    {"id": "3", "time": "2025-03-03T10:15:00Z", "symbol": "SPY", "direction": "LONG", "confidence": 0.81,
     "source_agent": "Risk Analyzer", "entry_price": 512.30, "stop_loss": 508.00, "take_profit": 520.00,
     "risk_reward": 1.8, "status": "NEW", "research_note": "Market breadth improving.",
     "technical_chart_ref": "SPY 1D — Opening range breakout.", "risk_analysis": "Portfolio VaR 0.8%."},
    {"id": "4", "time": "2025-03-03T10:28:00Z", "symbol": "TSLA", "direction": "LONG", "confidence": 0.65,
     "source_agent": "Risk Analyzer", "entry_price": 248.50, "stop_loss": 243.00, "take_profit": 262.00,
     "risk_reward": 2.4, "status": "EXPIRED", "research_note": "EV sentiment improving.",
     "technical_chart_ref": "TSLA 1H — Gap fill complete.", "risk_analysis": "Reduced position size."},
    {"id": "5", "time": "2025-03-03T11:00:00Z", "symbol": "AMD", "direction": "LONG", "confidence": 0.79,
     "source_agent": "Risk Analyzer", "entry_price": 168.20, "stop_loss": 164.50, "take_profit": 178.00,
     "risk_reward": 2.5, "status": "NEW", "research_note": "AI chip demand tailwind.",
     "technical_chart_ref": "AMD 4H — Multi-timeframe confluence.", "risk_analysis": "Max 2% portfolio."},
    {"id": "6", "time": "2025-03-03T11:22:00Z", "symbol": "META", "direction": "LONG", "confidence": 0.74,
     "source_agent": "Risk Analyzer", "entry_price": 485.20, "stop_loss": 478.00, "take_profit": 502.00,
     "risk_reward": 2.3, "status": "NEW", "research_note": "Ad revenue recovery.",
     "technical_chart_ref": "META 1D — VWAP reversion.", "risk_analysis": "VaR compliant."},
    {"id": "7", "time": "2025-03-03T11:45:00Z", "symbol": "MSFT", "direction": "LONG", "confidence": 0.82,
     "source_agent": "Risk Analyzer", "entry_price": 415.80, "stop_loss": 410.50, "take_profit": 428.00,
     "risk_reward": 2.0, "status": "ACTIVE", "research_note": "Cloud growth resilient.",
     "technical_chart_ref": "MSFT 4H — Multi-timeframe confluence.", "risk_analysis": "Full position approved."},
]

_MOCK_PIPELINE = {
    "status": "deployed",
    "instance_id": "inst-1",
    "agents": [
        {"id": "ra", "name": "Research Analyst", "status": "running", "last_run": "2025-03-03T07:00:00Z", "signals_produced": 8},
        {"id": "ta", "name": "Technical Analyst", "status": "running", "last_run": "2025-03-03T07:15:00Z", "signals_produced": 6},
        {"id": "rk", "name": "Risk Analyzer", "status": "running", "last_run": "2025-03-03T07:30:00Z", "signals_produced": 5},
    ],
}


@router.get("", response_model=list[SignalResponse])
async def list_signals() -> list[SignalResponse]:
    """List today's daily signals."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    signals = [s for s in _MOCK_SIGNALS if s["time"].startswith(today)]
    if not signals:
        signals = _MOCK_SIGNALS
    return [SignalResponse(**s) for s in signals]


@router.get("/pipeline", response_model=PipelineStatusResponse)
async def get_pipeline_status() -> PipelineStatusResponse:
    """Get pipeline status and agent states."""
    return PipelineStatusResponse(**_MOCK_PIPELINE)


@router.post("/pipeline/deploy")
async def deploy_pipeline(payload: DeployPayload) -> dict:
    """Deploy 3-agent pipeline to specified instance."""
    return {"status": "deployed", "instance_id": payload.instance_id, "message": "Pipeline deployed"}


@router.get("/{signal_id}", response_model=SignalResponse)
async def get_signal_detail(signal_id: str) -> SignalResponse:
    """Get signal detail with research note, technical ref, risk analysis."""
    for s in _MOCK_SIGNALS:
        if s["id"] == signal_id:
            return SignalResponse(**s)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
