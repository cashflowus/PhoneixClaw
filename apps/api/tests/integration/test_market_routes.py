import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_market_indices(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/market/indices", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "indices" in data
    assert isinstance(data["indices"], list)
    assert len(data["indices"]) > 0
    idx = data["indices"][0]
    assert "symbol" in idx
    assert "price" in idx
    assert "change_pct" in idx


@pytest.mark.asyncio
async def test_market_movers(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/market/movers", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "gainers" in data
    assert "losers" in data
    assert isinstance(data["gainers"], list)
    assert isinstance(data["losers"], list)


@pytest.mark.asyncio
async def test_market_news(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/market/news", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "articles" in data
    assert isinstance(data["articles"], list)
    if data["articles"]:
        article = data["articles"][0]
        assert "title" in article
        assert "source" in article


@pytest.mark.asyncio
async def test_market_watchlist(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v2/market/watchlist", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    if data["items"]:
        item = data["items"][0]
        assert "symbol" in item
        assert "price" in item


@pytest.mark.asyncio
async def test_market_indices_without_auth(client: AsyncClient):
    resp = await client.get("/api/v2/market/indices")
    assert resp.status_code in (200, 401, 403)
