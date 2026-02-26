import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models.database import get_session
from shared.models.trade import ModelRegistry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/models", tags=["models"])


class ModelUpdate(BaseModel):
    description: str | None = None
    config: dict | None = None
    status: str | None = None


class ModelCreate(BaseModel):
    name: str
    model_type: str
    provider: str
    model_identifier: str
    version: str | None = None
    description: str | None = None
    config: dict = {}
    input_schema: dict | None = None
    output_schema: dict | None = None


@router.get("")
async def list_models(
    model_type: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    q = select(ModelRegistry)
    if model_type:
        q = q.where(ModelRegistry.model_type == model_type)
    q = q.order_by(ModelRegistry.model_type, ModelRegistry.name)
    result = await session.execute(q)
    return [_response(m) for m in result.scalars().all()]


@router.get("/{model_id}")
async def get_model(model_id: str, session: AsyncSession = Depends(get_session)):
    m = await _get(model_id, session)
    return _response(m)


@router.post("", status_code=201)
async def create_model(req: ModelCreate, session: AsyncSession = Depends(get_session)):
    m = ModelRegistry(
        name=req.name,
        model_type=req.model_type,
        provider=req.provider,
        model_identifier=req.model_identifier,
        version=req.version,
        description=req.description,
        config=req.config,
        input_schema=req.input_schema,
        output_schema=req.output_schema,
    )
    session.add(m)
    await session.commit()
    await session.refresh(m)
    return _response(m)


@router.patch("/{model_id}")
async def update_model(model_id: str, req: ModelUpdate, session: AsyncSession = Depends(get_session)):
    m = await _get(model_id, session)
    if req.description is not None:
        m.description = req.description
    if req.config is not None:
        m.config = req.config
    if req.status is not None:
        m.status = req.status
    await session.commit()
    await session.refresh(m)
    return _response(m)


@router.delete("/{model_id}", status_code=204)
async def delete_model(model_id: str, session: AsyncSession = Depends(get_session)):
    m = await _get(model_id, session)
    await session.delete(m)
    await session.commit()


@router.post("/{model_id}/health-check")
async def health_check(model_id: str, session: AsyncSession = Depends(get_session)):
    m = await _get(model_id, session)
    m.health_status = "healthy"
    m.last_health_check = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(m)
    return _response(m)


async def _get(model_id: str, session: AsyncSession) -> ModelRegistry:
    result = await session.execute(
        select(ModelRegistry).where(ModelRegistry.id == uuid.UUID(model_id))
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Model not found")
    return m


def _response(m: ModelRegistry) -> dict:
    return {
        "id": str(m.id),
        "name": m.name,
        "model_type": m.model_type,
        "provider": m.provider,
        "model_identifier": m.model_identifier,
        "version": m.version,
        "description": m.description,
        "config": m.config or {},
        "input_schema": m.input_schema,
        "output_schema": m.output_schema,
        "status": m.status,
        "health_status": m.health_status,
        "last_health_check": m.last_health_check.isoformat() if m.last_health_check else None,
        "performance_metrics": m.performance_metrics,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }
