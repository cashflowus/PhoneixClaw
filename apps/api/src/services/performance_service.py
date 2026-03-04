"""
Performance service: aggregated metrics and time-series performance data.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.db.models.trade import Position, TradeIntent


class PerformanceService:

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_summary(self) -> dict[str, Any]:
        """Aggregate portfolio-wide performance metrics across all closed positions."""
        closed = select(Position).where(Position.status == "CLOSED").subquery()

        total_pnl_q = await self.session.execute(
            select(func.coalesce(func.sum(closed.c.realized_pnl), 0.0))
        )
        total_pnl: float = float(total_pnl_q.scalar() or 0)

        counts_q = await self.session.execute(
            select(
                func.count(closed.c.id).label("total"),
                func.count(case((closed.c.realized_pnl > 0, 1))).label("wins"),
            )
        )
        row = counts_q.one()
        total_trades = int(row.total)
        wins = int(row.wins)
        win_rate = (wins / total_trades * 100) if total_trades > 0 else 0.0

        avg_win_q = await self.session.execute(
            select(func.avg(closed.c.realized_pnl)).where(closed.c.realized_pnl > 0)
        )
        avg_win = float(avg_win_q.scalar() or 0)

        avg_loss_q = await self.session.execute(
            select(func.avg(closed.c.realized_pnl)).where(closed.c.realized_pnl < 0)
        )
        avg_loss = float(avg_loss_q.scalar() or 0)

        profit_factor = abs(avg_win / avg_loss) if avg_loss != 0 else 0.0

        open_pnl_q = await self.session.execute(
            select(func.coalesce(func.sum(Position.unrealized_pnl), 0.0)).where(
                Position.status == "OPEN"
            )
        )
        unrealized_pnl = float(open_pnl_q.scalar() or 0)

        return {
            "total_pnl": round(total_pnl, 2),
            "unrealized_pnl": round(unrealized_pnl, 2),
            "total_trades": total_trades,
            "win_rate": round(win_rate, 2),
            "avg_win": round(avg_win, 2),
            "avg_loss": round(avg_loss, 2),
            "profit_factor": round(profit_factor, 2),
        }

    async def get_timeline(
        self,
        agent_id: UUID | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> list[dict[str, Any]]:
        """Return daily realized PnL time-series for the given agent (or all agents)."""
        date_col = func.date(Position.closed_at).label("date")
        stmt = (
            select(
                date_col,
                func.sum(Position.realized_pnl).label("daily_pnl"),
                func.count(Position.id).label("trades"),
            )
            .where(Position.status == "CLOSED")
            .group_by(date_col)
            .order_by(date_col)
        )

        if agent_id is not None:
            stmt = stmt.where(Position.agent_id == agent_id)
        if start is not None:
            stmt = stmt.where(Position.closed_at >= start)
        if end is not None:
            stmt = stmt.where(Position.closed_at <= end)

        result = await self.session.execute(stmt)
        rows = result.all()

        cumulative = 0.0
        timeline: list[dict[str, Any]] = []
        for row in rows:
            cumulative += float(row.daily_pnl)
            timeline.append({
                "date": str(row.date),
                "daily_pnl": round(float(row.daily_pnl), 2),
                "cumulative_pnl": round(cumulative, 2),
                "trades": int(row.trades),
            })
        return timeline
