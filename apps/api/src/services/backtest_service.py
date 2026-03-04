"""
Backtest service: create, track, and update agent backtest runs.
"""

import uuid
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.src.repositories.backtest_repo import BacktestRepository
from shared.db.models.agent import AgentBacktest


class BacktestService:

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = BacktestRepository(session)

    async def create_backtest(
        self, agent_id: UUID, params: dict[str, Any]
    ) -> AgentBacktest:
        data = {
            "id": uuid.uuid4(),
            "agent_id": agent_id,
            "status": "RUNNING",
            "parameters": params,
            "strategy_template": params.get("strategy_template"),
            "start_date": params.get("start_date"),
            "end_date": params.get("end_date"),
        }
        backtest = await self.repo.create(data)
        await self.session.commit()
        await self.session.refresh(backtest)
        return backtest

    async def get_backtest(self, id: UUID) -> AgentBacktest | None:
        return await self.repo.get_by_id(id)

    async def list_agent_backtests(
        self, agent_id: UUID, status: str | None = None
    ) -> list[AgentBacktest]:
        return await self.repo.list_by_agent(agent_id, status=status)

    async def update_backtest_result(
        self, id: UUID, metrics: dict[str, Any]
    ) -> AgentBacktest | None:
        backtest = await self.repo.get_by_id(id)
        if not backtest:
            return None

        backtest.status = "COMPLETED"
        backtest.metrics = metrics
        backtest.total_trades = metrics.get("total_trades", 0)
        backtest.win_rate = metrics.get("win_rate")
        backtest.sharpe_ratio = metrics.get("sharpe_ratio")
        backtest.max_drawdown = metrics.get("max_drawdown")
        backtest.total_return = metrics.get("total_return")

        from datetime import datetime, timezone
        backtest.completed_at = datetime.now(timezone.utc)

        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(backtest)
        return backtest
