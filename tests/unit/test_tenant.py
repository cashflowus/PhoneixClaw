import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from shared.models.tenant import get_by_id_scoped, scoped_query
from shared.models.trade import Base, Configuration, User


@pytest.fixture
async def async_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        user1_id = uuid.uuid4()
        user2_id = uuid.uuid4()
        u1 = User(id=user1_id, email="u1@test.com", password_hash="hash1")
        u2 = User(id=user2_id, email="u2@test.com", password_hash="hash2")
        session.add_all([u1, u2])
        await session.flush()

        c1 = Configuration(user_id=user1_id, key="theme", value={"mode": "dark"})
        c2 = Configuration(user_id=user2_id, key="theme", value={"mode": "light"})
        session.add_all([c1, c2])
        await session.commit()

        yield session, user1_id, user2_id

    await engine.dispose()


class TestScopedQuery:
    @pytest.mark.asyncio
    async def test_returns_only_matching_user(self, async_session):
        session, uid1, uid2 = async_session
        configs = await scoped_query(session, Configuration, uid1)
        assert len(configs) == 1
        assert configs[0].key == "theme"
        assert configs[0].value == {"mode": "dark"}

    @pytest.mark.asyncio
    async def test_other_user_not_returned(self, async_session):
        session, uid1, uid2 = async_session
        configs = await scoped_query(session, Configuration, uid1)
        values = [c.value for c in configs]
        assert {"mode": "light"} not in values


class TestGetByIdScoped:
    @pytest.mark.asyncio
    async def test_returns_matching_record(self, async_session):
        session, uid1, uid2 = async_session
        configs = await scoped_query(session, Configuration, uid1)
        cfg = configs[0]
        result = await get_by_id_scoped(session, Configuration, cfg.id, uid1)
        assert result is not None
        assert result.key == "theme"

    @pytest.mark.asyncio
    async def test_wrong_user_returns_none(self, async_session):
        session, uid1, uid2 = async_session
        configs = await scoped_query(session, Configuration, uid1)
        cfg = configs[0]
        result = await get_by_id_scoped(session, Configuration, cfg.id, uid2)
        assert result is None
