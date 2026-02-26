import asyncio
import logging
import uuid
from datetime import datetime, timezone

import msgpack
from sqlalchemy import select

from shared.crypto.credentials import decrypt_credentials
from shared.kafka_utils.producer import KafkaProducerWrapper
from shared.models.database import async_session_factory
from shared.models.trade import NewsConnection, NewsHeadline
from shared.nlp.sentiment_classifier import SentimentClassifier
from shared.nlp.ticker_extractor import TickerExtractor

from .adapters.alpha_vantage import AlphaVantageAdapter
from .adapters.finnhub import FinnhubAdapter
from .adapters.newsapi import NewsApiAdapter
from .adapters.reddit import RedditAdapter
from .adapters.seekingalpha import SeekingAlphaAdapter
from .importance_ranker import rank_headlines
from .retention import purge_old_news
from .story_clusterer import cluster_headlines

logger = logging.getLogger(__name__)

ADAPTERS = {
    "finnhub": FinnhubAdapter(),
    "newsapi": NewsApiAdapter(),
    "alpha_vantage": AlphaVantageAdapter(),
    "reddit": RedditAdapter(),
    "seekingalpha": SeekingAlphaAdapter(),
}

POLL_INTERVAL_SECONDS = 600
RETENTION_INTERVAL_SECONDS = 3600


class NewsAggregatorService:
    def __init__(self):
        self._producer = KafkaProducerWrapper()
        self._classifier = SentimentClassifier()
        self._extractor = TickerExtractor()
        self._running = False

    async def start(self):
        await self._producer.start()
        logger.info("News aggregator started")

    async def stop(self):
        self._running = False
        await self._producer.stop()

    async def run(self):
        self._running = True
        last_retention = 0
        while self._running:
            try:
                await self._poll_all_sources()
            except Exception:
                logger.exception("News poll cycle failed")

            now = asyncio.get_event_loop().time()
            if now - last_retention > RETENTION_INTERVAL_SECONDS:
                try:
                    await purge_old_news()
                    last_retention = now
                except Exception:
                    logger.exception("News retention failed")

            await asyncio.sleep(POLL_INTERVAL_SECONDS)

    async def _poll_all_sources(self):
        async with async_session_factory() as session:
            result = await session.execute(
                select(NewsConnection).where(NewsConnection.enabled.is_(True))
            )
            connections = result.scalars().all()

        if not connections:
            logger.debug("No active news connections configured")
            return

        all_headlines = []
        for conn in connections:
            adapter = ADAPTERS.get(conn.source_api)
            if not adapter:
                logger.warning("No adapter for source: %s", conn.source_api)
                continue
            try:
                api_key = ""
                if conn.api_key_encrypted:
                    creds = decrypt_credentials(conn.api_key_encrypted)
                    api_key = creds.get("api_key", "")

                raw = await adapter.fetch(api_key, conn.config or {})
                for h in raw:
                    tickers = self._extractor.extract(h.title)
                    sentiment = await asyncio.to_thread(self._classifier.classify, h.title)

                    all_headlines.append({
                        "source_api": h.source_api,
                        "title": h.title,
                        "summary": h.summary,
                        "url": h.url,
                        "image_url": h.image_url,
                        "author": h.author,
                        "tickers": tickers,
                        "category": h.category,
                        "sentiment_label": sentiment["label"],
                        "sentiment_score": sentiment["score"],
                        "published_at": h.published_at,
                    })

                async with async_session_factory() as session:
                    conn_obj = await session.get(NewsConnection, conn.id)
                    if conn_obj:
                        conn_obj.last_poll_at = datetime.now(timezone.utc)
                        conn_obj.error_message = None
                        await session.commit()
            except Exception as e:
                logger.exception("Failed to fetch from %s", conn.source_api)
                async with async_session_factory() as session:
                    conn_obj = await session.get(NewsConnection, conn.id)
                    if conn_obj:
                        conn_obj.error_message = str(e)[:500]
                        await session.commit()

        if not all_headlines:
            return

        all_headlines = cluster_headlines(all_headlines)
        all_headlines = rank_headlines(all_headlines)

        async with async_session_factory() as session:
            for h in all_headlines:
                existing = await session.execute(
                    select(NewsHeadline).where(
                        NewsHeadline.title == h["title"],
                        NewsHeadline.source_api == h["source_api"],
                    ).limit(1)
                )
                if existing.scalar_one_or_none():
                    continue

                published_at = None
                if h.get("published_at"):
                    try:
                        ts = h["published_at"]
                        if isinstance(ts, (int, float)):
                            published_at = datetime.fromtimestamp(ts, tz=timezone.utc)
                        else:
                            published_at = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
                    except Exception:
                        pass

                headline = NewsHeadline(
                    id=uuid.uuid4(),
                    source_api=h["source_api"],
                    title=h["title"],
                    summary=h.get("summary"),
                    url=h.get("url"),
                    image_url=h.get("image_url"),
                    author=h.get("author"),
                    tickers=h.get("tickers", []),
                    category=h.get("category"),
                    sentiment_label=h.get("sentiment_label"),
                    sentiment_score=h.get("sentiment_score"),
                    importance_score=h.get("importance_score"),
                    cluster_id=h.get("cluster_id"),
                    cluster_size=h.get("cluster_size", 1),
                    published_at=published_at,
                )
                session.add(headline)

                if h.get("tickers"):
                    signal = {
                        "type": "news",
                        "tickers": h["tickers"],
                        "title": h["title"],
                        "sentiment_label": h.get("sentiment_label"),
                        "sentiment_score": h.get("sentiment_score"),
                        "importance_score": h.get("importance_score"),
                        "source_api": h["source_api"],
                        "url": h.get("url"),
                    }
                    try:
                        await self._producer.send("news-signals", msgpack.packb(signal))
                    except Exception:
                        logger.warning("Failed to emit news signal")

            await session.commit()
            logger.info("Persisted %d new headlines", len(all_headlines))
