import logging

import httpx

from .base import NewsAdapter, RawHeadline

logger = logging.getLogger(__name__)


class BenzingaAdapter(NewsAdapter):
    source_api = "benzinga"

    async def fetch(self, api_key: str, config: dict | None = None) -> list[RawHeadline]:
        if not api_key:
            logger.warning("Benzinga: no API key configured")
            return []

        url = "https://api.benzinga.com/api/v2/news"
        params = {
            "token": api_key,
            "pageSize": 50,
            "displayOutput": "full",
        }
        channels = (config or {}).get("channels")
        if channels:
            params["channels"] = channels

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()

            headlines: list[RawHeadline] = []
            for item in data if isinstance(data, list) else data.get("results", data.get("data", [])):
                tickers_raw = item.get("stocks", [])
                ticker_str = ", ".join(s.get("name", "") for s in tickers_raw) if isinstance(tickers_raw, list) else ""

                headlines.append(RawHeadline(
                    title=item.get("title", ""),
                    summary=item.get("teaser", item.get("body", ""))[:500] if item.get("teaser") or item.get("body") else None,
                    url=item.get("url"),
                    image_url=item.get("image", [{}])[0].get("url") if isinstance(item.get("image"), list) and item.get("image") else None,
                    author=item.get("author"),
                    category=", ".join(c.get("name", "") for c in item.get("channels", [])) if item.get("channels") else None,
                    published_at=item.get("created"),
                    source_api=self.source_api,
                ))
            logger.info("Benzinga: fetched %d headlines", len(headlines))
            return headlines
        except Exception:
            logger.exception("Benzinga fetch failed")
            return []
