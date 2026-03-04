"""
Skill service: catalog listing, lookup, and sync to OpenClaw instances.
"""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.src.repositories.skill_repo import SkillRepository
from shared.db.models.skill import AgentSkill, Skill


class SkillService:

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = SkillRepository(session)

    async def list_skills(
        self,
        category: str | None = None,
        is_active: bool | None = None,
    ) -> list[Skill]:
        return await self.repo.list_skills(category=category, is_active=is_active)

    async def get_skill(self, id: UUID) -> Skill | None:
        return await self.repo.get_by_id(id)

    async def sync_skills_to_instance(self, instance_id: UUID) -> dict[str, Any]:
        """Assign all active skills to every agent running on the given instance."""
        from shared.db.models.agent import Agent

        active_skills = await self.repo.list_skills(is_active=True)
        agents_result = await self.session.execute(
            select(Agent).where(Agent.instance_id == instance_id)
        )
        agents = list(agents_result.scalars().all())

        created = 0
        for agent in agents:
            existing_result = await self.session.execute(
                select(AgentSkill.skill_id).where(AgentSkill.agent_id == agent.id)
            )
            existing_skill_ids = set(existing_result.scalars().all())

            for skill in active_skills:
                if skill.id not in existing_skill_ids:
                    self.session.add(AgentSkill(
                        agent_id=agent.id,
                        skill_id=skill.id,
                    ))
                    created += 1

        if created:
            await self.session.flush()

        for skill in active_skills:
            skill.sync_status = "synced"
            skill.last_synced_at = datetime.now(timezone.utc)
        await self.session.flush()
        await self.session.commit()

        return {
            "instance_id": str(instance_id),
            "agents_count": len(agents),
            "skills_synced": len(active_skills),
            "assignments_created": created,
        }
