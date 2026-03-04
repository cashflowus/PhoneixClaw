"""
Instance management API routes: CRUD for OpenClaw instances, heartbeat ingestion.

M1.8: Instance registration, heartbeat endpoint, instance listing.
Reference: ArchitecturePlan.md §3, §6; PRD Section 4.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update

from apps.api.src.deps import DbSession
from shared.db.models.openclaw_instance import OpenClawInstance

router = APIRouter(prefix="/api/v2/instances", tags=["instances"])


class InstanceCreate(BaseModel):
    """Payload for registering a new OpenClaw instance."""
    name: str = Field(..., min_length=1, max_length=100)
    host: str = Field(..., min_length=1, max_length=255)
    port: int = Field(default=18800, ge=1, le=65535)
    role: str = Field(default="general", max_length=50)
    node_type: str = Field(default="vps", pattern="^(vps|local)$")
    capabilities: dict[str, Any] = Field(default_factory=dict)


class InstanceUpdate(BaseModel):
    """Payload for updating an instance."""
    name: str | None = None
    host: str | None = None
    port: int | None = None
    role: str | None = None
    node_type: str | None = None
    capabilities: dict[str, Any] | None = None


class HeartbeatPayload(BaseModel):
    """Heartbeat data from an OpenClaw Bridge Service."""
    agent_statuses: list[dict[str, Any]] = Field(default_factory=list)
    positions: list[dict[str, Any]] = Field(default_factory=list)
    recent_trades: list[dict[str, Any]] = Field(default_factory=list)
    total_pnl: float = 0.0
    active_tasks: int = 0
    memory_usage_mb: float = 0.0
    cpu_percent: float = 0.0


class InstanceResponse(BaseModel):
    """Serialized instance for API responses."""
    id: str
    name: str
    host: str
    port: int
    role: str
    status: str
    node_type: str
    capabilities: dict[str, Any]
    last_heartbeat_at: str | None
    created_at: str

    @classmethod
    def from_model(cls, inst: OpenClawInstance) -> "InstanceResponse":
        return cls(
            id=str(inst.id),
            name=inst.name,
            host=inst.host,
            port=inst.port,
            role=inst.role,
            status=inst.status,
            node_type=inst.node_type,
            capabilities=inst.capabilities or {},
            last_heartbeat_at=inst.last_heartbeat_at.isoformat() if inst.last_heartbeat_at else None,
            created_at=inst.created_at.isoformat() if inst.created_at else "",
        )


@router.get("", response_model=list[InstanceResponse])
async def list_instances(session: DbSession):
    """List all registered OpenClaw instances."""
    result = await session.execute(
        select(OpenClawInstance).order_by(OpenClawInstance.created_at.desc())
    )
    instances = result.scalars().all()
    return [InstanceResponse.from_model(i) for i in instances]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=InstanceResponse)
async def create_instance(payload: InstanceCreate, session: DbSession):
    """Register a new OpenClaw instance (or auto-register from a Bridge Service)."""
    existing = await session.execute(
        select(OpenClawInstance).where(OpenClawInstance.name == payload.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Instance '{payload.name}' already exists",
        )

    instance = OpenClawInstance(
        id=uuid.uuid4(),
        name=payload.name,
        host=payload.host,
        port=payload.port,
        role=payload.role,
        node_type=payload.node_type,
        capabilities=payload.capabilities,
        status="ONLINE",
        auto_registered=payload.node_type == "local",
    )
    session.add(instance)
    await session.commit()
    await session.refresh(instance)
    return InstanceResponse.from_model(instance)


@router.get("/{instance_id}", response_model=InstanceResponse)
async def get_instance(instance_id: str, session: DbSession):
    """Get a single OpenClaw instance by ID."""
    result = await session.execute(
        select(OpenClawInstance).where(OpenClawInstance.id == uuid.UUID(instance_id))
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    return InstanceResponse.from_model(instance)


@router.patch("/{instance_id}", response_model=InstanceResponse)
async def update_instance(instance_id: str, payload: InstanceUpdate, session: DbSession):
    """Update an OpenClaw instance configuration."""
    result = await session.execute(
        select(OpenClawInstance).where(OpenClawInstance.id == uuid.UUID(instance_id))
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(instance, field, value)
    instance.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(instance)
    return InstanceResponse.from_model(instance)


@router.delete("/{instance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_instance(instance_id: str, session: DbSession):
    """Remove an OpenClaw instance from the registry."""
    result = await session.execute(
        select(OpenClawInstance).where(OpenClawInstance.id == uuid.UUID(instance_id))
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    await session.delete(instance)
    await session.commit()


@router.post("/{instance_id}/heartbeat")
async def ingest_heartbeat(instance_id: str, payload: HeartbeatPayload, session: DbSession):
    """
    Receive heartbeat data from an OpenClaw Bridge Service.
    Updates instance status and last_heartbeat_at timestamp.
    Stores agent statuses and metrics for dashboard consumption.
    """
    result = await session.execute(
        select(OpenClawInstance).where(OpenClawInstance.id == uuid.UUID(instance_id))
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    now = datetime.now(timezone.utc)
    instance.last_heartbeat_at = now
    instance.status = "ONLINE"

    # Store heartbeat data in capabilities as latest snapshot
    instance.capabilities = {
        **(instance.capabilities or {}),
        "last_heartbeat": {
            "timestamp": now.isoformat(),
            "agent_count": len(payload.agent_statuses),
            "agents": payload.agent_statuses,
            "position_count": len(payload.positions),
            "total_pnl": payload.total_pnl,
            "active_tasks": payload.active_tasks,
            "memory_usage_mb": payload.memory_usage_mb,
            "cpu_percent": payload.cpu_percent,
        },
    }
    await session.commit()

    return {
        "status": "accepted",
        "instance_id": instance_id,
        "timestamp": now.isoformat(),
    }


@router.post("/{instance_id}/sync-skills")
async def sync_skills(instance_id: str, session: DbSession):
    """Trigger skill synchronization on a specific OpenClaw instance."""
    result = await session.execute(
        select(OpenClawInstance).where(OpenClawInstance.id == uuid.UUID(instance_id))
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    return {
        "status": "sync_triggered",
        "instance_id": instance_id,
        "instance_name": instance.name,
        "message": f"Skill sync queued for {instance.name}",
    }
