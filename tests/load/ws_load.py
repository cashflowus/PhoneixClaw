"""
WebSocket load test — 100 concurrent connections, trades/positions channels.

Uses websockets library. Measures connection time, message latency, disconnects.
M3.13: Performance and load testing.
"""

import asyncio
import os
import time
from dataclasses import dataclass, field

try:
    import websockets
except ImportError:
    websockets = None


@dataclass
class WsMetrics:
    """Aggregated WebSocket load test metrics."""
    connections: int = 0
    connect_times_ms: list[float] = field(default_factory=list)
    message_latencies_ms: list[float] = field(default_factory=list)
    disconnects: int = 0
    errors: int = 0


WS_URL = os.environ.get("WS_URL", "ws://localhost:8011/api/v2/ws")
CHANNELS = ["trades", "positions"]
CONCURRENT = 100
DURATION_SEC = 5


async def connect_and_subscribe(channel: str, metrics: WsMetrics) -> None:
    """Connect to channel, measure latency, stay connected for duration."""
    url = f"{WS_URL}/{channel}"
    try:
        t0 = time.perf_counter()
        async with websockets.connect(url) as ws:
            metrics.connections += 1
            metrics.connect_times_ms.append((time.perf_counter() - t0) * 1000)
            t1 = time.perf_counter()
            await ws.send('{"action":"subscribe"}')
            msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
            metrics.message_latencies_ms.append((time.perf_counter() - t1) * 1000)
            await asyncio.sleep(DURATION_SEC)
    except asyncio.TimeoutError:
        metrics.errors += 1
    except Exception:
        metrics.disconnects += 1
        metrics.errors += 1


async def run_load_test() -> WsMetrics:
    """Run 100 concurrent WebSocket connections across trades/positions."""
    metrics = WsMetrics()
    tasks = []
    for i in range(CONCURRENT):
        ch = CHANNELS[i % len(CHANNELS)]
        tasks.append(connect_and_subscribe(ch, metrics))
    await asyncio.gather(*tasks)
    return metrics


def main() -> None:
    if websockets is None:
        print("Install websockets: pip install websockets")
        return
    print(f"WebSocket load test: {CONCURRENT} connections, {DURATION_SEC}s")
    print(f"URL: {WS_URL}")
    metrics = asyncio.run(run_load_test())
    ct = metrics.connect_times_ms
    ml = metrics.message_latencies_ms
    print(f"Connections: {metrics.connections}/{CONCURRENT}")
    print(f"Disconnects: {metrics.disconnects}")
    print(f"Errors: {metrics.errors}")
    if ct:
        print(f"Connect time (avg): {sum(ct)/len(ct):.1f}ms")
    if ml:
        print(f"Message latency (avg): {sum(ml)/len(ml):.1f}ms")


if __name__ == "__main__":
    main()
