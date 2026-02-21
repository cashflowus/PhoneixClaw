import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models.database import get_session
from shared.models.trade import Trade

router = APIRouter(prefix="/api/v1/trades", tags=["trades"])


@router.get("")
async def list_trades(
    request: Request,
    status: str | None = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    user_id = request.state.user_id
    stmt = select(Trade).where(Trade.user_id == uuid.UUID(user_id))
    if status:
        stmt = stmt.where(Trade.status == status)
    stmt = stmt.order_by(desc(Trade.created_at)).limit(limit).offset(offset)
    result = await session.execute(stmt)
    trades = result.scalars().all()
    return [
        {
            "id": t.id,
            "trade_id": str(t.trade_id),
            "ticker": t.ticker,
            "strike": float(t.strike),
            "option_type": t.option_type,
            "action": t.action,
            "price": float(t.price),
            "quantity": t.quantity,
            "status": t.status,
            "source": t.source,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "buffered_price": float(t.buffered_price) if t.buffered_price else None,
            "fill_price": float(t.fill_price) if t.fill_price else None,
            "realized_pnl": float(t.realized_pnl) if t.realized_pnl else None,
            "execution_latency_ms": t.execution_latency_ms,
        }
        for t in trades
    ]
