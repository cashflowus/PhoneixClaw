import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_network_graph(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/network/graph", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "nodes" in data
    assert "edges" in data
    assert isinstance(data["nodes"], list)
    assert isinstance(data["edges"], list)


@pytest.mark.asyncio
async def test_network_graph_has_structure(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/network/graph", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    if data["nodes"]:
        node = data["nodes"][0]
        assert "id" in node
        assert "type" in node
        assert "label" in node
    if data["edges"]:
        edge = data["edges"][0]
        assert "from" in edge
        assert "to" in edge


@pytest.mark.asyncio
async def test_network_messages(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/network/messages", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "messages" in data
    assert isinstance(data["messages"], list)


@pytest.mark.asyncio
async def test_network_messages_with_pattern_filter(client: AsyncClient, auth_headers):
    resp = await client.get(
        "/api/v2/network/messages",
        headers=auth_headers,
        params={"pattern": "broadcast"},
    )
    assert resp.status_code == 200
    data = resp.json()
    for msg in data["messages"]:
        assert msg["pattern"] == "broadcast"


@pytest.mark.asyncio
async def test_network_graph_with_limit(client: AsyncClient, auth_headers):
    resp = await client.get(
        "/api/v2/network/graph",
        headers=auth_headers,
        params={"limit": 5},
    )
    assert resp.status_code == 200
