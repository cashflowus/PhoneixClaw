"""
Agent service: create, pause, resume, stats. Integrates with Bridge HTTP.
"""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.src.repositories.agent_repo import AgentRepository
from shared.db.models.agent import Agent


class AgentService:
    """Agent business logic with Bridge Service integration."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = AgentRepository(session)

    async def create_agent(self, data: dict[str, Any]) -> Agent:
        """Create agent: validate config, persist, then call Bridge HTTP to create workspace."""
        config = dict(data.get("config", {}))
        for key in ("description", "data_source", "skills"):
            if key in data:
                config[key] = data[key]
        agent = await self.repo.create({
            "id": uuid.uuid4(),
            "name": data["name"],
            "type": data["type"],
            "status": "CREATED",
            "instance_id": uuid.UUID(data["instance_id"]),
            "config": config,
        })
        await self.session.commit()
        await self.session.refresh(agent)
        # TODO: Forward to Bridge Service via httpx
        # bridge_url = f"http://{instance.host}:{instance.port}/agents"
        # async with httpx.AsyncClient() as client:
        #     await client.post(bridge_url, json={...}, headers={"X-Bridge-Token": token})
        return agent

    async def pause_agent(self, id: uuid.UUID) -> Agent | None:
        """Pause a running agent."""
        agent = await self.repo.update(id, {"status": "PAUSED"})
        if agent:
            await self.session.commit()
            await self.session.refresh(agent)
        return agent

    async def resume_agent(self, id: uuid.UUID) -> Agent | None:
        """Resume a paused agent."""
        agent = await self.repo.update(id, {"status": "RUNNING"})
        if agent:
            await self.session.commit()
            await self.session.refresh(agent)
        return agent

    async def get_agent_stats(self, id: uuid.UUID) -> dict | None:
        """Get stats for a single agent (trades, positions, etc.)."""
        agent = await self.repo.get_by_id(id)
        if not agent:
            return None
        # Placeholder: in production, aggregate from trades/positions
        return {"agent_id": str(id), "status": agent.status, "trades_count": 0}
