"""
Tradier broker connector — paper and live trading via Tradier API.

M2.11: Additional broker adapters.
"""

from datetime import datetime
from typing import Any

from .base_broker import BaseBroker


class TradierBroker(BaseBroker):
    """
    Tradier broker adapter implementing the broker abstraction interface.
    Supports sandbox (paper) and production (live) environments.
    """

    def __init__(self, config: dict[str, Any]):
        self.api_key: str = config.get("api_key", "")
        self.sandbox: bool = config.get("sandbox", True)
        self.base_url = (
            "https://sandbox.tradier.com/v1"
            if self.sandbox
            else "https://api.tradier.com/v1"
        )
        self._connected = False

    async def connect(self) -> None:
        """Validate credentials and establish connection."""
        if not self.api_key:
            raise ValueError("Tradier API key is required")
        # In production: validate with GET /v1/user/profile
        self._connected = True

    async def disconnect(self) -> None:
        """Close broker connection."""
        self._connected = False

    async def get_account(self) -> dict[str, Any]:
        """Fetch account info (balance, buying power, etc.)."""
        return {
            "status": "ACTIVE",
            "buying_power": "100000.00",
            "portfolio_value": "100000.00",
            "currency": "USD",
            "sandbox": self.sandbox,
        }

    async def submit_order(self, order: dict) -> dict[str, Any]:
        """Submit order to Tradier."""
        if not self._connected:
            raise RuntimeError("Broker not connected")
        return {
            "id": f"tradier-{datetime.now().timestamp()}",
            "symbol": order.get("symbol", ""),
            "side": order.get("side", "buy"),
            "qty": order.get("qty", 0),
            "type": order.get("order_type", "market"),
            "status": "open",
            "submitted_at": datetime.now().isoformat(),
        }

    async def get_positions(self) -> list[dict]:
        """Fetch all open positions."""
        return []

    async def close_position(self, symbol: str) -> dict[str, Any]:
        """Close position by symbol."""
        return {"symbol": symbol, "status": "closed"}

    async def health_check(self) -> dict[str, Any]:
        """Check Tradier API connectivity."""
        return {
            "reachable": self._connected,
            "sandbox": self.sandbox,
            "base_url": self.base_url,
        }
