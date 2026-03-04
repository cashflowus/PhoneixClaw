import logging

import httpx

from .base import NewsAdapter, RawHeadline

logger = logging.getLogger(__name__)


class FinnhubAdapter(NewsAdapter):
    source_api = "finnhub"

    async def fetch(self, api_key: str, config: dict | None = None) -> list[RawHeadline]:
        url = "https://finnhub.io/api/v1/news"
        params = {"category": "general", "token": api_key}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()

            headlines = []
            for item in data[:50]:
                headlines.append(RawHeadline(
                    title=item.get("headline", ""),
                    summary=item.get("summary", ""),
                    url=item.get("url"),
                    image_url=item.get("image"),
                    author=item.get("source"),
                    category=item.get("category"),
                    published_at=item.get("datetime"),
                    source_api=self.source_api,
                ))
            logger.info("Finnhub: fetched %d headlines", len(headlines))
            return headlines
        except Exception:
            logger.exception("Finnhub fetch failed")
            return []
