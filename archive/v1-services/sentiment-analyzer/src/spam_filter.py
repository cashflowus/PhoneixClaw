import hashlib
import logging
import time

logger = logging.getLogger(__name__)

_recent_hashes: dict[str, float] = {}
_DEDUP_WINDOW = 60


def _content_hash(author: str, content: str) -> str:
    return hashlib.md5(f"{author}:{content}".encode()).hexdigest()


def _evict_old():
    now = time.time()
    expired = [k for k, ts in _recent_hashes.items() if now - ts > _DEDUP_WINDOW]
    for k in expired:
        del _recent_hashes[k]


async def should_filter(msg: dict, redis_client=None) -> bool:
    """Return True if the message should be discarded."""
    if msg.get("is_bot"):
        return True

    content = (msg.get("content") or "").strip()
    if len(content) < 5:
        return True

    author = msg.get("author", "unknown")
    h = _content_hash(author, content)

    if redis_client:
        try:
            key = f"spam:dedup:{h}"
            exists = await redis_client.get(key)
            if exists:
                return True
            await redis_client.setex(key, _DEDUP_WINDOW, "1")
            return False
        except Exception:
            logger.debug("Redis dedup fallback to in-memory")

    _evict_old()
    if h in _recent_hashes:
        return True
    _recent_hashes[h] = time.time()
    return False
