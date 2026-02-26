"""
Async HTTP client for the Unusual Whales API.

Handles authentication, rate limiting, caching, and response parsing.
"""

import logging
import os
from datetime import datetime, timezone

import httpx

from .cache import UWCache
from .models import (
    GexData,
    MarketTide,
    OptionChain,
    OptionContract,
    OptionsFlow,
)

logger = logging.getLogger(__name__)

UW_BASE_URL = os.getenv("UNUSUAL_WHALES_BASE_URL", "https://api.unusualwhales.com")
UW_API_TOKEN = os.getenv("UNUSUAL_WHALES_API_TOKEN", "")
REDIS_URL = os.getenv("REDIS_URL", None)
CACHE_TTL = int(os.getenv("UW_CACHE_TTL", "300"))


class UnusualWhalesClient:
    """Client for interacting with the Unusual Whales API."""

    def __init__(
        self,
        api_token: str | None = None,
        base_url: str = UW_BASE_URL,
        cache_ttl: int = CACHE_TTL,
        redis_url: str | None = REDIS_URL,
    ):
        self.api_token = api_token or UW_API_TOKEN
        self.base_url = base_url.rstrip("/")
        self.cache = UWCache(redis_url=redis_url, default_ttl=cache_ttl)
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_token}",
                    "Accept": "application/json",
                },
                timeout=httpx.Timeout(30.0, connect=10.0),
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def _request(self, method: str, path: str, params: dict | None = None) -> dict:
        client = await self._get_client()
        resp = await client.request(method, path, params=params)
        resp.raise_for_status()
        return resp.json()

    async def get_option_chain(self, ticker: str, expiration: str | None = None) -> OptionChain:
        """Fetch option chain for a ticker."""
        cache_key = f"chain:{ticker}:{expiration or 'all'}"
        cached = await self.cache.get(cache_key)
        if cached:
            return OptionChain(**cached)

        params: dict = {}
        if expiration:
            params["expiration"] = expiration

        try:
            data = await self._request("GET", f"/api/stock/{ticker}/option-chain", params=params)
            contracts = []
            for item in data.get("data", []):
                contracts.append(OptionContract(
                    ticker=ticker,
                    strike=float(item.get("strike", 0)),
                    option_type="CALL" if item.get("option_type", "").upper().startswith("C") else "PUT",
                    expiration=item.get("expiration", ""),
                    bid=item.get("bid"),
                    ask=item.get("ask"),
                    mid=item.get("mid"),
                    volume=item.get("volume", 0),
                    open_interest=item.get("open_interest", 0),
                    implied_volatility=item.get("implied_volatility"),
                    delta=item.get("delta"),
                    gamma=item.get("gamma"),
                    theta=item.get("theta"),
                    vega=item.get("vega"),
                    iv_rank=item.get("iv_rank"),
                ))
            chain = OptionChain(
                ticker=ticker,
                contracts=contracts,
                updated_at=datetime.now(timezone.utc),
            )
            await self.cache.set(cache_key, chain.model_dump())
            return chain
        except Exception as e:
            logger.error("Failed to fetch option chain for %s: %s", ticker, e)
            return OptionChain(ticker=ticker)

    async def get_options_flow(self, ticker: str | None = None, limit: int = 50) -> list[OptionsFlow]:
        """Fetch recent options flow data."""
        cache_key = f"flow:{ticker or 'all'}:{limit}"
        cached = await self.cache.get(cache_key)
        if cached:
            return [OptionsFlow(**f) for f in cached.get("flows", [])]

        params: dict = {"limit": limit}
        path = f"/api/stock/{ticker}/options-flow" if ticker else "/api/options-flow"

        try:
            data = await self._request("GET", path, params=params)
            flows = []
            for item in data.get("data", []):
                flows.append(OptionsFlow(
                    ticker=item.get("ticker", ticker or ""),
                    strike=float(item.get("strike", 0)),
                    option_type="CALL" if item.get("put_call", "").upper().startswith("C") else "PUT",
                    expiration=item.get("expiration", ""),
                    sentiment=item.get("sentiment"),
                    volume=item.get("volume", 0),
                    open_interest=item.get("open_interest", 0),
                    premium=item.get("premium"),
                    trade_type=item.get("trade_type"),
                    timestamp=item.get("executed_at"),
                ))
            await self.cache.set(cache_key, {"flows": [f.model_dump() for f in flows]})
            return flows
        except Exception as e:
            logger.error("Failed to fetch options flow: %s", e)
            return []

    async def get_gex(self, ticker: str) -> GexData:
        """Fetch GEX (Gamma Exposure) data."""
        cache_key = f"gex:{ticker}"
        cached = await self.cache.get(cache_key)
        if cached:
            return GexData(**cached)

        try:
            data = await self._request("GET", f"/api/stock/{ticker}/gamma-exposure")
            gex_info = data.get("data", {})
            gex = GexData(
                ticker=ticker,
                total_gex=gex_info.get("total_gex"),
                call_gex=gex_info.get("call_gex"),
                put_gex=gex_info.get("put_gex"),
                gex_by_strike=gex_info.get("gex_by_strike", {}),
                zero_gamma_level=gex_info.get("zero_gamma_level"),
            )
            await self.cache.set(cache_key, gex.model_dump())
            return gex
        except Exception as e:
            logger.error("Failed to fetch GEX for %s: %s", ticker, e)
            return GexData(ticker=ticker)

    async def get_market_tide(self) -> MarketTide:
        """Fetch overall market tide / sentiment data."""
        cache_key = "market_tide"
        cached = await self.cache.get(cache_key)
        if cached:
            return MarketTide(**cached)

        try:
            data = await self._request("GET", "/api/market/tide")
            tide_data = data.get("data", {})
            tide = MarketTide(
                net_premium=tide_data.get("net_premium"),
                call_premium=tide_data.get("call_premium"),
                put_premium=tide_data.get("put_premium"),
                call_volume=tide_data.get("call_volume", 0),
                put_volume=tide_data.get("put_volume", 0),
                put_call_ratio=tide_data.get("put_call_ratio"),
                timestamp=datetime.now(timezone.utc),
            )
            await self.cache.set(cache_key, tide.model_dump())
            return tide
        except Exception as e:
            logger.error("Failed to fetch market tide: %s", e)
            return MarketTide()

    async def health_check(self) -> bool:
        """Check if the API is reachable and token is valid."""
        try:
            await self._request("GET", "/api/market/tide")
            return True
        except Exception:
            return False
