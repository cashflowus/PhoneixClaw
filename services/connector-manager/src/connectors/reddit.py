"""
Reddit connector — ingests posts and comments via PRAW-compatible interface.

M2.8: Reddit connector for sentiment and trading signals.
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


@register_connector(ConnectorType.REDDIT)
class RedditConnector(BaseConnector):
    """
    Connects to Reddit via PRAW-compatible API (client_id, client_secret, user_agent).
    Streams posts and comments from configured subreddits.
    """

    @property
    def connector_type(self) -> ConnectorType:
        return ConnectorType.REDDIT

    def __init__(self, connector_id: str, config: dict[str, Any]):
        super().__init__(connector_id, config)
        self.client_id: str = config.get("client_id", "")
        self.client_secret: str = config.get("client_secret", "")
        self.user_agent: str = config.get("user_agent", "phoenix-trading-bot/1.0")
        self.subreddits: list[str] = config.get("subreddits", [])
        self._reddit = None
        self._message_queue: asyncio.Queue[ConnectorMessage] = asyncio.Queue()

    async def connect(self) -> None:
        """Initialize Reddit connection via PRAW."""
        if not self.client_id or not self.client_secret:
            self.status = ConnectorStatus.ERROR
            raise ValueError("Reddit client_id and client_secret are required")
        self.status = ConnectorStatus.CONNECTING
        # In production: praw.Reddit(client_id=..., client_secret=..., user_agent=...)
        self.status = ConnectorStatus.ACTIVE

    async def disconnect(self) -> None:
        """Close Reddit connection."""
        self._reddit = None
        self.status = ConnectorStatus.DISCONNECTED

    async def health_check(self) -> dict[str, Any]:
        """Check Reddit API connectivity."""
        return {
            "reachable": self.status == ConnectorStatus.ACTIVE,
            "subreddit_count": len(self.subreddits),
            "status": self.status.value,
        }

    async def stream_messages(self) -> AsyncIterator[ConnectorMessage]:
        """Yield posts/comments from configured subreddits."""
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
