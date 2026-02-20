from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/system", tags=["system"])


@router.get("/health")
async def system_health():
    return {
        "services": {
            "api-gateway": "healthy",
            "auth-service": "healthy",
            "trade-parser": "healthy",
            "trade-gateway": "healthy",
            "trade-executor": "healthy",
            "position-monitor": "healthy",
        },
        "infrastructure": {
            "kafka": "healthy",
            "postgres": "healthy",
            "redis": "healthy",
        },
    }
