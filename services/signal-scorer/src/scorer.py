import logging
from typing import Any

logger = logging.getLogger(__name__)

class SimpleSignalScorer:
    """Basic rule-based signal scoring agent."""

    @property
    def name(self) -> str:
        return "simple-signal-scorer"

    @property
    def version(self) -> str:
        return "0.1.0"

    @property
    def description(self) -> str:
        return "Rule-based signal scoring using ticker, time, and analyst history"

    async def initialize(self) -> None:
        logger.info("SimpleSignalScorer initialized")

    async def process(self, data: dict[str, Any]) -> dict[str, Any]:
        score = await self.score(data)
        return {**data, "signal_score": score, "scored_by": self.name}

    async def score(self, trade_signal: dict[str, Any]) -> float:
        score = 0.5
        ticker = trade_signal.get("ticker", "")
        if ticker in ("SPX", "SPY", "QQQ", "IWM"):
            score += 0.15
        if trade_signal.get("expiration"):
            score += 0.10
        price = trade_signal.get("price", 0)
        if 0.5 <= price <= 20.0:
            score += 0.10
        quantity = trade_signal.get("quantity", 0)
        if isinstance(quantity, int) and 1 <= quantity <= 5:
            score += 0.05
        return min(max(score, 0.0), 1.0)

    async def explain(self, trade_signal: dict[str, Any]) -> str:
        parts = []
        ticker = trade_signal.get("ticker", "")
        if ticker in ("SPX", "SPY", "QQQ", "IWM"):
            parts.append(f"Major index ({ticker}) +0.15")
        if trade_signal.get("expiration"):
            parts.append("Has expiration +0.10")
        return "; ".join(parts) if parts else "Base score 0.5"

    async def shutdown(self) -> None:
        logger.info("SimpleSignalScorer shutdown")
