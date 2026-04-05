"""
WebSocket API route: real-time event streaming via Redis Streams.

M2.15: WebSocket gateway — subscribes to Redis Streams and pushes
events to connected clients based on their channel subscription.

Channels:
  trades           → stream:trade-intents
  positions        → stream:trade-intents  (fill/position events)
  backtest-progress→ stream:backtest-progress
  agent-status     → stream:agent-messages  (status + heartbeat)
  signals          → stream:connector-events
  metrics          → stream:agent-messages  (metric snapshots)
  dev-incidents    → stream:dev-agent-events
"""

import asyncio
import json
import logging
import os
import uuid

import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/api/v2/ws", tags=["ws"])

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Channel → Redis Stream mapping
CHANNEL_STREAM_MAP: dict[str, str] = {
    "trades": "stream:trade-intents",
    "positions": "stream:trade-intents",
    "backtest-progress": "stream:backtest-progress",
    "agent-status": "stream:agent-messages",
    "signals": "stream:connector-events",
    "metrics": "stream:agent-messages",
    "dev-incidents": "stream:dev-agent-events",
}

# Channel → event type filter (None = all events from that stream)
CHANNEL_EVENT_FILTER: dict[str, set[str] | None] = {
    "trades": {"trade.intent.created"},
    "positions": {"trade.filled", "trade.rejected", "position.opened", "position.closed"},
    "backtest-progress": None,
    "agent-status": {"agent.status.changed", "agent.heartbeat"},
    "signals": None,
    "metrics": {"agent.heartbeat"},
    "dev-incidents": None,
}


class ConnectionManager:
    """Manages WebSocket connections grouped by channel."""

    def __init__(self):
        self._connections: dict[str, set[WebSocket]] = {}

    def add(self, channel: str, ws: WebSocket):
        self._connections.setdefault(channel, set()).add(ws)

    def remove(self, channel: str, ws: WebSocket):
        if channel in self._connections:
            self._connections[channel].discard(ws)
            if not self._connections[channel]:
                del self._connections[channel]

    def get_channels(self) -> list[str]:
        return list(self._connections.keys())

    async def broadcast(self, channel: str, data: dict):
        if channel not in self._connections:
            return
        dead: list[WebSocket] = []
        for ws in self._connections[channel]:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections[channel].discard(ws)

    @property
    def total_connections(self) -> int:
        return sum(len(v) for v in self._connections.values())


manager = ConnectionManager()
_stream_tasks: dict[str, asyncio.Task] = {}


async def _stream_reader(stream: str, channels: list[str]):
    """Background task: read Redis Stream and broadcast to matching WS channels."""
    consumer_group = "ws-gateway"
    consumer_name = f"ws-{uuid.uuid4().hex[:8]}"
    client: aioredis.Redis | None = None

    while True:
        try:
            if client is None:
                client = aioredis.from_url(REDIS_URL, decode_responses=True)
                try:
                    await client.xgroup_create(stream, consumer_group, id="0", mkstream=True)
                except aioredis.ResponseError as e:
                    if "BUSYGROUP" not in str(e):
                        raise

            messages = await client.xreadgroup(
                groupname=consumer_group,
                consumername=consumer_name,
                streams={stream: ">"},
                count=50,
                block=2000,
            )

            if not messages:
                continue

            for _stream_name, stream_messages in messages:
                for msg_id, fields in stream_messages:
                    event_type = fields.get("event_type", "")
                    # Parse data field (stored as JSON string)
                    raw_data = fields.get("data", "{}")
                    try:
                        data = json.loads(raw_data) if isinstance(raw_data, str) else raw_data
                    except (json.JSONDecodeError, TypeError):
                        data = {}

                    payload = {
                        "event_type": event_type,
                        "data": data,
                        "source": fields.get("source", ""),
                        "timestamp": fields.get("timestamp", ""),
                        "correlation_id": fields.get("correlation_id", ""),
                    }

                    for ch in channels:
                        event_filter = CHANNEL_EVENT_FILTER.get(ch)
                        if event_filter is None or event_type in event_filter:
                            await manager.broadcast(ch, {"channel": ch, **payload})

                    await client.xack(stream, consumer_group, msg_id)

        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("Stream reader error for %s, reconnecting...", stream)
            if client:
                try:
                    await client.aclose()
                except Exception:
                    pass
                client = None
            await asyncio.sleep(2)

    if client:
        await client.aclose()


def _ensure_stream_tasks():
    """Start background stream reader tasks for all active channels."""
    # Group channels by stream
    stream_channels: dict[str, list[str]] = {}
    for ch in manager.get_channels():
        stream = CHANNEL_STREAM_MAP.get(ch)
        if stream:
            stream_channels.setdefault(stream, []).append(ch)

    # Start tasks for streams that don't have one yet
    for stream, channels in stream_channels.items():
        if stream not in _stream_tasks or _stream_tasks[stream].done():
            _stream_tasks[stream] = asyncio.create_task(
                _stream_reader(stream, channels),
                name=f"ws-stream-{stream}",
            )

    # Cancel tasks for streams with no active channels
    for stream, task in list(_stream_tasks.items()):
        if stream not in stream_channels:
            task.cancel()
            del _stream_tasks[stream]


@router.websocket("/{channel}")
async def websocket_endpoint(websocket: WebSocket, channel: str):
    """Accept WebSocket connection, subscribe to channel, push real-time events."""
    if channel not in CHANNEL_STREAM_MAP:
        await websocket.close(code=4001, reason=f"Unknown channel: {channel}")
        return

    await websocket.accept()
    manager.add(channel, websocket)
    _ensure_stream_tasks()

    logger.info("WS connected: channel=%s total=%d", channel, manager.total_connections)

    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "channel": channel,
            "event_type": "connected",
            "data": {"message": f"Subscribed to {channel}"},
        })

        # Keep connection alive — listen for pings/close
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"event_type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.debug("WS disconnected: channel=%s", channel)
    finally:
        manager.remove(channel, websocket)
        _ensure_stream_tasks()
        logger.info("WS removed: channel=%s total=%d", channel, manager.total_connections)
