import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models.trade import TickerSentiment

logger = logging.getLogger(__name__)

WINDOW_MINUTES = 30


def _current_window_start() -> datetime:
    now = datetime.now(timezone.utc)
    minute = (now.minute // WINDOW_MINUTES) * WINDOW_MINUTES
    return now.replace(minute=minute, second=0, microsecond=0)


async def update_ticker_aggregate(
    session: AsyncSession,
    ticker: str,
    sentiment_label: str,
    sentiment_score: float,
) -> dict | None:
    """Upsert the rolling 30-min aggregation for a ticker.
    Returns the aggregate dict if a Kafka signal should be emitted."""
    period_start = _current_window_start()
    period_end = period_start + timedelta(minutes=WINDOW_MINUTES)

    result = await session.execute(
        select(TickerSentiment).where(
            TickerSentiment.ticker == ticker,
            TickerSentiment.period_start == period_start,
        )
    )
    agg = result.scalar_one_or_none()

    label_lower = sentiment_label.lower()
    if agg is None:
        agg = TickerSentiment(
            id=uuid.uuid4(),
            ticker=ticker,
            period_start=period_start,
            period_end=period_end,
            sentiment_label=sentiment_label,
            sentiment_score=sentiment_score,
            message_count=1,
            bullish_count=1 if "bullish" in label_lower else 0,
            bearish_count=1 if "bearish" in label_lower else 0,
            neutral_count=1 if label_lower == "neutral" else 0,
            mention_change_pct=None,
            sources={},
        )
        session.add(agg)
    else:
        agg.message_count += 1
        if "bullish" in label_lower:
            agg.bullish_count += 1
        elif "bearish" in label_lower:
            agg.bearish_count += 1
        else:
            agg.neutral_count += 1

        total = agg.bullish_count + agg.bearish_count + agg.neutral_count
        if total > 0:
            net_score = (agg.bullish_count - agg.bearish_count) / total
            agg.sentiment_score = round(net_score, 4)
            if net_score > 0.4:
                agg.sentiment_label = "Very Bullish"
            elif net_score > 0.1:
                agg.sentiment_label = "Bullish"
            elif net_score < -0.4:
                agg.sentiment_label = "Very Bearish"
            elif net_score < -0.1:
                agg.sentiment_label = "Bearish"
            else:
                agg.sentiment_label = "Neutral"
        agg.updated_at = datetime.now(timezone.utc)

    prev_start = period_start - timedelta(minutes=WINDOW_MINUTES)
    prev_result = await session.execute(
        select(TickerSentiment).where(
            TickerSentiment.ticker == ticker,
            TickerSentiment.period_start == prev_start,
        )
    )
    prev_agg = prev_result.scalar_one_or_none()
    if prev_agg and prev_agg.message_count > 0:
        change = ((agg.message_count - prev_agg.message_count) / prev_agg.message_count) * 100
        agg.mention_change_pct = round(change, 2)
    else:
        agg.mention_change_pct = None

    await session.flush()

    return {
        "ticker": agg.ticker,
        "sentiment_label": agg.sentiment_label,
        "sentiment_score": float(agg.sentiment_score),
        "message_count": agg.message_count,
        "mention_change_pct": float(agg.mention_change_pct) if agg.mention_change_pct else None,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
    }
