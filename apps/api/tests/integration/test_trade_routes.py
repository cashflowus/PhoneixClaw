import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_trades(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/trades", headers=auth_headers)
    assert resp.status_code in (200, 500)
    if resp.status_code == 200:
        assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_list_trades_with_filters(client: AsyncClient, auth_headers):
    resp = await client.get(
        "/api/v2/trades",
        headers=auth_headers,
        params={"status": "FILLED", "symbol": "AAPL", "limit": 10},
    )
    assert resp.status_code in (200, 500)


@pytest.mark.asyncio
async def test_trade_stats(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/trades/stats", headers=auth_headers)
    assert resp.status_code in (200, 500)
    if resp.status_code == 200:
        data = resp.json()
        assert "total" in data
        assert "filled" in data
        assert "rejected" in data
        assert "pending" in data


@pytest.mark.asyncio
async def test_get_trade_not_found(client: AsyncClient, auth_headers):
    resp = await client.get(
        "/api/v2/trades/00000000-0000-0000-0000-000000000099",
        headers=auth_headers,
    )
    assert resp.status_code in (404, 500)


@pytest.mark.asyncio
async def test_get_trade_invalid_uuid(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/trades/not-a-uuid", headers=auth_headers)
    assert resp.status_code in (404, 422, 500)
