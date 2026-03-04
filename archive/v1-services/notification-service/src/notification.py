import logging

from shared.kafka_utils.consumer import KafkaConsumerWrapper

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self):
        self.consumer = KafkaConsumerWrapper("execution-results", "notification-service-group")
        self._handlers: dict[str, list] = {}

    def register_handler(self, channel: str, handler):
        self._handlers.setdefault(channel, []).append(handler)

    async def start(self):
        await self.consumer.start()
        logger.info("Notification service started")

    async def stop(self):
        await self.consumer.stop()

    async def run(self):
        await self.consumer.consume(self._handle_event)

    async def _handle_event(self, event: dict, headers: dict):
        status = event.get("status", "")
        trade_id = event.get("trade_id", "")
        ticker = event.get("ticker", "")

        message = f"Trade {trade_id}: {event.get('action')} {ticker} - Status: {status}"
        if status == "ERROR":
            message += f" - Error: {event.get('error_message', 'unknown')}"

        for channel, handlers in self._handlers.items():
            for handler in handlers:
                try:
                    await handler(message, event)
                except Exception:
                    logger.exception("Notification handler failed for channel %s", channel)
