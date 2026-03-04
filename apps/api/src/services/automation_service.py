"""
Automation service: CRUD, trigger, and toggle for scheduled automations.
"""

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.src.repositories.automation_repo import AutomationRepository
from shared.db.models.task import Automation


class AutomationService:

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = AutomationRepository(session)

    async def create_automation(self, data: dict[str, Any]) -> Automation:
        automation = await self.repo.create(data)
        await self.session.commit()
        await self.session.refresh(automation)
        return automation

    async def trigger(self, id: UUID) -> Automation | None:
        """Record a manual or scheduled trigger and return the updated automation."""
        automation = await self.repo.record_run(id)
        if automation:
            await self.session.commit()
            await self.session.refresh(automation)
        return automation

    async def list_automations(
        self, user_id: UUID | None = None
    ) -> list[Automation]:
        return await self.repo.list_automations(user_id=user_id)

    async def toggle_active(self, id: UUID, is_active: bool) -> Automation | None:
        automation = await self.repo.update(id, {"is_active": is_active})
        if automation:
            await self.session.commit()
            await self.session.refresh(automation)
        return automation
