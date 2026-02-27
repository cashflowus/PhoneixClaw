import logging

import httpx

from .base import NewsAdapter, RawHeadline

logger = logging.getLogger(__name__)


class PolygonAdapter(NewsAdapter):
    source_api = "polygon"

    async def fetch(self, api_key: str, config: dict | None = None) -> list[RawHeadline]:
        if not api_key:
            logger.warning("Polygon: no API key configured")
            return []

        url = "https://api.polygon.io/v2/reference/news"
        params = {
            "apiKey": api_key,
            "limit": 50,
            "order": "desc",
            "sort": "published_utc",
        }
        ticker = (config or {}).get("ticker")
        if ticker:
            params["ticker"] = ticker

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()

            headlines: list[RawHeadline] = []
            for item in data.get("results", []):
                headlines.append(RawHeadline(
                    title=item.get("title", ""),
                    summary=item.get("description", ""),
                    url=item.get("article_url"),
                    image_url=item.get("image_url"),
                    author=item.get("author"),
                    category=",".join(item.get("keywords", [])[:3]) if item.get("keywords") else None,
                    published_at=item.get("published_utc"),
                    source_api=self.source_api,
                ))
            logger.info("Polygon: fetched %d headlines", len(headlines))
            return headlines
        except Exception:
            logger.exception("Polygon fetch failed")
            return []
