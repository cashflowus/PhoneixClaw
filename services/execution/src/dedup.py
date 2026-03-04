"""
Trade intent deduplication — prevents duplicate orders from racing through
the execution pipeline.

M2.4: Dedup layer in execution service.
"""

import hashlib
import logging
import threading
import time

logger = logging.getLogger(__name__)


class IntentDeduplicator:
    """TTL-based deduplication cache for trade intents.

    Generates a hash from (agent_id, symbol, side, qty) and rejects
    identical intents arriving within the configured time window.
    """

    def __init__(self, window_seconds: float = 60.0):
        self._window = window_seconds
        self._cache: dict[str, float] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _make_key(agent_id: str, symbol: str, side: str, qty: float) -> str:
        raw = f"{agent_id}|{symbol}|{side}|{qty}"
        return hashlib.sha256(raw.encode()).hexdigest()

    def _evict_expired(self) -> None:
        now = time.monotonic()
        expired = [k for k, ts in self._cache.items() if now - ts > self._window]
        for k in expired:
            del self._cache[k]

    def is_duplicate(
        self, agent_id: str, symbol: str, side: str, qty: float
    ) -> bool:
        """Return True if an identical intent was seen within the window."""
        key = self._make_key(agent_id, symbol, side, qty)
        with self._lock:
            self._evict_expired()
            return key in self._cache

    def record(
        self, agent_id: str, symbol: str, side: str, qty: float
    ) -> None:
        """Mark an intent as seen."""
        key = self._make_key(agent_id, symbol, side, qty)
        with self._lock:
            self._cache[key] = time.monotonic()
            logger.debug("Recorded intent %s (cache size: %d)", key[:12], len(self._cache))

    def check_and_record(
        self, agent_id: str, symbol: str, side: str, qty: float
    ) -> bool:
        """Atomic check-then-record. Returns True if duplicate (rejected)."""
        key = self._make_key(agent_id, symbol, side, qty)
        with self._lock:
            self._evict_expired()
            if key in self._cache:
                logger.warning(
                    "Duplicate intent rejected: agent=%s symbol=%s side=%s qty=%s",
                    agent_id, symbol, side, qty,
                )
                return True
            self._cache[key] = time.monotonic()
            return False

    @property
    def cache_size(self) -> int:
        with self._lock:
            self._evict_expired()
            return len(self._cache)
