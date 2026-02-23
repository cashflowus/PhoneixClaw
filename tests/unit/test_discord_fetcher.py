"""Unit tests for Discord channel history fetcher (mocked)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from shared.backtest import discord_fetcher


class TestFetchChannelHistory:
    """Test fetch_channel_history with mocked discord.Client."""

    @pytest.mark.asyncio
    async def test_raises_when_discord_not_installed(self):
        """Raises ImportError when discord module is not available."""
        with patch.object(discord_fetcher, "discord", None):
            with pytest.raises(ImportError, match="discord.py"):
                await discord_fetcher.fetch_channel_history(
                    channel_id=123,
                    after=datetime(2025, 1, 1, tzinfo=timezone.utc),
                    before=datetime(2025, 1, 31, tzinfo=timezone.utc),
                    token="fake",
                    auth_type="bot",
                )

    @pytest.mark.asyncio
    async def test_message_shape_and_sorting(self):
        """Verify returned messages have content, timestamp, author, message_id and are sorted."""
        if discord_fetcher.discord is None:
            pytest.skip("discord not installed")

        from shared.backtest.discord_fetcher import fetch_channel_history

        # Create mock messages (out of order to test sorting)
        msg1 = MagicMock()
        msg1.content = "BTO AAPL 190C 3/21 @ 2.50"
        msg1.created_at = datetime(2025, 1, 15, 11, 0, 0, tzinfo=timezone.utc)
        msg1.author = "User1"
        msg1.id = 1001

        msg2 = MagicMock()
        msg2.content = "First message"
        msg2.created_at = datetime(2025, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        msg2.author = "User2"
        msg2.id = 1000

        async def history_gen(**kwargs):
            for m in [msg1, msg2]:
                yield m

        fake_channel = MagicMock()
        fake_channel.history = history_gen

        async def mock_start(self, token, *, bot=True):
            self.get_channel = MagicMock(return_value=fake_channel)
            self.fetch_channel = AsyncMock(return_value=fake_channel)
            await self.on_ready()
            await self.close()

        with patch.object(discord_fetcher.discord.Client, "start", mock_start):
            result = await fetch_channel_history(
                channel_id=999,
                after=datetime(2025, 1, 1, tzinfo=timezone.utc),
                before=datetime(2025, 1, 31, tzinfo=timezone.utc),
                token="fake-token",
                auth_type="bot",
            )

        assert len(result) == 2
        for m in result:
            assert "content" in m
            assert "timestamp" in m
            assert "author" in m
            assert "message_id" in m
        # Should be sorted by timestamp ascending
        assert result[0]["timestamp"] <= result[1]["timestamp"]
        assert result[0]["content"] == "First message"
        assert result[1]["content"] == "BTO AAPL 190C 3/21 @ 2.50"
