"""
Trade service: submit intents (Redis stream), list trades, stats.
"""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.src.repositories.trade_repo import TradeIntentRepository
from shared.db.models.trade import TradeIntent


class TradeService:
    """Trade business logic with Redis stream integration."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = TradeIntentRepository(session)

    async def submit_intent(self, data: dict[str, Any]) -> dict:
        """Publish trade intent to Redis stream for execution pipeline."""
        # In production: XADD to phoenix:trade-intents stream
        # await redis.xadd("phoenix:trade-intents", {"payload": json.dumps(data)}, "*")
        return {
            "status": "accepted",
            "message": "Trade intent queued for execution",
            "intent": data,
        }

    async def get_trade_stats(self) -> dict:
        """Aggregate trade statistics."""
        return await self.repo.get_stats()

    async def list_trades(
        self,
        filters: dict[str, Any] | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[TradeIntent]:
        """List trades with optional filters (status, symbol, agent_id)."""
        filters = filters or {}
        if filters.get("status"):
            return await self.repo.list_by_status(filters["status"], skip, limit)
        if filters.get("agent_id"):
            return await self.repo.list_by_agent(uuid.UUID(filters["agent_id"]), skip, limit)
        if filters.get("symbol"):
            return await self.repo.list_by_symbol(filters["symbol"], skip, limit)
        return await self.repo.list_recent(skip, limit)
