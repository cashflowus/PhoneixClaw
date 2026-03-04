"""
Structured request/response logging middleware.

Logs method, path, status, duration for every request. Uses JSON format for Loki ingestion.
Reference: ImplementationPlan.md M1.3, ArchitecturePlan §10 Observability.
"""

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("phoenix.api.access")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        logger.info(
            "request",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": round(duration_ms, 2),
                "client_ip": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent", ""),
            },
        )
        response.headers["X-Response-Time"] = f"{duration_ms:.1f}ms"
        return response
