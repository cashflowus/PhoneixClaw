"""Integration test fixtures and env setup."""

import importlib
import os

import pytest

# Force env and reload config/credentials (test_crypto may have left them with empty key)
os.environ["CREDENTIAL_ENCRYPTION_KEY"] = "5auLTQ2PfTgU_G8sw3-QGC0C9e26Rs_51rBMrfoeR_A="
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")


@pytest.fixture(autouse=True)
def _restore_credential_config():
    """Restore config after unit tests (e.g. test_crypto) may have left it with empty key."""
    import shared.config.base_config as _cfg
    import shared.crypto.credentials as _creds

    os.environ["CREDENTIAL_ENCRYPTION_KEY"] = "5auLTQ2PfTgU_G8sw3-QGC0C9e26Rs_51rBMrfoeR_A="
    importlib.reload(_cfg)
    importlib.reload(_creds)
    yield
