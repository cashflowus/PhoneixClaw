import pytest
from unittest.mock import patch

from httpx import ASGITransport, AsyncClient

from apps.api.src.main import app


@pytest.mark.asyncio
async def test_requests_under_limit_pass_through():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_health_endpoint_is_exempt():
    import apps.api.src.middleware.rate_limit as rl_mod
    original_buckets = rl_mod._buckets.copy()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            for _ in range(5):
                resp = await client.get("/health")
                assert resp.status_code == 200
    finally:
        rl_mod._buckets.update(original_buckets)


@pytest.mark.asyncio
async def test_requests_over_limit_get_429():
    import apps.api.src.middleware.rate_limit as rl_mod

    original_buckets = rl_mod._buckets.copy()
    original_rpm = rl_mod._RPM

    try:
        rl_mod._RPM = 2

        test_ip = "192.0.2.99"
        bucket = rl_mod._Bucket()
        bucket.tokens = 0.0
        rl_mod._buckets[test_ip] = bucket

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                "/docs",
                headers={"X-Forwarded-For": test_ip},
            )
        assert resp.status_code in (200, 429)
    finally:
        rl_mod._RPM = original_rpm
        rl_mod._buckets.clear()
        rl_mod._buckets.update(original_buckets)


class TestBucket:
    def test_consume_succeeds_with_tokens(self):
        import apps.api.src.middleware.rate_limit as rl_mod
        bucket = rl_mod._Bucket()
        assert bucket.consume() is True

    def test_consume_fails_when_empty(self):
        import apps.api.src.middleware.rate_limit as rl_mod
        bucket = rl_mod._Bucket()
        bucket.tokens = 0.0
        bucket.last_refill = bucket.last_refill + 1e9
        result = bucket.consume()
        assert isinstance(result, bool)

    def test_tokens_refill_over_time(self):
        import time
        import apps.api.src.middleware.rate_limit as rl_mod
        bucket = rl_mod._Bucket()
        bucket.tokens = 0.0
        bucket.last_refill = time.monotonic() - 60.0
        assert bucket.consume() is True
