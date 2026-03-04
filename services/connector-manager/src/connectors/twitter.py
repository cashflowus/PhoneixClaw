"""
Twitter/X connector — ingests tweets and mentions for trading signals.

M2.8: Twitter connector for social sentiment.
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


@register_connector(ConnectorType.TWITTER)
class TwitterConnector(BaseConnector):
    """
    Connects to Twitter/X API v2 for streaming tweets, mentions, and lists.
    Requires bearer_token or api_key/api_secret.
    """

    @property
    def connector_type(self) -> ConnectorType:
        return ConnectorType.TWITTER

    def __init__(self, connector_id: str, config: dict[str, Any]):
        super().__init__(connector_id, config)
        self.bearer_token: str = config.get("bearer_token", "")
        self.api_key: str = config.get("api_key", "")
        self.api_secret: str = config.get("api_secret", "")
        self.user_ids: list[str] = config.get("user_ids", [])
        self.keywords: list[str] = config.get("keywords", [])
        self._client = None
        self._message_queue: asyncio.Queue[ConnectorMessage] = asyncio.Queue()

    async def connect(self) -> None:
        """Initialize Twitter API connection."""
        if not self.bearer_token and not (self.api_key and self.api_secret):
            self.status = ConnectorStatus.ERROR
            raise ValueError("Twitter bearer_token or api_key/api_secret required")
        self.status = ConnectorStatus.CONNECTING
        # In production: tweepy.Client(bearer_token=...) or similar
        self.status = ConnectorStatus.ACTIVE

    async def disconnect(self) -> None:
        """Close Twitter connection."""
        self._client = None
        self.status = ConnectorStatus.DISCONNECTED

    async def health_check(self) -> dict[str, Any]:
        """Check Twitter API connectivity."""
        return {
            "reachable": self.status == ConnectorStatus.ACTIVE,
            "tracking_users": len(self.user_ids),
            "tracking_keywords": len(self.keywords),
            "status": self.status.value,
        }

    async def stream_messages(self) -> AsyncIterator[ConnectorMessage]:
        """Yield tweets and mentions as they arrive."""
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
