import os
from unittest.mock import patch

from sqlalchemy.ext.asyncio import AsyncEngine

from shared.db.engine import get_database_url, get_engine


class TestGetDatabaseUrl:
    def test_returns_default_when_no_env(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("DATABASE_URL", None)
            url = get_database_url()
        assert "postgresql+asyncpg" in url
        assert "phoenixtrader" in url

    def test_returns_env_override(self):
        custom = "postgresql+asyncpg://user:pass@host:5432/testdb"
        with patch.dict(os.environ, {"DATABASE_URL": custom}, clear=False):
            os.environ.pop("API_DATABASE_URL", None)
            url = get_database_url()
        assert url == custom

    def test_url_is_string(self):
        url = get_database_url()
        assert isinstance(url, str)


class TestGetEngine:
    def test_returns_async_engine(self):
        engine = get_engine()
        assert isinstance(engine, AsyncEngine)

    def test_engine_url_matches(self):
        engine = get_engine()
        # In tests, conftest may set DATABASE_URL to sqlite; in prod we use asyncpg
        url = str(engine.url)
        assert "asyncpg" in url or "sqlite" in url

    def test_sql_echo_disabled_by_default(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("SQL_ECHO", None)
            engine = get_engine()
        assert engine.echo is False

    def test_sql_echo_enabled(self):
        with patch.dict(os.environ, {"SQL_ECHO": "true"}):
            engine = get_engine()
        assert engine.echo is True
