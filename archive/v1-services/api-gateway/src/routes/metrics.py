import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models.database import get_session
from shared.models.trade import DailyMetrics

router = APIRouter(prefix="/api/v1/metrics", tags=["metrics"])


@router.get("/daily")
async def daily_metrics(
    request: Request,
    days: int = Query(30, le=90),
    account_id: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    user_id = request.state.user_id
    stmt = select(DailyMetrics).where(DailyMetrics.user_id == uuid.UUID(user_id))
    if account_id:
        stmt = stmt.where(DailyMetrics.trading_account_id == uuid.UUID(account_id))
    stmt = stmt.order_by(DailyMetrics.date.desc()).limit(days)
    result = await session.execute(stmt)
    metrics = result.scalars().all()
    return [
        {
            "date": m.date.isoformat(),
            "total_trades": m.total_trades,
            "executed_trades": m.executed_trades,
            "rejected_trades": m.rejected_trades,
            "total_pnl": float(m.total_pnl) if m.total_pnl else 0,
            "winning_trades": m.winning_trades,
            "losing_trades": m.losing_trades,
            "max_drawdown": float(m.max_drawdown) if m.max_drawdown else None,
        }
        for m in metrics
    ]
