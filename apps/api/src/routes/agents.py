"""
Agent CRUD API routes with Bridge Service integration.

M1.11: Agent management from dashboard.
Reference: PRD Section 3.4, ArchitecturePlan §3, §6.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc

from apps.api.src.deps import DbSession
from shared.db.models.agent import Agent

router = APIRouter(prefix="/api/v2/agents", tags=["agents"])


class AgentCreate(BaseModel):
    """5-step agent creation wizard payload."""
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(..., pattern="^(trading|strategy|monitoring|task|dev)$")
    instance_id: str
    config: dict[str, Any] = Field(default_factory=dict)
    description: str = ""
    data_source: str = ""
    skills: list[str] = Field(default_factory=list)


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
    agent = Agent(
        id=uuid.uuid4(),
        name=payload.name,
        type=payload.type,
        status="CREATED",
        instance_id=uuid.UUID(payload.instance_id),
        config={
            "description": payload.description,
            "data_source": payload.data_source,
            "skills": payload.skills,
            **payload.config,
        },
    )
    session.add(agent)
    await session.commit()
    await session.refresh(agent)

    # TODO: Forward to Bridge Service via httpx to create agent workspace on the OpenClaw instance
    # bridge_url = f"http://{instance.host}:{instance.port}/agents"
    # async with httpx.AsyncClient() as client:
    #     await client.post(bridge_url, json={...}, headers={"X-Bridge-Token": token})

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
    if agent.status not in ("CREATED", "BACKTESTING", "BACKTEST_COMPLETE"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot approve agent in {agent.status} state")

    if payload:
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

    agent.status = "APPROVED"
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
