import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-testing-only")
if not os.environ.get("CREDENTIAL_ENCRYPTION_KEY"):
    os.environ["CREDENTIAL_ENCRYPTION_KEY"] = "5auLTQ2PfTgU_G8sw3-QGC0C9e26Rs_51rBMrfoeR_A="


@pytest.fixture
def anyio_backend():
    return "asyncio"
