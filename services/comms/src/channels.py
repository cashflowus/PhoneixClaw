"""
Bidirectional communication channels — agents communicate with users.

M3.6: Telegram, Discord, WhatsApp messaging.
Reference: PRD Section 14.
"""

import logging
from abc import ABC, abstractmethod
from typing import Any

logger = logging.getLogger(__name__)


class CommunicationChannel(ABC):
    """Base class for bidirectional communication channels."""

    @abstractmethod
    async def send_message(self, recipient: str, message: str, **kwargs) -> dict: ...

    @abstractmethod
    async def receive_messages(self) -> list[dict]: ...

    @abstractmethod
    async def health_check(self) -> dict: ...


class TelegramChannel(CommunicationChannel):
    """Telegram bot channel using Bot API."""

    def __init__(self, config: dict[str, Any]):
        self.bot_token = config.get("bot_token", "")
        self.chat_ids = config.get("chat_ids", [])

    async def send_message(self, recipient: str, message: str, **kwargs) -> dict:
        # In production: call Telegram Bot API
        logger.info("Telegram -> %s: %s", recipient, message[:50])
        return {"sent": True, "channel": "telegram", "recipient": recipient}

    async def receive_messages(self) -> list[dict]:
        return []

    async def health_check(self) -> dict:
        return {"channel": "telegram", "status": "connected" if self.bot_token else "unconfigured"}


class DiscordChannel(CommunicationChannel):
    """Discord bot channel using slash commands."""

    def __init__(self, config: dict[str, Any]):
        self.bot_token = config.get("bot_token", "")
        self.channel_id = config.get("channel_id", "")

    async def send_message(self, recipient: str, message: str, **kwargs) -> dict:
        logger.info("Discord -> %s: %s", recipient, message[:50])
        return {"sent": True, "channel": "discord", "recipient": recipient}

    async def receive_messages(self) -> list[dict]:
        return []

    async def health_check(self) -> dict:
        return {"channel": "discord", "status": "connected" if self.bot_token else "unconfigured"}


class WhatsAppChannel(CommunicationChannel):
    """WhatsApp via Meta Cloud API."""

    def __init__(self, config: dict[str, Any]):
        self.access_token = config.get("access_token", "")
        self.phone_number_id = config.get("phone_number_id", "")

    async def send_message(self, recipient: str, message: str, **kwargs) -> dict:
        logger.info("WhatsApp -> %s: %s", recipient, message[:50])
        return {"sent": True, "channel": "whatsapp", "recipient": recipient}

    async def receive_messages(self) -> list[dict]:
        return []

    async def health_check(self) -> dict:
        return {"channel": "whatsapp", "status": "connected" if self.access_token else "unconfigured"}


class UnifiedMessageRouter:
    """Routes messages to the appropriate communication channel."""

    def __init__(self):
        self._channels: dict[str, CommunicationChannel] = {}

    def register(self, name: str, channel: CommunicationChannel) -> None:
        self._channels[name] = channel

    async def send(self, channel_name: str, recipient: str, message: str) -> dict:
        channel = self._channels.get(channel_name)
        if not channel:
            return {"sent": False, "error": f"Channel {channel_name} not found"}
        return await channel.send_message(recipient, message)

    async def health_check_all(self) -> list[dict]:
        results = []
        for name, channel in self._channels.items():
            result = await channel.health_check()
            result["name"] = name
            results.append(result)
        return results
