"""
WebSocket API route: upgrade handler for real-time channels.

M2.15: WebSocket gateway integration.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/api/v2/ws", tags=["ws"])


@router.websocket("/{channel}")
async def websocket_endpoint(websocket: WebSocket, channel: str):
    """Accept WebSocket connection and handle channel. Forwards to ws-gateway or handles inline."""
    await websocket.accept()
    try:
        # In production: proxy to ws-gateway service or subscribe to Redis pub/sub
        # For now: echo back messages (inline handler)
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"channel": channel, "echo": data})
    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close()
        except Exception:
            pass
