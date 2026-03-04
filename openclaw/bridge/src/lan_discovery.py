"""LAN discovery using UDP broadcast for local Phoenix nodes."""
import asyncio, json, logging, os, socket, time

logger = logging.getLogger("phoenix.bridge.lan_discovery")

DISCOVERY_PORT = int(os.getenv("LAN_DISCOVERY_PORT", "18801"))
BROADCAST_INTERVAL = float(os.getenv("LAN_BROADCAST_INTERVAL", "30"))
SERVICE_ID = "phoenix-bridge"


class LANDiscovery:
    def __init__(self, instance_name: str, bridge_port: int = 18800):
        self.instance_name = instance_name
        self.bridge_port = bridge_port
        self.discovered_nodes: dict[str, dict] = {}
        self._running = False

    async def start(self):
        self._running = True
        asyncio.create_task(self._broadcast_loop())
        asyncio.create_task(self._listen_loop())
        logger.info(f"LAN discovery started on port {DISCOVERY_PORT}")

    async def stop(self):
        self._running = False

    @property
    def nodes(self) -> list[dict]:
        now = time.time()
        stale = [k for k, v in self.discovered_nodes.items() if now - v["last_seen"] > BROADCAST_INTERVAL * 3]
        for k in stale:
            del self.discovered_nodes[k]
        return list(self.discovered_nodes.values())

    async def _broadcast_loop(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.setblocking(False)
        payload = json.dumps({
            "service": SERVICE_ID,
            "name": self.instance_name,
            "port": self.bridge_port,
            "ts": 0,
        }).encode()
        while self._running:
            try:
                msg = json.loads(payload)
                msg["ts"] = time.time()
                sock.sendto(json.dumps(msg).encode(), ("<broadcast>", DISCOVERY_PORT))
            except Exception as e:
                logger.debug(f"Broadcast error: {e}")
            await asyncio.sleep(BROADCAST_INTERVAL)
        sock.close()

    async def _listen_loop(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("", DISCOVERY_PORT))
        sock.setblocking(False)
        loop = asyncio.get_event_loop()
        while self._running:
            try:
                data, addr = await loop.run_in_executor(None, lambda: sock.recvfrom(1024))
                msg = json.loads(data.decode())
                if msg.get("service") == SERVICE_ID and msg.get("name") != self.instance_name:
                    self.discovered_nodes[msg["name"]] = {
                        "name": msg["name"],
                        "host": addr[0],
                        "port": msg["port"],
                        "last_seen": time.time(),
                    }
            except Exception:
                await asyncio.sleep(1)
        sock.close()
