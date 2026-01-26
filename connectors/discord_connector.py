import asyncio
import logging
import discord
from discord import Intents, Message
from config.config_loader import settings
from db.db_util import (
    save_filtered_message, save_trade_candidate, init_db
)
from parsing.parsing import parse_tickers_and_options
from services.message_parser_service import parse_and_store_message

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("discord_connector")

intents = Intents.default()
intents.message_content = True

client = discord.Client(intents=intents)

@client.event
async def on_ready():
    logger.info(f"Logged in as {client.user} (id: {client.user.id})")
    await init_db()
    logger.info("Available text channels:")
    for guild in client.guilds:
        for channel in guild.text_channels:
            logger.info(f"- {channel.name}: {channel.id}")

@client.event
async def on_message(message: Message):
    if message.author == client.user:
        return
    if message.channel.id not in settings.TARGET_CHANNELS:
        return

    content = message.content.strip()
    if not content:
        return

    logger.info(f"[MSG] {message.author}: {content}")
    
    # Legacy parsing (for backward compatibility)
    parsed = parse_tickers_and_options(content)

    # Persist filtered message (legacy)
    await save_filtered_message({
        "id": message.id,
        "author": str(message.author),
        "content": content,
        "ts": message.created_at.isoformat(),
        "channel": str(message.channel),
        "parsed": parsed
    })

    # Persist trade candidate if detected (legacy)
    if parsed["trade"]:
        await save_trade_candidate(parsed, {
            "id": message.id,
            "author": str(message.author),
            "content": content,
            "ts": message.created_at.isoformat(),
            "channel": str(message.channel),
        })
    
    # NEW: Parse and store to trade queue using message parser service
    try:
        trade_ids = await parse_and_store_message(
            message_text=content,
            source="discord",
            source_message_id=str(message.id)
        )
        if trade_ids:
            logger.info(f"Stored {len(trade_ids)} trade(s) to queue: {trade_ids}")
    except Exception as e:
        logger.error(f"Error parsing and storing message: {e}", exc_info=True)

def run():
    logger.info("Starting Discord Connector (Message Parser Service)...")
    client.run(settings.DISCORD_BOT_TOKEN)
