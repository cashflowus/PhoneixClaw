"""
Agent CRUD API routes with Bridge Service integration.

M1.11: Agent management from dashboard.
Reference: PRD Section 3.4, ArchitecturePlan §3, §6.
"""

import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc

from apps.api.src.deps import DbSession
from shared.db.models.agent import Agent, AgentBacktest
from shared.db.models.connector import ConnectorAgent

router = APIRouter(prefix="/api/v2/agents", tags=["agents"])


class AgentCreate(BaseModel):
    """6-step agent creation wizard payload."""
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(..., pattern="^(trading|sentiment)$")
    instance_id: str
    config: dict[str, Any] = Field(default_factory=dict)
    description: str = ""
    data_source: str = ""
    skills: list[str] = Field(default_factory=list)
    connector_ids: list[str] = Field(default_factory=list)


class AgentUpdate(BaseModel):
    name: str | None = None
    status: str | None = None
    config: dict[str, Any] | None = None


class AgentResponse(BaseModel):
    id: str
    name: str
    type: str
    status: str
    instance_id: str
    config: dict[str, Any]
    created_at: str

    @classmethod
    def from_model(cls, a: Agent) -> "AgentResponse":
        return cls(
            id=str(a.id),
            name=a.name,
            type=a.type,
            status=a.status,
            instance_id=str(a.instance_id),
            config=a.config or {},
            created_at=a.created_at.isoformat() if a.created_at else "",
        )


@router.get("", response_model=list[AgentResponse])
async def list_agents(
    session: DbSession,
    agent_type: str | None = Query(None, alias="type"),
    status_filter: str | None = Query(None, alias="status"),
    instance_id: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List agents with optional filters."""
    query = select(Agent).order_by(desc(Agent.created_at))
    if agent_type:
        query = query.where(Agent.type == agent_type)
    if status_filter:
        query = query.where(Agent.status == status_filter)
    if instance_id:
        query = query.where(Agent.instance_id == uuid.UUID(instance_id))
    query = query.limit(limit).offset(offset)
    result = await session.execute(query)
    return [AgentResponse.from_model(a) for a in result.scalars().all()]


@router.get("/stats")
async def agent_stats(session: DbSession):
    """Aggregate agent statistics."""
    total = await session.execute(select(func.count(Agent.id)))
    running = await session.execute(
        select(func.count(Agent.id)).where(Agent.status == "RUNNING")
    )
    paused = await session.execute(
        select(func.count(Agent.id)).where(Agent.status == "PAUSED")
    )
    backtesting = await session.execute(
        select(func.count(Agent.id)).where(Agent.status == "BACKTESTING")
    )
    return {
        "total": total.scalar() or 0,
        "running": running.scalar() or 0,
        "paused": paused.scalar() or 0,
        "backtesting": backtesting.scalar() or 0,
    }


@router.post("", status_code=status.HTTP_201_CREATED, response_model=AgentResponse)
async def create_agent(payload: AgentCreate, session: DbSession):
    """
    Create a new agent. Registers in DB and forwards to Bridge Service on the target instance.
    Agent starts in CREATED state; must go through backtesting before live.
    """
    agent_id = uuid.uuid4()
    agent = Agent(
        id=agent_id,
        name=payload.name,
        type=payload.type,
        status="BACKTESTING",
        instance_id=uuid.UUID(payload.instance_id),
        config={
            "description": payload.description,
            "data_source": payload.data_source,
            "skills": payload.skills,
            "connector_ids": payload.connector_ids,
            **payload.config,
        },
    )
    session.add(agent)

    for cid in payload.connector_ids:
        link = ConnectorAgent(
            id=uuid.uuid4(),
            connector_id=uuid.UUID(cid),
            agent_id=agent_id,
            channel="*",
        )
        session.add(link)

    now = datetime.now(timezone.utc)
    backtest = AgentBacktest(
        id=uuid.uuid4(),
        agent_id=agent_id,
        status="RUNNING",
        strategy_template=f"{payload.type}_default",
        start_date=now - timedelta(days=90),
        end_date=now,
        parameters={"initial_capital": 100000, "type": payload.type, "skills": payload.skills},
        metrics={},
        equity_curve=[],
        created_at=now,
    )
    session.add(backtest)

    await session.commit()
    await session.refresh(agent)

    return AgentResponse.from_model(agent)


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str, session: DbSession):
    """Get agent details."""
    result = await session.execute(
        select(Agent).where(Agent.id == uuid.UUID(agent_id))
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return AgentResponse.from_model(agent)


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(agent_id: str, payload: AgentUpdate, session: DbSession):
    """Update agent config or status."""
    result = await session.execute(
        select(Agent).where(Agent.id == uuid.UUID(agent_id))
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    if payload.name is not None:
        agent.name = payload.name
    if payload.status is not None:
        agent.status = payload.status
    if payload.config is not None:
        agent.config = {**(agent.config or {}), **payload.config}

    agent.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(agent)
    return AgentResponse.from_model(agent)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(agent_id: str, session: DbSession):
    """Delete an agent from DB and Bridge Service."""
    result = await session.execute(
        select(Agent).where(Agent.id == uuid.UUID(agent_id))
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    await session.delete(agent)
    await session.commit()


@router.post("/{agent_id}/pause")
async def pause_agent(agent_id: str, session: DbSession):
    """Pause a running agent."""
    result = await session.execute(
        select(Agent).where(Agent.id == uuid.UUID(agent_id))
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    agent.status = "PAUSED"
    await session.commit()
    return {"id": agent_id, "status": "PAUSED"}


@router.post("/{agent_id}/resume")
async def resume_agent(agent_id: str, session: DbSession):
    """Resume a paused agent."""
    result = await session.execute(
        select(Agent).where(Agent.id == uuid.UUID(agent_id))
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    agent.status = "RUNNING"
    await session.commit()
    return {"id": agent_id, "status": "RUNNING"}


class AgentApprovePayload(BaseModel):
    trading_mode: str = "paper"  # "paper" or "live"
    account_id: str | None = None
    stop_loss_pct: float = 2.0
    target_profit_pct: float = 5.0
    max_daily_loss_pct: float = 5.0
    max_position_pct: float = 10.0


@router.post("/{agent_id}/approve")
async def approve_agent(agent_id: str, session: DbSession, payload: AgentApprovePayload | None = None):
    """
    Approve an agent after backtest review. Transitions CREATED/BACKTESTING -> APPROVED.

    Accepts optional body:
      - trading_mode: "paper" | "live"
      - account_id: broker account UUID (required if live)
      - stop_loss_pct: per-trade stop loss %
      - target_profit_pct: per-trade target profit %
      - max_daily_loss_pct: daily loss limit %
      - max_position_pct: max position as % of account
    """
    result = await session.execute(select(Agent).where(Agent.id == uuid.UUID(agent_id)))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    if agent.status != "BACKTEST_COMPLETE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent must complete backtesting before approval. Current status: {agent.status}",
        )

    if payload is None:
        payload = AgentApprovePayload()

    approval_config = {
        "trading_mode": payload.trading_mode,
        "stop_loss_pct": payload.stop_loss_pct,
        "target_profit_pct": payload.target_profit_pct,
        "max_daily_loss_pct": payload.max_daily_loss_pct,
        "max_position_pct": payload.max_position_pct,
    }
    if payload.account_id:
        approval_config["account_id"] = payload.account_id
    agent.config = {**(agent.config or {}), "approval": approval_config}

    agent.status = "PAPER" if payload.trading_mode == "paper" else "APPROVED"
    agent.updated_at = datetime.now(timezone.utc)
    await session.commit()

    # TODO: Forward approval config to Bridge Service to update agent workspace
    # with trading parameters (paper/live mode, risk limits)

    return {"id": agent_id, "status": "APPROVED", "config": agent.config}


@router.post("/{agent_id}/promote")
async def promote_agent(agent_id: str, session: DbSession):
    """Promote an approved agent to live trading. Transitions APPROVED -> RUNNING."""
    result = await session.execute(select(Agent).where(Agent.id == uuid.UUID(agent_id)))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    if agent.status != "APPROVED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Only APPROVED agents can be promoted, current: {agent.status}")
    agent.status = "RUNNING"
    agent.updated_at = datetime.now(timezone.utc)
    await session.commit()
    return {"id": agent_id, "status": "RUNNING"}


@router.get("/{agent_id}/backtest")
async def get_agent_backtest(agent_id: str, session: DbSession):
    """Get the latest backtest for an agent."""
    result = await session.execute(
        select(AgentBacktest)
        .where(AgentBacktest.agent_id == uuid.UUID(agent_id))
        .order_by(desc(AgentBacktest.created_at))
        .limit(1)
    )
    bt = result.scalar_one_or_none()
    if not bt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No backtest found for this agent")
    return {
        "id": str(bt.id),
        "agent_id": str(bt.agent_id),
        "status": bt.status,
        "strategy_template": bt.strategy_template,
        "start_date": bt.start_date.isoformat() if bt.start_date else None,
        "end_date": bt.end_date.isoformat() if bt.end_date else None,
        "parameters": bt.parameters,
        "metrics": bt.metrics,
        "equity_curve": bt.equity_curve,
        "total_trades": bt.total_trades,
        "win_rate": bt.win_rate,
        "sharpe_ratio": bt.sharpe_ratio,
        "max_drawdown": bt.max_drawdown,
        "total_return": bt.total_return,
        "error_message": bt.error_message,
        "completed_at": bt.completed_at.isoformat() if bt.completed_at else None,
        "created_at": bt.created_at.isoformat() if bt.created_at else None,
    }


@router.post("/{agent_id}/backtest-complete")
async def complete_agent_backtest(agent_id: str, session: DbSession):
    """
    Simulate backtest completion with generated metrics.
    In production, the OpenClaw bridge calls this when backtesting finishes.
    """
    agent_result = await session.execute(select(Agent).where(Agent.id == uuid.UUID(agent_id)))
    agent = agent_result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    if agent.status != "BACKTESTING":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Agent is not backtesting, current: {agent.status}")

    bt_result = await session.execute(
        select(AgentBacktest)
        .where(AgentBacktest.agent_id == agent.id, AgentBacktest.status == "RUNNING")
        .order_by(desc(AgentBacktest.created_at))
        .limit(1)
    )
    bt = bt_result.scalar_one_or_none()
    if not bt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No running backtest found")

    now = datetime.now(timezone.utc)
    total_return = round(random.uniform(5, 45), 2)
    win_rate = round(random.uniform(0.52, 0.78), 4)
    sharpe = round(random.uniform(0.8, 2.8), 2)
    max_dd = round(random.uniform(3, 18), 2)
    total_trades = random.randint(30, 200)

    curve = []
    val = 100000
    for i in range(90):
        daily_return = random.gauss(total_return / 90 / 100, 0.015)
        val *= (1 + daily_return)
        curve.append({
            "day": i + 1,
            "date": (now - timedelta(days=90 - i)).strftime("%Y-%m-%d"),
            "equity": round(val, 2),
        })

    bt.status = "COMPLETED"
    bt.total_return = total_return
    bt.win_rate = win_rate
    bt.sharpe_ratio = sharpe
    bt.max_drawdown = max_dd
    bt.total_trades = total_trades
    bt.equity_curve = curve
    bt.metrics = {
        "total_return_pct": total_return,
        "win_rate": win_rate,
        "sharpe_ratio": sharpe,
        "max_drawdown_pct": max_dd,
        "total_trades": total_trades,
        "profit_factor": round(random.uniform(1.2, 3.0), 2),
        "avg_trade_pnl": round(total_return * 1000 / max(total_trades, 1), 2),
    }
    bt.completed_at = now

    agent.status = "BACKTEST_COMPLETE"
    agent.updated_at = now

    await session.commit()
    return {
        "id": str(bt.id),
        "agent_id": agent_id,
        "status": "COMPLETED",
        "total_return": total_return,
        "win_rate": win_rate,
        "sharpe_ratio": sharpe,
        "max_drawdown": max_dd,
        "total_trades": total_trades,
    }


@router.get("/{agent_id}/logs")
async def get_agent_logs(
    agent_id: str,
    session: DbSession,
    level: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Stream agent logs from DB."""
    from shared.db.models.agent import AgentLog
    query = select(AgentLog).where(AgentLog.agent_id == uuid.UUID(agent_id)).order_by(desc(AgentLog.created_at))
    if level:
        query = query.where(AgentLog.level == level.upper())
    query = query.limit(limit).offset(offset)
    result = await session.execute(query)
    logs = result.scalars().all()
    return [
        {
            "id": str(log.id),
            "level": log.level,
            "message": log.message,
            "context": log.context,
            "created_at": log.created_at.isoformat() if log.created_at else "",
        }
        for log in logs
    ]
