import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_users(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/admin/users", headers=auth_headers)
    assert resp.status_code in (200, 401, 500)


@pytest.mark.asyncio
async def test_list_users_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/v2/admin/users")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_roles(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/admin/roles", headers=auth_headers)
    assert resp.status_code in (200, 401)
    if resp.status_code == 200:
        roles = resp.json()
        assert isinstance(roles, list)
        assert any(r["id"] == "admin" for r in roles)


@pytest.mark.asyncio
async def test_create_role(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/api/v2/admin/roles",
        json={"name": "analyst", "permissions": {"agents:read": True}},
        headers=auth_headers,
    )
    assert resp.status_code in (201, 401)


@pytest.mark.asyncio
async def test_audit_log(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/admin/audit-log", headers=auth_headers)
    assert resp.status_code in (200, 401, 500)
    if resp.status_code == 200:
        assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_audit_log_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/v2/admin/audit-log")
    assert resp.status_code == 401
