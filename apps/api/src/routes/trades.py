"""
Trades API routes: list trades, get trade detail, trade stats.

M1.10: Trades Tab backend.
Reference: PRD Section 3.1.
"""

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select, desc

from apps.api.src.deps import DbSession
from shared.db.models.trade import TradeIntent

router = APIRouter(prefix="/api/v2/trades", tags=["trades"])


class TradeResponse(BaseModel):
    id: str
    agent_id: str
    account_id: str
    symbol: str
    side: str
    qty: float
    order_type: str
    limit_price: float | None
    stop_price: float | None
    status: str
    fill_price: float | None
    filled_at: str | None
    rejection_reason: str | None
    signal_source: str | None
    created_at: str

    @classmethod
    def from_model(cls, t: TradeIntent) -> "TradeResponse":
        return cls(
            id=str(t.id),
            agent_id=str(t.agent_id),
            account_id=t.account_id,
            symbol=t.symbol,
            side=t.side,
            qty=t.qty,
            order_type=t.order_type,
            limit_price=t.limit_price,
            stop_price=t.stop_price,
            status=t.status,
            fill_price=t.fill_price,
            filled_at=t.filled_at.isoformat() if t.filled_at else None,
            rejection_reason=t.rejection_reason,
            signal_source=t.signal_source,
            created_at=t.created_at.isoformat() if t.created_at else "",
        )


@router.get("", response_model=list[TradeResponse])
async def list_trades(
    session: DbSession,
    status_filter: str | None = Query(None, alias="status"),
    symbol: str | None = None,
    agent_id: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List trade intents with optional filters."""
    query = select(TradeIntent).order_by(desc(TradeIntent.created_at))
    if status_filter:
        query = query.where(TradeIntent.status == status_filter)
    if symbol:
        query = query.where(TradeIntent.symbol == symbol.upper())
    if agent_id:
        query = query.where(TradeIntent.agent_id == uuid.UUID(agent_id))
    query = query.limit(limit).offset(offset)
    result = await session.execute(query)
    return [TradeResponse.from_model(t) for t in result.scalars().all()]


@router.get("/stats")
async def trade_stats(session: DbSession):
    """Aggregate trade statistics."""
    total = await session.execute(select(func.count(TradeIntent.id)))
    filled = await session.execute(
        select(func.count(TradeIntent.id)).where(TradeIntent.status == "FILLED")
    )
    rejected = await session.execute(
        select(func.count(TradeIntent.id)).where(TradeIntent.status == "REJECTED")
    )
    pending = await session.execute(
        select(func.count(TradeIntent.id)).where(TradeIntent.status == "PENDING")
    )
    return {
        "total": total.scalar() or 0,
        "filled": filled.scalar() or 0,
        "rejected": rejected.scalar() or 0,
        "pending": pending.scalar() or 0,
    }


@router.get("/{trade_id}", response_model=TradeResponse)
async def get_trade(trade_id: str, session: DbSession):
    """Get a single trade intent by ID."""
    result = await session.execute(
        select(TradeIntent).where(TradeIntent.id == uuid.UUID(trade_id))
    )
    trade = result.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    return TradeResponse.from_model(trade)
