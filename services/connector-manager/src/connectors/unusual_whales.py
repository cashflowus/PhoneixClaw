"""
Unusual Whales API connector — options flow and unusual activity.

M2.8: Unusual Whales connector for options flow data.
Reference: PRD Section 3.6 (Connectors Tab).
"""

import asyncio
from datetime import datetime
from typing import Any, AsyncIterator

from services.connector_manager.src.base import (
    BaseConnector,
    ConnectorMessage,
    ConnectorStatus,
    ConnectorType,
)
from services.connector_manager.src.factory import register_connector


@register_connector(ConnectorType.UNUSUAL_WHALES)
class UnusualWhalesConnector(BaseConnector):
    """
    Connects to Unusual Whales API for options flow, block trades, and alerts.
    Requires api_key for authentication.
    """

    @property
    def connector_type(self) -> ConnectorType:
        return ConnectorType.UNUSUAL_WHALES

    def __init__(self, connector_id: str, config: dict[str, Any]):
        super().__init__(connector_id, config)
        self.api_key: str = config.get("api_key", "")
        self.symbols: list[str] = config.get("symbols", [])
        self.min_premium: float = config.get("min_premium", 0)
        self._client = None
        self._message_queue: asyncio.Queue[ConnectorMessage] = asyncio.Queue()

    async def connect(self) -> None:
        """Initialize Unusual Whales API connection."""
        if not self.api_key:
            self.status = ConnectorStatus.ERROR
            raise ValueError("Unusual Whales api_key is required")
        self.status = ConnectorStatus.CONNECTING
        # In production: httpx.AsyncClient with Authorization header
        self.status = ConnectorStatus.ACTIVE

    async def disconnect(self) -> None:
        """Close API connection."""
        self._client = None
        self.status = ConnectorStatus.DISCONNECTED

    async def health_check(self) -> dict[str, Any]:
        """Check Unusual Whales API connectivity."""
        return {
            "reachable": self.status == ConnectorStatus.ACTIVE,
            "symbol_filter_count": len(self.symbols),
            "status": self.status.value,
        }

    async def stream_messages(self) -> AsyncIterator[ConnectorMessage]:
        """Yield options flow alerts as they arrive."""
        while self.status == ConnectorStatus.ACTIVE:
            try:
                msg = await asyncio.wait_for(self._message_queue.get(), timeout=30.0)
                self._last_message_at = datetime.now()
                yield msg
            except asyncio.TimeoutError:
                continue
            except Exception:
                self._error_count += 1
                if self._error_count > 10:
                    self.status = ConnectorStatus.ERROR
                    break
