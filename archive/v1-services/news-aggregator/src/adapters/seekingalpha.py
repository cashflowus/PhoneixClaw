import logging

import httpx

from .base import NewsAdapter, RawHeadline

logger = logging.getLogger(__name__)


class SeekingAlphaAdapter(NewsAdapter):
    source_api = "seekingalpha"

    async def fetch(self, api_key: str, config: dict | None = None) -> list[RawHeadline]:
        url = "https://seeking-alpha.p.rapidapi.com/news/v2/list"
        headers = {
            "X-RapidAPI-Key": api_key,
            "X-RapidAPI-Host": "seeking-alpha.p.rapidapi.com",
        }
        params = {"size": 40, "category": "market-news::all"}
        try:
            async with httpx.AsyncClient(timeout=15, headers=headers) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()

            headlines = []
            for item in data.get("data", [])[:40]:
                attrs = item.get("attributes", {})
                headlines.append(RawHeadline(
                    title=attrs.get("title", ""),
                    summary=attrs.get("teaser"),
                    url=f"https://seekingalpha.com{attrs.get('uri', '')}",
                    image_url=attrs.get("image_url"),
                    author=attrs.get("author"),
                    category="market-news",
                    published_at=attrs.get("publishOn"),
                    source_api=self.source_api,
                ))
            logger.info("SeekingAlpha: fetched %d headlines", len(headlines))
            return headlines
        except Exception:
            logger.exception("SeekingAlpha fetch failed")
            return []
