import logging
from datetime import datetime, timezone

import discord
from discord import Intents, Message

from shared.kafka_utils.producer import KafkaProducerWrapper

logger = logging.getLogger(__name__)


class DiscordIngestor:
    """Per-user Discord ingestor that publishes messages to Kafka."""

    def __init__(
        self,
        bot_token: str,
        target_channels: list[int],
        user_id: str,
        producer: KafkaProducerWrapper | None = None,
    ) -> None:
        self._token = bot_token
        self._target_channels = set(target_channels)
        self._user_id = user_id
        self._producer = producer or KafkaProducerWrapper()
        self._dedup_cache: set[str] = set()

        intents = Intents.default()
        intents.message_content = True
        self._client = discord.Client(intents=intents)

        self._client.event(self._on_ready)
        self._client.event(self._on_message)

    async def _on_ready(self) -> None:
        logger.info("Discord ingestor ready (user=%s, channels=%s)", self._user_id, self._target_channels)

    async def _on_message(self, message: Message) -> None:
        if message.author == self._client.user:
            return
        if message.channel.id not in self._target_channels:
            return

        content = message.content.strip()
        if not content:
            return

        msg_key = f"{message.id}"
        if msg_key in self._dedup_cache:
            return
        self._dedup_cache.add(msg_key)
        if len(self._dedup_cache) > 10000:
            self._dedup_cache.clear()

        raw_msg = {
            "content": content,
            "message_id": str(message.id),
            "author": str(message.author),
            "channel_name": str(message.channel),
            "channel_id": str(message.channel.id),
            "user_id": self._user_id,
            "source": "discord",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        headers = [
            ("user_id", self._user_id.encode("utf-8")),
            ("channel_id", str(message.channel.id).encode("utf-8")),
        ]

        try:
            await self._producer.send("raw-messages", value=raw_msg, key=msg_key, headers=headers)
            logger.debug("Published message %s to raw-messages", msg_key)
        except Exception:
            logger.exception("Failed to publish message %s", msg_key)

    async def start(self) -> None:
        if not self._producer.is_started:
            await self._producer.start()
        await self._client.start(self._token)

    async def stop(self) -> None:
        await self._client.close()
        await self._producer.stop()
