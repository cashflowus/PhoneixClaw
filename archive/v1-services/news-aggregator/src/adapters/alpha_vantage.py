import logging

import httpx

from .base import NewsAdapter, RawHeadline

logger = logging.getLogger(__name__)


class AlphaVantageAdapter(NewsAdapter):
    source_api = "alpha_vantage"

    async def fetch(self, api_key: str, config: dict | None = None) -> list[RawHeadline]:
        url = "https://www.alphavantage.co/query"
        params = {
            "function": "NEWS_SENTIMENT",
            "apikey": api_key,
            "limit": 50,
        }
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()

            headlines = []
            for item in data.get("feed", [])[:50]:
                headlines.append(RawHeadline(
                    title=item.get("title", ""),
                    summary=item.get("summary"),
                    url=item.get("url"),
                    image_url=item.get("banner_image"),
                    author=item.get("source"),
                    category=item.get("category_within_source"),
                    published_at=item.get("time_published"),
                    source_api=self.source_api,
                ))
            logger.info("Alpha Vantage: fetched %d headlines", len(headlines))
            return headlines
        except Exception:
            logger.exception("Alpha Vantage fetch failed")
            return []
