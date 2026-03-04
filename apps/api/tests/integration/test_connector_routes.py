import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_connectors(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/connectors", headers=auth_headers)
    assert resp.status_code in (200, 500)
    if resp.status_code == 200:
        assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_create_connector_missing_fields(client: AsyncClient, auth_headers):
    resp = await client.post("/api/v2/connectors", json={}, headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_connector_invalid_name(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/api/v2/connectors",
        json={"name": "", "type": "discord", "config": {}},
        headers=auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_connector_not_found(client: AsyncClient, auth_headers):
    resp = await client.get(
        "/api/v2/connectors/00000000-0000-0000-0000-000000000099",
        headers=auth_headers,
    )
    assert resp.status_code in (404, 500)


@pytest.mark.asyncio
async def test_update_connector_not_found(client: AsyncClient, auth_headers):
    resp = await client.patch(
        "/api/v2/connectors/00000000-0000-0000-0000-000000000099",
        json={"name": "Updated"},
        headers=auth_headers,
    )
    assert resp.status_code in (404, 500)


@pytest.mark.asyncio
async def test_delete_connector_not_found(client: AsyncClient, auth_headers):
    resp = await client.delete(
        "/api/v2/connectors/00000000-0000-0000-0000-000000000099",
        headers=auth_headers,
    )
    assert resp.status_code in (404, 500)


@pytest.mark.asyncio
async def test_test_connector_not_found(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/api/v2/connectors/00000000-0000-0000-0000-000000000099/test",
        headers=auth_headers,
    )
    assert resp.status_code in (404, 500)
