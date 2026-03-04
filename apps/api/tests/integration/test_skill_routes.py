import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_skills(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/skills", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_list_skills_with_category_filter(client: AsyncClient, auth_headers):
    resp = await client.get(
        "/api/v2/skills", headers=auth_headers, params={"category": "trading"}
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_list_categories(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/skills/categories", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_get_skill_not_found(client: AsyncClient, auth_headers):
    resp = await client.get(
        "/api/v2/skills/nonexistent/nonexistent", headers=auth_headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_trigger_sync(client: AsyncClient, auth_headers):
    resp = await client.post("/api/v2/skills/sync", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "sync_triggered"
