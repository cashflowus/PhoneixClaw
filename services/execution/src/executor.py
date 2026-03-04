"""
Broker executor — places orders via broker adapters.

M1.12: Trade execution after risk approval.
Reference: PRD Section 8, existing v1 services/trade-executor/.
"""

import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class BrokerExecutor:
    """
    Executes approved trade intents against configured broker.
    Uses the broker adapter pattern from v1.
    """

    def __init__(self, broker_adapter: Any = None):
        self.broker = broker_adapter
        self._fill_count = 0
        self._fail_count = 0

    async def execute(self, intent: dict) -> dict[str, Any]:
        """Execute a trade intent. Returns fill data or raises on failure."""
        symbol = intent.get("symbol", "")
        side = intent.get("side", "buy")
        qty = intent.get("qty", 0)
        order_type = intent.get("order_type", "market")

        logger.info("Executing %s %s %s @ %s", side, qty, symbol, order_type)

        if self.broker:
            from services.connector_manager.src.brokers.alpaca import BrokerOrder, OrderSide, OrderType
            order = BrokerOrder(
                symbol=symbol,
                side=OrderSide(side),
                qty=qty,
                order_type=OrderType(order_type),
                limit_price=intent.get("limit_price"),
                stop_price=intent.get("stop_price"),
            )
            result = await self.broker.submit_order(order)
            self._fill_count += 1
            return result

        # Simulated fill for paper/test mode
        self._fill_count += 1
        return {
            "id": f"sim-{datetime.now(timezone.utc).timestamp()}",
            "symbol": symbol,
            "side": side,
            "qty": qty,
            "status": "filled",
            "fill_price": intent.get("limit_price", 0) or intent.get("estimated_price", 100.0),
            "filled_at": datetime.now(timezone.utc).isoformat(),
        }

    def get_stats(self) -> dict[str, int]:
        return {"fills": self._fill_count, "failures": self._fail_count}
