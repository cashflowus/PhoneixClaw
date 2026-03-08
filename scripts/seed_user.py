"""
Bootstrap a default admin user for local development.

Usage:
    cd <repo-root>
    PYTHONPATH=. python scripts/seed_user.py

Idempotent: skips creation if the user already exists.
"""

import asyncio
import os
import uuid
from datetime import datetime, timezone

import bcrypt
from dotenv import load_dotenv
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

load_dotenv()

from shared.db.models.user import User  # noqa: E402

DEFAULT_EMAIL = os.getenv("SEED_USER_EMAIL", "admin@phoenix.local")
DEFAULT_PASSWORD = os.getenv("SEED_USER_PASSWORD", "phoenix123")
DEFAULT_NAME = os.getenv("SEED_USER_NAME", "Phoenix Admin")


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _db_url() -> str:
    return (
        os.environ.get("API_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        or "postgresql+asyncpg://phoenixtrader:localdev@localhost:5432/phoenixtrader"
    )


async def seed() -> None:
    engine = create_async_engine(_db_url(), poolclass=NullPool)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as session:
        result = await session.execute(select(User).where(User.email == DEFAULT_EMAIL))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"User '{DEFAULT_EMAIL}' already exists (id={existing.id}). Skipping.")
            await engine.dispose()
            return

        user = User(
            id=uuid.uuid4(),
            email=DEFAULT_EMAIL,
            hashed_password=_hash_password(DEFAULT_PASSWORD),
            name=DEFAULT_NAME,
            email_verified=True,
            is_active=True,
            is_admin=True,
            role="admin",
        )
        session.add(user)
        await session.commit()
        print(f"Created admin user: {DEFAULT_EMAIL} / {DEFAULT_PASSWORD}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
