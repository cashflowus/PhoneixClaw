"""
Daily Signals API routes: list signals, pipeline status, signal detail.

Phoenix v3 — Queries agent_trades + agents tables for real signal data.
"""

import uuid
from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.db.engine import get_session
from shared.db.models.agent import Agent
from shared.db.models.agent_trade import AgentTrade

router = APIRouter(prefix="/api/v2/daily-signals", tags=["daily-signals"])


class SignalResponse(BaseModel):
    id: str
    time: str
    symbol: str
    direction: str
    confidence: float
    source_agent: str
    entry_price: float
    stop_loss: float | None = None
    take_profit: float | None = None
    risk_reward: float | None = None
    status: str
    reasoning: str | None = None
    pattern_matches: int | None = None
    pnl: float | None = None


class PipelineAgentResponse(BaseModel):
    id: str
    name: str
    status: str
    last_trade: str | None
    signals_produced: int


class PipelineStatusResponse(BaseModel):
    status: str
    agents: list[PipelineAgentResponse]
    total_signals_today: int


def _trade_to_signal(trade: AgentTrade, agent_name: str) -> SignalResponse:
    """Map an AgentTrade row to the signal response format."""
    rr = None
    if trade.entry_price and trade.exit_price and trade.side == "buy":
        risk = abs(trade.entry_price * 0.02)  # approx 2% stop
        reward = abs(trade.exit_price - trade.entry_price)
        rr = round(reward / risk, 2) if risk > 0 else None

    return SignalResponse(
        id=str(trade.id),
        time=trade.entry_time.isoformat() if trade.entry_time else trade.created_at.isoformat(),
        symbol=trade.ticker,
        direction=trade.side,
        confidence=trade.model_confidence or 0.0,
        source_agent=agent_name,
        entry_price=trade.entry_price,
        stop_loss=None,
        take_profit=trade.exit_price,
        risk_reward=rr,
        status=trade.status,
        reasoning=trade.reasoning,
        pattern_matches=trade.pattern_matches,
        pnl=trade.pnl_dollar,
    )


@router.get("", response_model=list[SignalResponse])
async def list_signals(
    db: AsyncSession = Depends(get_session),
    target_date: date | None = Query(None, description="Date to query (default: today)"),
) -> list[SignalResponse]:
    """List daily signals from agent trades."""
    query_date = target_date or date.today()
    start = datetime.combine(query_date, time.min, tzinfo=timezone.utc)
    end = datetime.combine(query_date, time.max, tzinfo=timezone.utc)

    result = await db.execute(
        select(AgentTrade, Agent.name)
        .outerjoin(Agent, AgentTrade.agent_id == Agent.id)
        .where(AgentTrade.entry_time.between(start, end))
        .order_by(AgentTrade.entry_time.desc())
        .limit(100)
    )
    rows = result.all()
    return [_trade_to_signal(trade, name or "unknown") for trade, name in rows]


@router.get("/pipeline", response_model=PipelineStatusResponse)
async def get_pipeline_status(
    db: AsyncSession = Depends(get_session),
) -> PipelineStatusResponse:
    """Get active trading agents and their signal counts for today."""
    today_start = datetime.combine(date.today(), time.min, tzinfo=timezone.utc)

    # Get agents with today's trade counts
    result = await db.execute(
        select(
            Agent.id, Agent.name, Agent.status, Agent.last_trade_at,
            func.count(AgentTrade.id).label("trade_count"),
        )
        .outerjoin(AgentTrade, (AgentTrade.agent_id == Agent.id) & (AgentTrade.entry_time >= today_start))
        .where(Agent.type == "trading")
        .group_by(Agent.id, Agent.name, Agent.status, Agent.last_trade_at)
    )
    rows = result.all()

    agents = []
    total = 0
    for row in rows:
        count = row.trade_count or 0
        total += count
        agents.append(PipelineAgentResponse(
            id=str(row.id),
            name=row.name,
            status=row.status,
            last_trade=row.last_trade_at.isoformat() if row.last_trade_at else None,
            signals_produced=count,
        ))

    pipeline_status = "running" if any(a.status in ("RUNNING", "PAPER") for a in agents) else "idle"
    return PipelineStatusResponse(status=pipeline_status, agents=agents, total_signals_today=total)


@router.get("/{signal_id}", response_model=SignalResponse)
async def get_signal_detail(
    signal_id: str,
    db: AsyncSession = Depends(get_session),
) -> SignalResponse:
    """Get signal detail by trade ID."""
    try:
        trade_uuid = uuid.UUID(signal_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signal ID")

    result = await db.execute(
        select(AgentTrade, Agent.name)
        .outerjoin(Agent, AgentTrade.agent_id == Agent.id)
        .where(AgentTrade.id == trade_uuid)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")

    trade, agent_name = row
    return _trade_to_signal(trade, agent_name or "unknown")
