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

SERVICE_NAME = "source-orchestrator"
logger = logging.getLogger(SERVICE_NAME)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

_healthy = False


async def _run_orchestrator(service):
    global _healthy
    for attempt in itertools.count(1):
        try:
            await service.start()
            _healthy = True
            logger.info("Orchestrator connected to Kafka (attempt %d)", attempt)
            await service.run()
            break
        except asyncio.CancelledError:
            break
        except Exception:
            _healthy = False
            delay = min(5 * (2 ** (attempt - 1)), 60)
            logger.exception(
                "Orchestrator startup failed (attempt %d), retrying in %ds",
                attempt, delay,
            )
            await asyncio.sleep(delay)


_orchestrator = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _orchestrator
    from services.source_orchestrator.src.orchestrator import SourceOrchestrator

    _orchestrator = SourceOrchestrator()
    task = asyncio.create_task(_run_orchestrator(_orchestrator))
    shutdown.register(lambda: _orchestrator.stop())
    logger.info("%s starting", SERVICE_NAME)
    yield
    await shutdown.run_cleanup()
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title=SERVICE_NAME, lifespan=lifespan)


@app.get("/health")
async def health():
    if _healthy:
        return {"status": "ready", "service": SERVICE_NAME}
    return JSONResponse(
        status_code=503,
        content={"status": "starting", "service": SERVICE_NAME},
    )


@app.get("/debug/workers")
async def debug_workers():
    if not _orchestrator:
        return {"error": "orchestrator not initialized"}
    import time as _time
    workers = {}
    for sid, w in _orchestrator._active_workers.items():
        task = w.get("task")
        workers[sid] = {
            "alive": task is not None and not task.done(),
            "status": w.get("status", "unknown"),
            "done": task.done() if task else True,
        }
    backoff = {}
    for sid, (attempts, ready_at) in _orchestrator._backoff.items():
        backoff[sid] = {
            "attempts": attempts,
            "ready_in_seconds": max(0, round(ready_at - _time.monotonic(), 1)),
        }
    return {
        "active_workers": workers,
        "worker_count": len(workers),
        "backoff": backoff,
        "running": _orchestrator._running,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
