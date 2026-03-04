import logging

import httpx

from .base import NewsAdapter, RawHeadline

logger = logging.getLogger(__name__)

SUBREDDITS = ["wallstreetbets", "stocks", "investing", "options"]


class RedditAdapter(NewsAdapter):
    source_api = "reddit"

    async def fetch(self, api_key: str, config: dict | None = None) -> list[RawHeadline]:
        headlines = []
        headers = {"User-Agent": "PhoenixTradeBot/1.0"}
        try:
            async with httpx.AsyncClient(timeout=15, headers=headers) as client:
                for sub in SUBREDDITS:
                    try:
                        url = f"https://www.reddit.com/r/{sub}/hot.json?limit=15"
                        resp = await client.get(url)
                        if resp.status_code != 200:
                            continue
                        data = resp.json()
                        for post in data.get("data", {}).get("children", []):
                            d = post.get("data", {})
                            if d.get("stickied"):
                                continue
                            headlines.append(RawHeadline(
                                title=d.get("title", ""),
                                summary=d.get("selftext", "")[:300] if d.get("selftext") else None,
                                url=f"https://reddit.com{d.get('permalink', '')}",
                                author=d.get("author"),
                                category=f"r/{sub}",
                                published_at=str(d.get("created_utc", "")),
                                source_api=self.source_api,
                            ))
                    except Exception:
                        logger.warning("Failed to fetch r/%s", sub)
            logger.info("Reddit: fetched %d headlines", len(headlines))
        except Exception:
            logger.exception("Reddit fetch failed")
        return headlines
