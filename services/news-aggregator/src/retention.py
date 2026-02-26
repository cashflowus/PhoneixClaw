import logging
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa

from shared.models.database import engine

logger = logging.getLogger(__name__)

MAX_AGE_HOURS = 48


async def purge_old_news():
    """Delete news headlines older than MAX_AGE_HOURS."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)
    async with engine.begin() as conn:
        result = await conn.execute(
            sa.text("DELETE FROM news_headlines WHERE created_at < :cutoff"),
            {"cutoff": cutoff},
        )
        deleted = result.rowcount
    if deleted:
        logger.info("Retention: purged %d old news headlines", deleted)
    return deleted
