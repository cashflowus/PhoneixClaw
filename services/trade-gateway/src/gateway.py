import logging
from datetime import datetime, timezone

from shared.config.base_config import config
from shared.kafka_utils.consumer import KafkaConsumerWrapper
from shared.kafka_utils.producer import KafkaProducerWrapper

logger = logging.getLogger(__name__)


class TradeGatewayService:
    def __init__(self) -> None:
        self.consumer = KafkaConsumerWrapper("parsed-trades", "trade-gateway-group")
        self.producer = KafkaProducerWrapper()
        self.mode = config.gateway.approval_mode

    async def start(self) -> None:
        await self.producer.start()
        await self.consumer.start()
        logger.info("Trade gateway started (mode=%s)", self.mode)

    async def stop(self) -> None:
        await self.consumer.stop()
        await self.producer.stop()

    async def run(self) -> None:
        await self.consumer.consume(self._handle_trade)

    async def _handle_trade(self, trade: dict, headers: dict) -> None:
        trade_id = trade.get("trade_id", "unknown")

        if self.mode == "auto":
            trade["status"] = "APPROVED"
            trade["approved_by"] = "auto-gateway"
            trade["approved_at"] = datetime.now(timezone.utc).isoformat()
            logger.info("Auto-approved trade %s: %s %s", trade_id, trade.get("action"), trade.get("ticker"))
        else:
            trade["status"] = "PENDING"
            logger.info("Trade %s pending manual approval", trade_id)
            return

        msg_headers = []
        user_id = trade.get("user_id", "")
        if user_id:
            msg_headers.append(("user_id", user_id.encode("utf-8")))
        ta_id = trade.get("trading_account_id", "")
        if ta_id:
            msg_headers.append(("trading_account_id", ta_id.encode("utf-8")))

        await self.producer.send(
            "approved-trades",
            value=trade,
            key=trade_id,
            headers=msg_headers or None,
        )
