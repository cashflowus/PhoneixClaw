import logging

import httpx

from .base import NewsAdapter, RawHeadline

logger = logging.getLogger(__name__)


class NewsApiAdapter(NewsAdapter):
    source_api = "newsapi"

    async def fetch(self, api_key: str, config: dict | None = None) -> list[RawHeadline]:
        url = "https://newsapi.org/v2/top-headlines"
        params = {
            "category": "business",
            "language": "en",
            "pageSize": 50,
            "apiKey": api_key,
        }
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()

            headlines = []
            for article in data.get("articles", [])[:50]:
                headlines.append(RawHeadline(
                    title=article.get("title", ""),
                    summary=article.get("description"),
                    url=article.get("url"),
                    image_url=article.get("urlToImage"),
                    author=article.get("author") or (article.get("source", {}).get("name")),
                    category="business",
                    published_at=article.get("publishedAt"),
                    source_api=self.source_api,
                ))
            logger.info("NewsAPI: fetched %d headlines", len(headlines))
            return headlines
        except Exception:
            logger.exception("NewsAPI fetch failed")
            return []
