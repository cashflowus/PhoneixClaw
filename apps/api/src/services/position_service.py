"""
Position service: open/closed positions, portfolio summary.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.src.repositories.position_repo import PositionRepository
from shared.db.models.trade import Position


class PositionService:
    """Position business logic."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = PositionRepository(session)

    async def get_open_positions(self, skip: int = 0, limit: int = 50) -> list[Position]:
        """Return open positions."""
        return await self.repo.list_open(skip, limit)

    async def get_closed_positions(self, skip: int = 0, limit: int = 50) -> list[Position]:
        """Return closed positions."""
        return await self.repo.list_closed(skip, limit)

    async def get_portfolio_summary(self) -> dict:
        """Return aggregate portfolio summary (open count, unrealized/realized PnL)."""
        return await self.repo.get_summary()
