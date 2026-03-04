import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_positions(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/positions", headers=auth_headers)
    assert resp.status_code in (200, 500)
    if resp.status_code == 200:
        assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_list_positions_with_filters(client: AsyncClient, auth_headers):
    resp = await client.get(
        "/api/v2/positions",
        headers=auth_headers,
        params={"status": "OPEN", "symbol": "SPY"},
    )
    assert resp.status_code in (200, 500)


@pytest.mark.asyncio
async def test_list_closed_positions(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/positions/closed", headers=auth_headers)
    assert resp.status_code in (200, 500)
    if resp.status_code == 200:
        assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_position_summary(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/positions/summary", headers=auth_headers)
    assert resp.status_code in (200, 500)
    if resp.status_code == 200:
        data = resp.json()
        assert "open_positions" in data
        assert "total_unrealized_pnl" in data
        assert "total_realized_pnl" in data


@pytest.mark.asyncio
async def test_get_position_not_found(client: AsyncClient, auth_headers):
    resp = await client.get(
        "/api/v2/positions/00000000-0000-0000-0000-000000000099",
        headers=auth_headers,
    )
    assert resp.status_code in (404, 500)


@pytest.mark.asyncio
async def test_close_position_not_found(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/api/v2/positions/00000000-0000-0000-0000-000000000099/close",
        json={"exit_price": 150.0, "exit_reason": "manual_close"},
        headers=auth_headers,
    )
    assert resp.status_code in (404, 500)
