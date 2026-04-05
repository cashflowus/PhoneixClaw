"""Multi-tenancy query helpers — scope DB queries by user_id.

Provides convenience functions to ensure queries only return records
belonging to the requesting user, preventing cross-tenant data leakage.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def scoped_query(session: AsyncSession, model, user_id: UUID) -> list:
    """Return all records of *model* that belong to *user_id*."""
    result = await session.execute(
        select(model).where(model.user_id == user_id)
    )
    return list(result.scalars().all())


async def get_by_id_scoped(session: AsyncSession, model, record_id, user_id: UUID):
    """Return a single record by primary key, but only if it belongs to *user_id*.

    Returns None if the record doesn't exist or belongs to another user.
    """
    result = await session.execute(
        select(model).where(model.id == record_id, model.user_id == user_id)
    )
    return result.scalar_one_or_none()
