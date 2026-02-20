import asyncio
import logging

import redis.asyncio as redis

from shared.config.base_config import config
from shared.models.database import engine

logger = logging.getLogger(__name__)


async def warmup_connections():
    """Pre-connect to all infrastructure. Call at service startup."""
    tasks = []
    tasks.append(_warmup_db())
    tasks.append(_warmup_redis())
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for r in results:
        if isinstance(r, Exception):
            logger.warning("Warmup partial failure: %s", r)
    logger.info("Connection warmup complete")


async def _warmup_db():
    from sqlalchemy import text

    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    logger.debug("DB connection warmed up")


async def _warmup_redis():
    r = redis.from_url(config.redis.url)
    await r.ping()
    await r.aclose()
    logger.debug("Redis connection warmed up")
