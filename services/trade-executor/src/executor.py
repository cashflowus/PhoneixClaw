import logging
import time
import uuid
from datetime import datetime, timezone

from services.trade_executor.src.buffer import calculate_buffered_price  # noqa: E402
from services.trade_executor.src.validator import trade_validator  # noqa: E402
from shared.broker.adapter import BrokerAdapter
from shared.broker.factory import create_broker_adapter
from shared.kafka_utils.consumer import KafkaConsumerWrapper
from shared.kafka_utils.producer import KafkaProducerWrapper
from shared.models.database import AsyncSessionLocal
from shared.models.trade import AccountSourceMapping, Channel, TradingAccount

logger = logging.getLogger(__name__)


class TradeExecutorService:
    def __init__(self, broker: BrokerAdapter | None = None) -> None:
        self.consumer = KafkaConsumerWrapper("approved-trades", "trade-executor-group")
        self.producer = KafkaProducerWrapper()
        self.broker = broker
        self._broker_cache: dict[str, BrokerAdapter] = {}

    async def start(self) -> None:
        await self.producer.start()
        await self.consumer.start()
        logger.info("Trade executor service started")

    async def stop(self) -> None:
        await self.consumer.stop()
        await self.producer.stop()

    async def run(self) -> None:
        await self.consumer.consume(self._handle_trade)

    async def _resolve_broker(self, trade: dict) -> BrokerAdapter | None:
        if self.broker:
            return self.broker

        ta_id = trade.get("trading_account_id")
        if not ta_id:
            channel_id = trade.get("channel_id")
            user_id = trade.get("user_id")
            if channel_id and user_id:
                async with AsyncSessionLocal() as session:
                    from sqlalchemy import select
                    result = await session.execute(
                        select(AccountSourceMapping).where(
                            AccountSourceMapping.channel_id == uuid.UUID(channel_id),
                            AccountSourceMapping.enabled.is_(True),
                        )
                    )
                    mapping = result.scalar_one_or_none()
                    if mapping:
                        ta_id = str(mapping.trading_account_id)
                        trade["trading_account_id"] = ta_id

        if not ta_id:
            async with AsyncSessionLocal() as session:
                from sqlalchemy import select
                user_id = trade.get("user_id")
                if not user_id:
                    return None
                result = await session.execute(
                    select(TradingAccount).where(
                        TradingAccount.user_id == uuid.UUID(user_id),
                        TradingAccount.enabled.is_(True),
                    ).limit(1)
                )
                account = result.scalar_one_or_none()
                if account:
                    ta_id = str(account.id)
                    trade["trading_account_id"] = ta_id

        if not ta_id:
            return None

        if ta_id in self._broker_cache:
            return self._broker_cache[ta_id]

        async with AsyncSessionLocal() as session:
            account = await session.get(TradingAccount, uuid.UUID(ta_id))
            if not account:
                return None
            broker = create_broker_adapter(
                account.broker_type,
                account.credentials_encrypted,
                account.paper_mode,
            )
            self._broker_cache[ta_id] = broker
            return broker

    async def _handle_trade(self, trade: dict, headers: dict) -> None:
        trade_id = trade.get("trade_id", "unknown")
        start_time = time.monotonic()

        broker = await self._resolve_broker(trade)
        if not broker:
            await self._publish_result(
                trade, "REJECTED",
                error_message="No trading account found for this trade",
                start_time=start_time,
            )
            return

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

        symbol = broker.format_option_symbol(ticker, expiration, option_type, strike)

        try:
            order_id = await broker.place_limit_order(symbol, quantity, action, buffered_price)
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

        audit_event = {
            "user_id": trade.get("user_id"),
            "trade_id": trade.get("trade_id"),
            "event_type": status,
            "event_data": {
                "ticker": trade.get("ticker"),
                "action": trade.get("action"),
                "price": trade.get("price"),
                "error": error_message,
            },
            "source_service": "trade-executor",
        }
        await self.producer.send(
            "trade-events-raw",
            value=audit_event,
            key=trade.get("trade_id", ""),
            headers=msg_headers or None,
        )
