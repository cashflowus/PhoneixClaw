"""Auto-registration of Bridge instance with the Phoenix control plane."""
import os, socket, httpx, logging, asyncio

logger = logging.getLogger("phoenix.bridge.auto_register")

CONTROL_PLANE_URL = os.getenv("CONTROL_PLANE_URL", "http://phoenix-api:8011")
INSTANCE_NAME = os.getenv("INSTANCE_NAME", socket.gethostname())
BRIDGE_PORT = int(os.getenv("BRIDGE_PORT", "18800"))
NODE_TYPE = os.getenv("NODE_TYPE", "vps")  # or "local"


async def auto_register(max_retries: int = 5, delay: float = 5.0):
    """Register this Bridge instance with the control plane. Retry on failure."""
    for attempt in range(1, max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    f"{CONTROL_PLANE_URL}/api/v2/instances",
                    json={
                        "name": INSTANCE_NAME,
                        "host": _get_local_ip(),
                        "port": BRIDGE_PORT,
                        "role": "general",
                        "node_type": NODE_TYPE,
                        "capabilities": {"auto_registered": True, "hostname": socket.gethostname()},
                    },
                )
                if resp.status_code in (201, 409):
                    logger.info(f"Registered with control plane: {resp.status_code}")
                    return resp.json() if resp.status_code == 201 else None
                logger.warning(f"Registration returned {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.warning(f"Registration attempt {attempt}/{max_retries} failed: {e}")
        await asyncio.sleep(delay * attempt)
    logger.error("Failed to register with control plane after all retries")


def _get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"
