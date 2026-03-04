"""
News API connector — aggregates news from multiple sources.

M2.8: News API connector for market-moving headlines.
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


@register_connector(ConnectorType.NEWS_API)
class NewsApiConnector(BaseConnector):
    """
    Connects to News API (newsapi.org) and aggregates headlines from
    multiple sources. Supports symbol/topic filters.
    """

    @property
    def connector_type(self) -> ConnectorType:
        return ConnectorType.NEWS_API

    def __init__(self, connector_id: str, config: dict[str, Any]):
        super().__init__(connector_id, config)
        self.api_key: str = config.get("api_key", "")
        self.sources: list[str] = config.get("sources", [])
        self.symbols: list[str] = config.get("symbols", [])
        self.poll_interval: int = config.get("poll_interval_sec", 60)
        self._client = None
        self._message_queue: asyncio.Queue[ConnectorMessage] = asyncio.Queue()

    async def connect(self) -> None:
        """Initialize News API connection."""
        if not self.api_key:
            self.status = ConnectorStatus.ERROR
            raise ValueError("News API api_key is required")
        self.status = ConnectorStatus.CONNECTING
        # In production: httpx.AsyncClient for newsapi.org
        self.status = ConnectorStatus.ACTIVE

    async def disconnect(self) -> None:
        """Close News API connection."""
        self._client = None
        self.status = ConnectorStatus.DISCONNECTED

    async def health_check(self) -> dict[str, Any]:
        """Check News API connectivity."""
        return {
            "reachable": self.status == ConnectorStatus.ACTIVE,
            "source_count": len(self.sources),
            "symbol_count": len(self.symbols),
            "status": self.status.value,
        }

    async def stream_messages(self) -> AsyncIterator[ConnectorMessage]:
        """Yield news articles as they are fetched."""
        while self.status == ConnectorStatus.ACTIVE:
            try:
                msg = await asyncio.wait_for(self._message_queue.get(), timeout=float(self.poll_interval))
                self._last_message_at = datetime.now()
                yield msg
            except asyncio.TimeoutError:
                continue
            except Exception:
                self._error_count += 1
                if self._error_count > 10:
                    self.status = ConnectorStatus.ERROR
                    break
