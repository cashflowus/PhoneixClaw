"""
Notifications API — unread count, list, mark read.
Stub for sidebar bell popover.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/v2/notifications", tags=["notifications"])

# In-memory stub
_notifications: list[dict] = []
_read_ids: set[int] = set()


@router.get("/unread-count")
async def unread_count() -> dict:
    """Return count of unread notifications."""
    unread = sum(1 for n in _notifications if n.get("id") not in _read_ids)
    return {"count": unread}


@router.get("")
async def list_notifications(limit: int = 20) -> list:
    """Return recent notifications."""
    return _notifications[:limit]


@router.patch("/mark-read")
async def mark_read() -> dict:
    """Mark all current notifications as read."""
    for n in _notifications:
        _read_ids.add(n.get("id", 0))
    return {"ok": True}
