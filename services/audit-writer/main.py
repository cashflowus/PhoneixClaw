import asyncio
import itertools
import logging
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[2]))

from shared.graceful_shutdown import shutdown

SERVICE_NAME = "audit-writer"
logger = logging.getLogger(SERVICE_NAME)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

_healthy_services: dict[str, bool] = {}


async def _run_service(service, name: str):
    for attempt in itertools.count(1):
        try:
            await service.start()
            _healthy_services[name] = True
            logger.info("%s connected to Kafka (attempt %d)", name, attempt)
            await service.run()
            break
        except asyncio.CancelledError:
            break
        except Exception:
            _healthy_services[name] = False
            delay = min(5 * (2 ** (attempt - 1)), 60)
            logger.exception(
                "%s startup failed (attempt %d), retrying in %ds",
                name, attempt, delay,
            )
            await asyncio.sleep(delay)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from services.audit_writer.src.raw_message_writer import RawMessageWriterService
    from services.audit_writer.src.writer import AuditWriterService

    audit_svc = AuditWriterService()
    raw_msg_svc = RawMessageWriterService()

    audit_task = asyncio.create_task(_run_service(audit_svc, "audit-writer"))
    raw_msg_task = asyncio.create_task(_run_service(raw_msg_svc, "raw-message-writer"))

    shutdown.register(lambda: audit_svc.stop())
    shutdown.register(lambda: raw_msg_svc.stop())
    logger.info("%s starting (audit + raw-message writers)", SERVICE_NAME)
    yield
    await shutdown.run_cleanup()
    for t in (audit_task, raw_msg_task):
        t.cancel()
        try:
            await t
        except asyncio.CancelledError:
            pass


app = FastAPI(title=SERVICE_NAME, lifespan=lifespan)


@app.get("/health")
async def health():
    all_healthy = all(_healthy_services.values()) if _healthy_services else False
    if all_healthy:
        return {"status": "ready", "service": SERVICE_NAME, "services": _healthy_services}
    return JSONResponse(
        status_code=503,
        content={"status": "starting", "service": SERVICE_NAME, "services": _healthy_services},
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8012)
