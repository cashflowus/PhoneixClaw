import logging

import feedparser

from .base import NewsAdapter, RawHeadline

logger = logging.getLogger(__name__)

BASE_RSS_URL = "https://finance.yahoo.com/news/rssindex"


class YahooFinanceAdapter(NewsAdapter):
    source_api = "yahoo_finance"

    async def fetch(self, api_key: str, config: dict | None = None) -> list[RawHeadline]:
        ticker = (config or {}).get("ticker")
        if ticker:
            url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"
        else:
            url = BASE_RSS_URL

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
                    author=entry.get("author") or "Yahoo Finance",
                    category="finance",
                    published_at=published or None,
                    source_api=self.source_api,
                ))
            logger.info("Yahoo Finance: fetched %d headlines", len(headlines))
            return headlines
        except Exception:
            logger.exception("Yahoo Finance fetch failed")
            return []
