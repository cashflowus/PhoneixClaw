"""
Narrative Sentiment API routes: sentiment feed, fed-watch, social, earnings, analyst-moves.

Phoenix v3 — Sentiment from DB channel messages (FinBERT) + yfinance earnings/recommendations.
"""

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.db.engine import get_session
from shared.db.models.channel_message import ChannelMessage

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v2/narrative", tags=["narrative-sentiment"])

# Lazy-loaded sentiment classifier (heavy model, load once)
_classifier = None


def _get_classifier():
    global _classifier
    if _classifier is None:
        try:
            from shared.nlp.sentiment_classifier import SentimentClassifier
            _classifier = SentimentClassifier()
        except Exception as e:
            logger.error("Failed to load sentiment classifier: %s", e)
    return _classifier


@router.get("/feed")
async def get_feed(
    db: AsyncSession = Depends(get_session),
    hours: int = Query(24, ge=1, le=168),
) -> dict:
    """Sentiment feed from recent Discord channel messages scored with FinBERT."""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    result = await db.execute(
        select(ChannelMessage)
        .where(ChannelMessage.posted_at >= since)
        .where(ChannelMessage.message_type.in_(["buy_signal", "sell_signal", "info", "unknown"]))
        .order_by(ChannelMessage.posted_at.desc())
        .limit(100)
    )
    messages = result.scalars().all()

    items = []
    classifier = _get_classifier()

    for msg in messages:
        item = {
            "id": str(msg.id),
            "content": msg.content[:200],
            "author": msg.author,
            "channel": msg.channel,
            "type": msg.message_type,
            "tickers": msg.tickers_mentioned or [],
            "posted_at": msg.posted_at.isoformat(),
        }
        # Score with FinBERT if available
        if classifier:
            try:
                result = classifier.classify(msg.content)
                item["sentiment"] = result.level.value
                item["sentiment_score"] = result.score
                item["confidence"] = result.confidence
            except Exception:
                item["sentiment"] = "unknown"
                item["sentiment_score"] = 0
                item["confidence"] = 0
        items.append(item)

    # Aggregate metrics
    scores = [i.get("sentiment_score", 0) for i in items if "sentiment_score" in i]
    avg_sentiment = round(sum(scores) / len(scores), 3) if scores else 0
    bullish_count = sum(1 for i in items if i.get("sentiment") in ("Bullish", "Very Bullish"))
    bearish_count = sum(1 for i in items if i.get("sentiment") in ("Bearish", "Very Bearish"))

    return {
        "items": items[:50],
        "metrics": {
            "marketSentiment": avg_sentiment,
            "bullishCount": bullish_count,
            "bearishCount": bearish_count,
            "totalMessages": len(items),
            "newsSentimentAvg": avg_sentiment,
        },
    }


@router.get("/fed-watch")
async def get_fed_watch() -> list:
    """Upcoming Fed events from static calendar."""
    from shared.market.macro import ECONOMIC_CALENDAR_2026
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    fed_events = [e for e in ECONOMIC_CALENDAR_2026 if e["date"] >= today and "FOMC" in e["event"]]
    return fed_events[:5]


@router.get("/social")
async def get_social(
    db: AsyncSession = Depends(get_session),
) -> dict:
    """Social pulse: top mentioned tickers from Discord channels (last 24h)."""
    since = datetime.now(timezone.utc) - timedelta(hours=24)

    result = await db.execute(
        select(ChannelMessage)
        .where(ChannelMessage.posted_at >= since)
        .order_by(ChannelMessage.posted_at.desc())
        .limit(500)
    )
    messages = result.scalars().all()

    # Count ticker mentions
    ticker_counts: dict[str, int] = defaultdict(int)
    for msg in messages:
        for ticker in (msg.tickers_mentioned or []):
            ticker_counts[ticker] += 1

    cashtags = [
        {"ticker": t, "mentions": c}
        for t, c in sorted(ticker_counts.items(), key=lambda x: x[1], reverse=True)[:20]
    ]

    # Author activity (proxy for momentum)
    author_counts: dict[str, int] = defaultdict(int)
    for msg in messages:
        author_counts[msg.author] += 1

    momentum = [
        {"author": a, "messages": c}
        for a, c in sorted(author_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    ]

    return {"cashtags": cashtags, "wsbMomentum": momentum, "heatmap": []}


@router.get("/earnings")
async def get_earnings(tickers: str = Query("AAPL,MSFT,GOOGL,AMZN,NVDA,TSLA,META")) -> list:
    """Upcoming earnings dates from yfinance."""
    earnings = []
    try:
        import yfinance as yf
        for ticker_str in tickers.split(",")[:15]:
            ticker_str = ticker_str.strip().upper()
            if not ticker_str:
                continue
            try:
                t = yf.Ticker(ticker_str)
                cal = t.calendar
                if cal is not None and not (hasattr(cal, 'empty') and cal.empty):
                    # calendar can be a dict or DataFrame
                    if isinstance(cal, dict):
                        earnings_date = cal.get("Earnings Date")
                        if isinstance(earnings_date, list) and earnings_date:
                            earnings_date = str(earnings_date[0])
                        earnings.append({
                            "ticker": ticker_str,
                            "earnings_date": str(earnings_date) if earnings_date else None,
                            "revenue_estimate": cal.get("Revenue Estimate"),
                            "eps_estimate": cal.get("EPS Estimate"),
                        })
                    else:
                        # DataFrame format
                        earnings.append({
                            "ticker": ticker_str,
                            "earnings_date": str(cal.iloc[0, 0]) if len(cal) > 0 else None,
                        })
            except Exception as e:
                logger.debug("Failed to fetch earnings for %s: %s", ticker_str, e)
    except ImportError:
        logger.error("yfinance not installed")
    return earnings


@router.get("/analyst-moves")
async def get_analyst_moves(tickers: str = Query("AAPL,MSFT,GOOGL,AMZN,NVDA,TSLA,META")) -> list:
    """Recent analyst recommendations from yfinance."""
    moves = []
    try:
        import yfinance as yf
        for ticker_str in tickers.split(",")[:15]:
            ticker_str = ticker_str.strip().upper()
            if not ticker_str:
                continue
            try:
                t = yf.Ticker(ticker_str)
                recs = t.recommendations
                if recs is not None and not recs.empty:
                    recent = recs.tail(5)
                    for _, row in recent.iterrows():
                        moves.append({
                            "ticker": ticker_str,
                            "firm": row.get("Firm", "Unknown"),
                            "to_grade": row.get("To Grade", ""),
                            "from_grade": row.get("From Grade", ""),
                            "action": row.get("Action", ""),
                        })
            except Exception as e:
                logger.debug("Failed to fetch recommendations for %s: %s", ticker_str, e)
    except ImportError:
        logger.error("yfinance not installed")
    return moves
