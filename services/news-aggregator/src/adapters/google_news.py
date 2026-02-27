import logging

import feedparser

from .base import NewsAdapter, RawHeadline

logger = logging.getLogger(__name__)

FEED_URL = "https://news.google.com/rss/search?q=stocks+market+finance&hl=en-US&gl=US&ceid=US:en"


class GoogleNewsAdapter(NewsAdapter):
    source_api = "google_news"

    async def fetch(self, api_key: str, config: dict | None = None) -> list[RawHeadline]:
        query = (config or {}).get("query", "stocks market finance")
        url = f"https://news.google.com/rss/search?q={query.replace(' ', '+')}&hl=en-US&gl=US&ceid=US:en"
        try:
            import asyncio
            feed = await asyncio.to_thread(feedparser.parse, url)

            headlines: list[RawHeadline] = []
            for entry in feed.entries[:50]:
                published = entry.get("published", "")
                headlines.append(RawHeadline(
                    title=entry.get("title", ""),
                    summary=entry.get("summary", ""),
                    url=entry.get("link"),
                    author=entry.get("source", {}).get("title") if isinstance(entry.get("source"), dict) else None,
                    category="general",
                    published_at=published or None,
                    source_api=self.source_api,
                ))
            logger.info("Google News: fetched %d headlines", len(headlines))
            return headlines
        except Exception:
            logger.exception("Google News fetch failed")
            return []
