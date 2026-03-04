"""
Token-bucket rate limiter middleware.

Limits requests per IP to prevent abuse. Configurable via RATE_LIMIT_RPM env var.
Reference: ImplementationPlan.md M1.3 security.
"""

import os
import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

_RPM = int(os.getenv("RATE_LIMIT_RPM", "120"))
_WINDOW = 60.0


class _Bucket:
    __slots__ = ("tokens", "last_refill")

    def __init__(self):
        self.tokens: float = _RPM
        self.last_refill: float = time.monotonic()

    def consume(self) -> bool:
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(_RPM, self.tokens + elapsed * (_RPM / _WINDOW))
        self.last_refill = now
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False


_buckets: dict[str, _Bucket] = defaultdict(_Bucket)


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in ("/health", "/docs", "/openapi.json", "/redoc"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        bucket = _buckets[client_ip]
        if not bucket.consume():
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again later."},
                headers={"Retry-After": str(int(_WINDOW))},
            )
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(_RPM)
        response.headers["X-RateLimit-Remaining"] = str(int(bucket.tokens))
        return response
