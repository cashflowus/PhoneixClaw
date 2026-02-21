import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from shared.crypto.credentials import decrypt_credentials
from shared.kafka_utils.producer import KafkaProducerWrapper
from shared.models.database import AsyncSessionLocal
from shared.models.trade import DataSource

logger = logging.getLogger(__name__)


class SourceOrchestrator:
    def __init__(self):
        self._active_workers: dict[str, dict] = {}
        self._running = False
        self._producer = KafkaProducerWrapper()

    async def start(self):
        self._running = True
        await self._producer.start()
        logger.info("Source orchestrator started")

    async def stop(self):
        self._running = False
        for source_id, worker in list(self._active_workers.items()):
            task = worker.get("task")
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass
            logger.info("Stopped worker for source %s", source_id)
        self._active_workers.clear()
        await self._producer.stop()
        logger.info("Source orchestrator stopped")

    async def reconcile(self):
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(DataSource).where(DataSource.enabled.is_(True))
            )
            sources = result.scalars().all()
            source_map = {str(s.id): s for s in sources}

        desired = set(source_map.keys())
        active = set(self._active_workers.keys())

        to_start = desired - active
        to_stop = active - desired

        for sid in to_stop:
            worker = self._active_workers.pop(sid, None)
            if worker:
                task = worker.get("task")
                if task and not task.done():
                    task.cancel()
            logger.info("Stopped worker for removed/disabled source %s", sid)

        for sid in to_stop:
            dead = [
                k for k, v in self._active_workers.items()
                if v.get("task") and v["task"].done()
            ]
            for k in dead:
                self._active_workers.pop(k, None)

        for sid in to_start:
            source = source_map[sid]
            if source.source_type != "discord":
                logger.info("Skipping non-discord source %s (type=%s)", sid, source.source_type)
                continue
            try:
                creds = decrypt_credentials(source.credentials_encrypted)
                token = creds.get("user_token") or creds.get("bot_token", "")
                channel_ids_raw = creds.get("channel_ids", "")
                channel_ids = [
                    int(c.strip()) for c in channel_ids_raw.split(",")
                    if c.strip().isdigit()
                ] if channel_ids_raw else []

                task = asyncio.create_task(
                    self._run_ingestor(
                        token=token,
                        channel_ids=channel_ids,
                        user_id=str(source.user_id),
                        auth_type=source.auth_type,
                        data_source_id=sid,
                    )
                )
                self._active_workers[sid] = {"task": task, "status": "running"}

                async with AsyncSessionLocal() as session:
                    db_source = await session.get(DataSource, source.id)
                    if db_source:
                        db_source.connection_status = "CONNECTED"
                        db_source.last_connected_at = datetime.now(timezone.utc)
                        await session.commit()

                logger.info("Started Discord ingestor for source %s (user=%s, channels=%s)",
                            sid, source.user_id, channel_ids)
            except Exception:
                logger.exception("Failed to start ingestor for source %s", sid)

        return {
            "started": list(to_start),
            "stopped": list(to_stop),
            "active": len(self._active_workers),
        }

    async def _run_ingestor(
        self, token: str, channel_ids: list[int],
        user_id: str, auth_type: str, data_source_id: str,
    ):
        from services.discord_ingestor.src.connector import DiscordIngestor

        ingestor = DiscordIngestor(
            token=token,
            target_channels=channel_ids,
            user_id=user_id,
            auth_type=auth_type,
            producer=self._producer,
            data_source_id=data_source_id,
        )
        try:
            await ingestor.start()
        except asyncio.CancelledError:
            await ingestor.stop()
        except Exception:
            logger.exception("Ingestor for source %s crashed", data_source_id)

    async def run(self, poll_interval: float = 30.0):
        while self._running:
            try:
                result = await self.reconcile()
                if result["started"] or result["stopped"]:
                    logger.info("Reconciliation: %s", result)
            except Exception:
                logger.exception("Reconciliation failed")
            await asyncio.sleep(poll_interval)
