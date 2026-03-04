"""
Instance service: register, heartbeat, and skill-sync for OpenClaw instances.
"""

import uuid
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.db.models.openclaw_instance import OpenClawInstance
from shared.db.models.skill import AgentSkill, Skill
from shared.db.models.agent import Agent


class InstanceService:

    def __init__(self, session: AsyncSession):
        self.session = session

    async def register_instance(self, data: dict[str, Any]) -> OpenClawInstance:
        instance = OpenClawInstance(
            id=data.get("id", uuid.uuid4()),
            name=data["name"],
            host=data["host"],
            port=data.get("port", 18800),
            role=data.get("role", "general"),
            node_type=data.get("node_type", "vps"),
            auto_registered=data.get("auto_registered", False),
            capabilities=data.get("capabilities", {}),
            status="ONLINE",
            last_heartbeat_at=datetime.now(timezone.utc),
        )
        self.session.add(instance)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(instance)
        return instance

    async def get_instance(self, id: UUID) -> OpenClawInstance | None:
        result = await self.session.execute(
            select(OpenClawInstance).where(OpenClawInstance.id == id)
        )
        return result.scalar_one_or_none()

    async def sync_skills(self, instance_id: UUID) -> dict[str, Any]:
        """Ensure every agent on this instance has all active skills assigned."""
        agents_result = await self.session.execute(
            select(Agent).where(Agent.instance_id == instance_id)
        )
        agents = list(agents_result.scalars().all())

        skills_result = await self.session.execute(
            select(Skill).where(Skill.is_active.is_(True))
        )
        active_skills = list(skills_result.scalars().all())

        created = 0
        for agent in agents:
            existing_q = await self.session.execute(
                select(AgentSkill.skill_id).where(AgentSkill.agent_id == agent.id)
            )
            existing_ids = set(existing_q.scalars().all())

            for skill in active_skills:
                if skill.id not in existing_ids:
                    self.session.add(AgentSkill(agent_id=agent.id, skill_id=skill.id))
                    created += 1

        if created:
            await self.session.flush()
        await self.session.commit()

        return {
            "instance_id": str(instance_id),
            "agents": len(agents),
            "skills_synced": len(active_skills),
            "new_assignments": created,
        }

    async def process_heartbeat(
        self, instance_id: UUID, data: dict[str, Any]
    ) -> OpenClawInstance | None:
        instance = await self.get_instance(instance_id)
        if not instance:
            return None

        instance.last_heartbeat_at = datetime.now(timezone.utc)
        instance.status = data.get("status", "ONLINE")

        if "capabilities" in data:
            instance.capabilities = data["capabilities"]

        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(instance)
        return instance
