import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_performance_summary(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/performance/summary", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_pnl" in data
    assert "win_rate" in data
    assert "sharpe_ratio" in data
    assert "total_trades" in data
    assert "profit_factor" in data


@pytest.mark.asyncio
async def test_portfolio_performance(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/performance/portfolio", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_value" in data
    assert "equity_curve" in data


@pytest.mark.asyncio
async def test_portfolio_performance_with_period(client: AsyncClient, auth_headers):
    resp = await client.get(
        "/api/v2/performance/portfolio",
        headers=auth_headers,
        params={"period": "30d"},
    )
    assert resp.status_code == 200
    assert resp.json()["period"] == "30d"


@pytest.mark.asyncio
async def test_agents_performance(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/performance/agents", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "agents" in data
    assert isinstance(data["agents"], list)


@pytest.mark.asyncio
async def test_risk_metrics(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/performance/risk", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "var_95" in data
    assert "max_drawdown" in data


@pytest.mark.asyncio
async def test_instruments_performance(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/performance/instruments", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "instruments" in data
    assert isinstance(data["instruments"], list)
