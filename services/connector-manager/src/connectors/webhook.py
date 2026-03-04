"""
Custom webhook connector — receives arbitrary data from external sources.

M2.8: Webhook connector for custom integrations.
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


@register_connector(ConnectorType.CUSTOM_WEBHOOK)
class WebhookConnector(BaseConnector):
    """
    Custom webhook connector that accepts HTTP POST payloads from arbitrary
    data sources. Exposes an endpoint URL for external systems to push data.
    """

    @property
    def connector_type(self) -> ConnectorType:
        return ConnectorType.CUSTOM_WEBHOOK

    def __init__(self, connector_id: str, config: dict[str, Any]):
        super().__init__(connector_id, config)
        self.secret_header: str = config.get("secret_header", "")
        self.allowed_origins: list[str] = config.get("allowed_origins", [])
        self._message_queue: asyncio.Queue[ConnectorMessage] = asyncio.Queue()

    async def connect(self) -> None:
        """Register webhook endpoint (no persistent connection)."""
        self.status = ConnectorStatus.CONNECTING
        # Webhook is passive; endpoint registration happens at router level
        self.status = ConnectorStatus.ACTIVE

    async def disconnect(self) -> None:
        """Unregister webhook endpoint."""
        self.status = ConnectorStatus.DISCONNECTED

    async def health_check(self) -> dict[str, Any]:
        """Check webhook readiness."""
        return {
            "reachable": self.status == ConnectorStatus.ACTIVE,
            "status": self.status.value,
        }

    async def stream_messages(self) -> AsyncIterator[ConnectorMessage]:
        """Yield messages pushed via webhook POST."""
        while self.status == ConnectorStatus.ACTIVE:
            try:
                msg = await asyncio.wait_for(self._message_queue.get(), timeout=60.0)
                self._last_message_at = datetime.now()
                yield msg
            except asyncio.TimeoutError:
                continue
            except Exception:
                self._error_count += 1
                if self._error_count > 10:
                    self.status = ConnectorStatus.ERROR
                    break
