"""
Task service: create, move, assign, and list board tasks.
"""

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.src.repositories.task_repo import TaskRepository
from shared.db.models.task import Task


class TaskService:

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = TaskRepository(session)

    async def create_task(self, data: dict[str, Any]) -> Task:
        task = await self.repo.create(data)
        await self.session.commit()
        await self.session.refresh(task)
        return task

    async def move_task(self, id: UUID, new_status: str) -> Task | None:
        task = await self.repo.move(id, new_status)
        if task:
            await self.session.commit()
            await self.session.refresh(task)
        return task

    async def assign_to_agent(self, task_id: UUID, agent_id: UUID) -> Task | None:
        task = await self.repo.update(task_id, {"agent_id": agent_id})
        if task:
            await self.session.commit()
            await self.session.refresh(task)
        return task

    async def list_tasks(
        self,
        filters: dict[str, Any] | None = None,
    ) -> list[Task]:
        filters = filters or {}
        return await self.repo.list_tasks(
            status=filters.get("status"),
            created_by=filters.get("created_by"),
            limit=filters.get("limit", 50),
            offset=filters.get("offset", 0),
        )
