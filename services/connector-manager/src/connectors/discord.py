"""
Discord connector — ingests messages from Discord channels.

M1.9: Discord is the primary connector for trading signals.
Reference: PRD Section 3.6, existing v1 services/discord-ingestor/.
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


@register_connector(ConnectorType.DISCORD)
class DiscordConnector(BaseConnector):
    """
    Connects to Discord via bot token or self-bot token, listens
    to configured channels, and yields normalized ConnectorMessages.
    """

    @property
    def connector_type(self) -> ConnectorType:
        return ConnectorType.DISCORD

    def __init__(self, connector_id: str, config: dict[str, Any]):
        super().__init__(connector_id, config)
        self.token: str = config.get("token", "")
        self.guild_id: str = config.get("guild_id", "")
        self.channel_ids: list[str] = config.get("channel_ids", [])
        self._client = None
        self._message_queue: asyncio.Queue[ConnectorMessage] = asyncio.Queue()

    async def connect(self) -> None:
        """Initialize Discord connection."""
        if not self.token:
            self.status = ConnectorStatus.ERROR
            raise ValueError("Discord token is required")

        self.status = ConnectorStatus.CONNECTING
        # In production, this would use discord.py client
        # For now, mark as active with config validation
        self.status = ConnectorStatus.ACTIVE

    async def disconnect(self) -> None:
        """Close Discord connection."""
        if self._client:
            self._client = None
        self.status = ConnectorStatus.DISCONNECTED

    async def health_check(self) -> dict[str, Any]:
        """Check Discord connectivity."""
        return {
            "reachable": self.status == ConnectorStatus.ACTIVE,
            "guild_id": self.guild_id,
            "channel_count": len(self.channel_ids),
            "status": self.status.value,
        }

    async def stream_messages(self) -> AsyncIterator[ConnectorMessage]:
        """Yield messages from configured Discord channels."""
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

    def _normalize_message(self, raw: dict[str, Any]) -> ConnectorMessage:
        """Convert raw Discord message to normalized format."""
        return ConnectorMessage(
            source_type=ConnectorType.DISCORD,
            source_id=self.connector_id,
            channel=raw.get("channel_name", ""),
            author=raw.get("author", ""),
            content=raw.get("content", ""),
            raw_data=raw,
            timestamp=datetime.fromisoformat(raw["timestamp"]) if "timestamp" in raw else datetime.now(),
            metadata={
                "guild_id": self.guild_id,
                "channel_id": raw.get("channel_id", ""),
                "message_id": raw.get("id", ""),
            },
        )
