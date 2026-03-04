"""
WebSocket channel management — tracks client subscriptions
and provides broadcast capabilities per channel.

M2.11: Real-time WebSocket gateway.
"""

import asyncio
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)

STANDARD_CHANNELS = frozenset({
    "trades", "positions", "agents", "alerts", "heartbeats",
})


class ChannelManager:
    """Manages WebSocket client subscriptions across named channels."""

    def __init__(self):
        self._channels: dict[str, set[WebSocket]] = {}
        self._client_channels: dict[WebSocket, set[str]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, ws: WebSocket, channel: str) -> None:
        async with self._lock:
            self._channels.setdefault(channel, set()).add(ws)
            self._client_channels.setdefault(ws, set()).add(channel)
        logger.debug("Client subscribed to %s (total: %d)",
                      channel, len(self._channels.get(channel, set())))

    async def unsubscribe(self, ws: WebSocket, channel: str) -> None:
        async with self._lock:
            if channel in self._channels:
                self._channels[channel].discard(ws)
                if not self._channels[channel]:
                    del self._channels[channel]
            if ws in self._client_channels:
                self._client_channels[ws].discard(channel)
                if not self._client_channels[ws]:
                    del self._client_channels[ws]

    async def remove_client(self, ws: WebSocket) -> None:
        """Unsubscribe a client from all channels (e.g. on disconnect)."""
        async with self._lock:
            channels = self._client_channels.pop(ws, set())
            for ch in channels:
                if ch in self._channels:
                    self._channels[ch].discard(ws)
                    if not self._channels[ch]:
                        del self._channels[ch]

    async def broadcast(self, channel: str, message: dict[str, Any]) -> None:
        """Send a JSON message to all subscribers of a channel."""
        async with self._lock:
            subscribers = list(self._channels.get(channel, set()))

        stale: list[WebSocket] = []
        for ws in subscribers:
            try:
                await ws.send_json(message)
            except Exception:
                stale.append(ws)

        for ws in stale:
            await self.remove_client(ws)

    def list_channels(self) -> list[str]:
        return sorted(self._channels.keys())

    def subscriber_count(self, channel: str) -> int:
        return len(self._channels.get(channel, set()))

    def stats(self) -> dict[str, Any]:
        return {
            ch: len(subs) for ch, subs in self._channels.items()
        }
