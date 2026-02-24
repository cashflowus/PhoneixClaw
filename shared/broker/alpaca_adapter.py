import logging
from datetime import datetime

import httpx

from shared.config.base_config import config

logger = logging.getLogger(__name__)

ALPACA_TRADE_BASE = "https://paper-api.alpaca.markets"
ALPACA_LIVE_BASE = "https://api.alpaca.markets"
ALPACA_DATA_BASE = "https://data.alpaca.markets"


class AlpacaOrderError(Exception):
    """Raised when Alpaca rejects an order, carrying the human-readable detail."""


def _raise_with_detail(resp: httpx.Response, *, symbol: str = "") -> None:
    """Raise with Alpaca's JSON error body instead of a generic HTTP message."""
    if resp.status_code < 400:
        return
    detail = ""
    try:
        body = resp.json()
        detail = body.get("message") or body.get("detail") or str(body)
    except Exception:
        detail = resp.text[:500]
    prefix = f"[{symbol}] " if symbol else ""
    msg = f"{prefix}Alpaca {resp.status_code}: {detail}"
    logger.error("Alpaca order error: %s", msg)
    raise AlpacaOrderError(msg)


class AlpacaBrokerAdapter:
    """BrokerAdapter implementation for Alpaca using async httpx."""

    def __init__(
        self,
        api_key: str | None = None,
        secret_key: str | None = None,
        paper: bool | None = None,
    ) -> None:
        self._api_key = api_key or config.broker.api_key
        self._secret_key = secret_key or config.broker.secret_key
        _paper = paper if paper is not None else config.broker.paper
        self._base_url = ALPACA_TRADE_BASE if _paper else ALPACA_LIVE_BASE
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers={
                "APCA-API-KEY-ID": self._api_key,
                "APCA-API-SECRET-KEY": self._secret_key,
            },
            timeout=10.0,
        )
        logger.info("Alpaca broker adapter initialized (paper=%s)", _paper)

    def format_option_symbol(self, ticker: str, expiration: str, option_type: str, strike: float) -> str:
        exp_date = datetime.strptime(expiration, "%Y-%m-%d")
        opt_char = "C" if option_type == "CALL" else "P"
        strike_str = f"{int(strike * 1000):08d}"
        return f"{ticker}{exp_date.strftime('%y%m%d')}{opt_char}{strike_str}"

    async def place_limit_order(self, symbol: str, qty: int, side: str, price: float) -> str:
        payload = {
            "symbol": symbol,
            "qty": str(qty),
            "side": side.lower(),
            "type": "limit",
            "limit_price": str(price),
            "time_in_force": "day",
        }
        resp = await self._client.post("/v2/orders", json=payload)
        _raise_with_detail(resp, symbol=symbol)
        data = resp.json()
        logger.info("Order placed: %s %d %s @ %.2f (ID: %s)", side, qty, symbol, price, data["id"])
        return data["id"]

    async def place_bracket_order(
        self, symbol: str, qty: int, side: str, price: float, take_profit: float, stop_loss: float
    ) -> str:
        payload = {
            "symbol": symbol,
            "qty": str(qty),
            "side": side.lower(),
            "type": "limit",
            "limit_price": str(price),
            "time_in_force": "day",
            "order_class": "bracket",
            "take_profit": {"limit_price": str(take_profit)},
            "stop_loss": {"stop_price": str(stop_loss)},
        }
        resp = await self._client.post("/v2/orders", json=payload)
        _raise_with_detail(resp, symbol=symbol)
        return resp.json()["id"]

    async def cancel_order(self, order_id: str) -> bool:
        resp = await self._client.delete(f"/v2/orders/{order_id}")
        return resp.status_code in (200, 204)

    async def get_order_status(self, order_id: str) -> dict:
        resp = await self._client.get(f"/v2/orders/{order_id}")
        resp.raise_for_status()
        data = resp.json()
        return {
            "status": data["status"],
            "filled_qty": int(data.get("filled_qty") or 0),
            "fill_price": float(data.get("filled_avg_price") or 0),
        }

    async def get_positions(self) -> list[dict]:
        resp = await self._client.get("/v2/positions")
        resp.raise_for_status()
        return [
            {
                "symbol": p["symbol"],
                "qty": int(p["qty"]),
                "avg_entry_price": float(p["avg_entry_price"]),
                "market_value": float(p["market_value"]),
                "current_price": float(p["current_price"]),
                "unrealized_pl": float(p["unrealized_pl"]),
            }
            for p in resp.json()
        ]

    async def get_quote(self, symbol: str) -> dict:
        async with httpx.AsyncClient(
            base_url=ALPACA_DATA_BASE,
            headers={
                "APCA-API-KEY-ID": self._api_key,
                "APCA-API-SECRET-KEY": self._secret_key,
            },
            timeout=5.0,
        ) as client:
            resp = await client.get(f"/v2/stocks/{symbol}/quotes/latest")
            resp.raise_for_status()
            q = resp.json()["quote"]
            return {"bid": float(q["bp"]), "ask": float(q["ap"]), "last": float(q["ap"])}

    async def get_account(self) -> dict:
        resp = await self._client.get("/v2/account")
        resp.raise_for_status()
        data = resp.json()
        return {
            "buying_power": float(data["buying_power"]),
            "cash": float(data["cash"]),
            "equity": float(data["equity"]),
            "portfolio_value": float(data["portfolio_value"]),
        }

    async def close(self) -> None:
        await self._client.aclose()
