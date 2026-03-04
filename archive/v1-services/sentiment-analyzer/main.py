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
from shared.metrics import create_metrics_route

SERVICE_NAME = "sentiment-analyzer"
logger = logging.getLogger(SERVICE_NAME)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

_healthy = False


async def _run_analyzer(service):
    global _healthy
    for attempt in itertools.count(1):
        try:
            await service.start()
            _healthy = True
            logger.info("Sentiment analyzer connected (attempt %d)", attempt)
            await service.run()
            break
        except asyncio.CancelledError:
            break
        except Exception:
            _healthy = False
            delay = min(5 * (2 ** (attempt - 1)), 60)
            logger.exception("Startup failed (attempt %d), retrying in %ds", attempt, delay)
            await asyncio.sleep(delay)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from services.sentiment_analyzer.src.service import SentimentAnalyzerService

    service = SentimentAnalyzerService()
    task = asyncio.create_task(_run_analyzer(service))
    shutdown.register(lambda: service.stop())
    logger.info("%s starting", SERVICE_NAME)
    yield
    await shutdown.run_cleanup()
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title=SERVICE_NAME, lifespan=lifespan)

create_metrics_route(app)


@app.get("/health")
async def health():
    if _healthy:
        return {"status": "ready", "service": SERVICE_NAME}
    return JSONResponse(status_code=503, content={"status": "starting", "service": SERVICE_NAME})


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8021)
