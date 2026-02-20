import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def scoped_query(session: AsyncSession, model: type, user_id: uuid.UUID, **filters):  # type: ignore[no-untyped-def]
    """Return a query filtered by user_id and optional extra filters."""
    stmt = select(model).where(model.user_id == user_id)
    for key, value in filters.items():
        stmt = stmt.where(getattr(model, key) == value)
    result = await session.execute(stmt)
    return result.scalars().all()


async def get_by_id_scoped(session: AsyncSession, model: type, record_id: uuid.UUID, user_id: uuid.UUID):  # type: ignore[no-untyped-def]
    """Get a single record by its ID, scoped to user_id."""
    stmt = select(model).where(model.id == record_id, model.user_id == user_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()
