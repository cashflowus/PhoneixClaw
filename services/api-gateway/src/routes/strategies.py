import logging
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models.database import get_session
from shared.models.trade import StrategyModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/strategies", tags=["strategies"])

STRATEGY_AGENT_URL = "http://strategy-agent:8025"


class StrategyCreate(BaseModel):
    name: str
    strategy_text: str
    ticker: str = "SPY"


class BacktestRequest(BaseModel):
    strategy_id: str | None = None
    strategy_text: str | None = None
    ticker: str = "SPY"
    period_years: int = 2


@router.get("")
async def list_strategies(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    user_id = request.state.user_id
    result = await session.execute(
        select(StrategyModel)
        .where(StrategyModel.user_id == uuid.UUID(user_id))
        .order_by(desc(StrategyModel.updated_at))
    )
    return [_response(s) for s in result.scalars().all()]


@router.post("", status_code=201)
async def create_strategy(
    req: StrategyCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    user_id = request.state.user_id
    strategy = StrategyModel(
        user_id=uuid.UUID(user_id),
        name=req.name,
        strategy_text=req.strategy_text,
    )
    session.add(strategy)
    await session.commit()
    await session.refresh(strategy)
    return _response(strategy)


@router.get("/{strategy_id}")
async def get_strategy(
    strategy_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    s = await _get_strategy(strategy_id, request, session)
    return _response(s)


@router.delete("/{strategy_id}", status_code=204)
async def delete_strategy(
    strategy_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    s = await _get_strategy(strategy_id, request, session)
    await session.delete(s)
    await session.commit()


@router.post("/{strategy_id}/parse")
async def parse_strategy(
    strategy_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    s = await _get_strategy(strategy_id, request, session)
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{STRATEGY_AGENT_URL}/parse",
                json={"strategy_text": s.strategy_text},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Strategy agent unavailable: {str(e)[:200]}")

    s.parsed_config = data.get("parsed_config", {})
    s.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(s)
    return _response(s)


@router.post("/backtest")
async def run_backtest(
    req: BacktestRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    strategy_text = req.strategy_text
    parsed_config = {}

    if req.strategy_id:
        s = await _get_strategy(req.strategy_id, request, session)
        strategy_text = s.strategy_text
        parsed_config = s.parsed_config or {}

    if not strategy_text:
        raise HTTPException(status_code=400, detail="Strategy text required")

    try:
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{STRATEGY_AGENT_URL}/backtest",
                json={
                    "strategy_text": strategy_text,
                    "parsed_config": parsed_config,
                    "ticker": req.ticker,
                    "period_years": req.period_years,
                },
            )
            resp.raise_for_status()
            result = resp.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Backtest timed out")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Strategy agent error: {str(e)[:200]}")

    if req.strategy_id:
        s.backtest_summary = result.get("report", {})
        s.parsed_config = result.get("parsed_config", parsed_config)
        s.status = "backtested"
        s.updated_at = datetime.now(timezone.utc)
        await session.commit()

    return result


@router.post("/{strategy_id}/deploy")
async def deploy_strategy(
    strategy_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    s = await _get_strategy(strategy_id, request, session)
    if not s.backtest_summary:
        raise HTTPException(status_code=400, detail="Run backtest before deploying")

    s.status = "deployed"
    s.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(s)
    return _response(s)


async def _get_strategy(strategy_id: str, request: Request, session: AsyncSession) -> StrategyModel:
    user_id = request.state.user_id
    result = await session.execute(
        select(StrategyModel).where(
            StrategyModel.id == uuid.UUID(strategy_id),
            StrategyModel.user_id == uuid.UUID(user_id),
        )
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return s


def _response(s: StrategyModel) -> dict:
    return {
        "id": str(s.id),
        "name": s.name,
        "strategy_text": s.strategy_text,
        "parsed_config": s.parsed_config or {},
        "features": s.features or [],
        "backtest_summary": s.backtest_summary,
        "status": s.status,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }
