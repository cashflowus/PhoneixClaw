"""Fetch Discord channel history for backtesting.

Uses discord.py or discord.py-self to fetch messages within a date range.
Handles rate limits with small delays between paginated fetches.
"""
import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Try discord.py-self first (supports user tokens), fall back to discord.py
try:
    import discord
except ImportError:
    discord = None  # type: ignore[assignment]


async def fetch_channel_history(
    channel_id: int,
    after: datetime,
    before: datetime,
    token: str,
    auth_type: str = "user_token",
) -> list[dict]:
    """
    Fetch Discord channel messages within the given date range.

    Args:
        channel_id: Discord channel ID (integer)
        after: Start of date range (inclusive)
        before: End of date range (inclusive)
        token: Discord bot or user token
        auth_type: "bot" or "user_token"

    Returns:
        List of dicts: {content, timestamp, author, message_id} sorted by timestamp asc.
    """
    if discord is None:
        raise ImportError("discord.py or discord.py-self is required for backtest. Install: pip install discord.py-self")

    messages: list[dict] = []
    is_bot = auth_type == "bot"

    class HistoryClient(discord.Client):
        def __init__(self) -> None:
            intents = discord.Intents.default()
            intents.message_content = True
            intents.guilds = True
            super().__init__(intents=intents)

        async def on_ready(self) -> None:
            try:
                channel = self.get_channel(channel_id)
                if channel is None:
                    channel = await self.fetch_channel(channel_id)

                if not hasattr(channel, "history"):
                    logger.error("Channel %s is not a text channel", channel_id)
                    return

                async for msg in channel.history(limit=5000, after=after, before=before, oldest_first=True):
                    ts = msg.created_at
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=timezone.utc)
                    messages.append({
                        "content": msg.content or "",
                        "timestamp": ts,
                        "author": str(msg.author),
                        "message_id": str(msg.id),
                    })
                    if len(messages) % 100 == 0:
                        await asyncio.sleep(0.5)
            finally:
                await self.close()

    client = HistoryClient()

    try:
        await client.start(token, bot=is_bot)
    except Exception as e:
        logger.error("Discord fetch failed: %s", e)
        if "401" in str(e) or "Unauthorized" in str(e) or "LoginFailure" in type(e).__name__:
            raise ValueError("Invalid Discord token") from e
        raise

    # Sort by timestamp ascending
    messages.sort(key=lambda m: m["timestamp"])
    logger.info("Fetched %d messages from channel %s", len(messages), channel_id)
    return messages
