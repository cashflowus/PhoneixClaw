import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_dev_agent_status(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/dev-agent/status", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert data["status"] == "RUNNING"
    assert "incidents_detected" in data
    assert "repairs_applied" in data


@pytest.mark.asyncio
async def test_list_incidents(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/dev-agent/incidents", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_get_incident_not_found(client: AsyncClient, auth_headers):
    resp = await client.get(
        "/api/v2/dev-agent/incidents/nonexistent-id", headers=auth_headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_repairs(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/dev-agent/repairs", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_rl_metrics(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/dev-agent/rl-metrics", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_episodes" in data
    assert "avg_reward" in data
    assert "q_table_size" in data


@pytest.mark.asyncio
async def test_health_matrix(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/dev-agent/health-matrix", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "services" in data
    assert "overall_status" in data
    assert isinstance(data["services"], list)
    assert len(data["services"]) > 0
    svc = data["services"][0]
    assert "name" in svc
    assert "status" in svc


@pytest.mark.asyncio
async def test_code_changes(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/dev-agent/code-changes", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "changes" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_diagnose_agent(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/api/v2/dev-agent/diagnose/test-agent-id", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["agent_id"] == "test-agent-id"
    assert data["status"] == "diagnosis_started"
    assert "checks" in data
