"""
Chat API — trade chat history and send message stubs.
Ported from v1; used by ChatWidget.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/v2/chat", tags=["chat"])

# In-memory stub for demo
_messages: list[dict] = []


@router.get("/history")
async def get_chat_history(limit: int = 100):
    """Return chat message history (newest first)."""
    return _messages[-limit:] if _messages else []


@router.post("/send")
async def send_message(body: dict):
    """Append a user message and return success. In production, would enqueue for trade pipeline."""
    msg = body.get("message", "")
    if not msg:
        return {"ok": False, "detail": "message required"}
    _messages.append({
        "id": len(_messages) + 1,
        "content": msg,
        "role": "user",
        "trade_id": None,
        "created_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    })
    return {"ok": True, "id": len(_messages)}
