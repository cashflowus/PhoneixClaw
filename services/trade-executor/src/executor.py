import logging
import time
from datetime import datetime, timezone

from services.trade_executor.src.buffer import calculate_buffered_price  # noqa: E402
from services.trade_executor.src.validator import trade_validator  # noqa: E402
from shared.broker.adapter import BrokerAdapter
from shared.kafka_utils.consumer import KafkaConsumerWrapper
from shared.kafka_utils.producer import KafkaProducerWrapper

logger = logging.getLogger(__name__)


class TradeExecutorService:
    def __init__(self, broker: BrokerAdapter) -> None:
        self.consumer = KafkaConsumerWrapper("approved-trades", "trade-executor-group")
        self.producer = KafkaProducerWrapper()
        self.broker = broker

    async def start(self) -> None:
        await self.producer.start()
        await self.consumer.start()
        logger.info("Trade executor service started")

    async def stop(self) -> None:
        await self.consumer.stop()
        await self.producer.stop()

    async def run(self) -> None:
        await self.consumer.consume(self._handle_trade)

    async def _handle_trade(self, trade: dict, headers: dict) -> None:
        trade_id = trade.get("trade_id", "unknown")
        start_time = time.monotonic()

        is_valid, error = trade_validator.validate(trade)
        if not is_valid:
            await self._publish_result(trade, "REJECTED", error_message=error, start_time=start_time)
            return

        ticker = trade["ticker"]
        action = trade["action"]
        price = float(trade["price"])
        expiration = trade.get("expiration")
        option_type = trade["option_type"]
        strike = float(trade["strike"])

        buffered_price, buffer_pct = calculate_buffered_price(price, action, ticker)

        quantity_str = str(trade.get("quantity", "1"))
        is_percentage = "%" in quantity_str
        quantity = 1
        if not is_percentage:
            quantity = int(quantity_str)

        if not expiration:
            await self._publish_result(trade, "REJECTED", error_message="Missing expiration", start_time=start_time)
            return

        symbol = self.broker.format_option_symbol(ticker, expiration, option_type, strike)

        try:
            order_id = await self.broker.place_limit_order(symbol, quantity, action, buffered_price)
            trade["broker_order_id"] = order_id
            trade["buffered_price"] = buffered_price
            trade["buffer_pct_used"] = buffer_pct
            trade["broker_symbol"] = symbol
            await self._publish_result(trade, "EXECUTED", start_time=start_time)
            logger.info("Executed trade %s: %s %d %s @ %.2f (buffered=%.2f, order=%s)",
                         trade_id, action, quantity, symbol, price, buffered_price, order_id)
        except Exception as e:
            logger.error("Failed to execute trade %s: %s", trade_id, e)
            await self._publish_result(trade, "ERROR", error_message=str(e), start_time=start_time)

    async def _publish_result(
        self, trade: dict, status: str, error_message: str | None = None, start_time: float = 0
    ) -> None:
        latency_ms = int((time.monotonic() - start_time) * 1000) if start_time else 0
        trade["status"] = status
        trade["processed_at"] = datetime.now(timezone.utc).isoformat()
        trade["execution_latency_ms"] = latency_ms
        if error_message:
            trade["error_message"] = error_message

        msg_headers = []
        user_id = trade.get("user_id", "")
        if user_id:
            msg_headers.append(("user_id", user_id.encode("utf-8")))

        await self.producer.send(
            "execution-results",
            value=trade,
            key=trade.get("trade_id", ""),
            headers=msg_headers or None,
        )
