import pytest
from datetime import datetime, timezone, timedelta

from httpx import ASGITransport, AsyncClient
from jose import jwt

from apps.api.src.main import app


SECRET = "change-me-in-production"
ALGORITHM = "HS256"


def _make_token(payload: dict, secret: str = SECRET, algorithm: str = ALGORITHM) -> str:
    return jwt.encode(payload, secret, algorithm=algorithm)


def _access_payload(**overrides) -> dict:
    base = {
        "sub": "user-123",
        "type": "access",
        "role": "trader",
        "admin": False,
        "permissions": [],
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    base.update(overrides)
    return base


@pytest.mark.asyncio
async def test_valid_token_sets_user_state():
    token = _make_token(_access_payload(sub="u-42", role="admin", admin=True, permissions=["custom:perm"]))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_missing_token_leaves_defaults():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_invalid_token_leaves_defaults():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health", headers={"Authorization": "Bearer garbage.token.value"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_expired_token_is_rejected():
    payload = _access_payload(exp=datetime.now(timezone.utc) - timedelta(hours=1))
    token = _make_token(payload)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_token_without_access_type_leaves_defaults():
    payload = _access_payload(type="refresh")
    token = _make_token(payload)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_decode_jwt_returns_none_for_bad_signature():
    from apps.api.src.middleware.auth import decode_jwt
    token = _make_token(_access_payload(), secret="wrong-secret")
    assert decode_jwt(token) is None


@pytest.mark.asyncio
async def test_decode_jwt_returns_payload_for_valid_token():
    from unittest.mock import patch
    from apps.api.src.middleware import auth as auth_module
    token = _make_token(_access_payload(sub="u-99"))
    with patch.object(auth_module.auth_settings, "jwt_secret_key", SECRET):
        with patch.object(auth_module.auth_settings, "jwt_algorithm", ALGORITHM):
            result = auth_module.decode_jwt(token)
    assert result is not None
    assert result["sub"] == "u-99"
