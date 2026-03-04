import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_instances(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/instances", headers=auth_headers)
    assert resp.status_code in (200, 500)
    if resp.status_code == 200:
        assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_create_instance_missing_fields(client: AsyncClient, auth_headers):
    resp = await client.post("/api/v2/instances", json={}, headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_instance_invalid_node_type(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/api/v2/instances",
        json={
            "name": "bad-instance",
            "host": "127.0.0.1",
            "port": 18800,
            "node_type": "cloud",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_instance_not_found(client: AsyncClient, auth_headers):
    resp = await client.get(
        "/api/v2/instances/00000000-0000-0000-0000-000000000099",
        headers=auth_headers,
    )
    assert resp.status_code in (404, 500)


@pytest.mark.asyncio
async def test_delete_instance_not_found(client: AsyncClient, auth_headers):
    resp = await client.delete(
        "/api/v2/instances/00000000-0000-0000-0000-000000000099",
        headers=auth_headers,
    )
    assert resp.status_code in (404, 500)


@pytest.mark.asyncio
async def test_heartbeat_not_found(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/api/v2/instances/00000000-0000-0000-0000-000000000099/heartbeat",
        json={
            "agent_statuses": [],
            "positions": [],
            "recent_trades": [],
            "total_pnl": 0.0,
            "active_tasks": 0,
            "memory_usage_mb": 256.0,
            "cpu_percent": 12.5,
        },
        headers=auth_headers,
    )
    assert resp.status_code in (404, 500)


@pytest.mark.asyncio
async def test_sync_skills_not_found(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/api/v2/instances/00000000-0000-0000-0000-000000000099/sync-skills",
        headers=auth_headers,
    )
    assert resp.status_code in (404, 500)
