import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from shared.graceful_shutdown import shutdown
from services.api_gateway.src.middleware import JWTMiddleware
from services.auth_service.src.auth import router as auth_router
from services.api_gateway.src.routes.accounts import router as accounts_router
from services.api_gateway.src.routes.sources import router as sources_router
from services.api_gateway.src.routes.mappings import router as mappings_router
from services.api_gateway.src.routes.trades import router as trades_router
from services.api_gateway.src.routes.metrics import router as metrics_router
from services.api_gateway.src.routes.notifications import router as notifications_router
from services.api_gateway.src.routes.system import router as system_router

SERVICE_NAME = "api-gateway"
logger = logging.getLogger(SERVICE_NAME)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("%s ready", SERVICE_NAME)
    yield
    await shutdown.run_cleanup()


app = FastAPI(title="Copy Trading Platform API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(JWTMiddleware)

app.include_router(auth_router)
app.include_router(accounts_router)
app.include_router(sources_router)
app.include_router(mappings_router)
app.include_router(trades_router)
app.include_router(metrics_router)
app.include_router(notifications_router)
app.include_router(system_router)


@app.get("/health")
async def health():
    return {"status": "ready", "service": SERVICE_NAME}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8011)
