import uuid

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models.database import get_session
from shared.models.trade import NotificationLog, User

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


class NotificationPrefsUpdate(BaseModel):
    email_enabled: bool | None = None
    whatsapp_enabled: bool | None = None
    whatsapp_phone_number_id: str | None = None
    whatsapp_access_token: str | None = None
    whatsapp_to_number: str | None = None


@router.get("")
async def list_notifications(
    request: Request,
    limit: int = Query(50, le=200),
    session: AsyncSession = Depends(get_session),
):
    user_id = request.state.user_id
    stmt = (
        select(NotificationLog)
        .where(NotificationLog.user_id == uuid.UUID(user_id))
        .order_by(desc(NotificationLog.created_at))
        .limit(limit)
    )
    result = await session.execute(stmt)
    rows = result.scalars().all()
    return [
        {
            "id": n.id,
            "type": n.notification_type,
            "title": n.title,
            "body": n.body,
            "read": n.read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in rows
    ]


@router.get("/unread-count")
async def unread_count(request: Request, session: AsyncSession = Depends(get_session)):
    user_id = request.state.user_id
    result = await session.execute(
        select(func.count(NotificationLog.id)).where(
            NotificationLog.user_id == uuid.UUID(user_id),
            NotificationLog.read.is_(False),
        )
    )
    return {"unread_count": result.scalar() or 0}


@router.patch("/mark-read")
async def mark_all_read(request: Request, session: AsyncSession = Depends(get_session)):
    user_id = request.state.user_id
    await session.execute(
        update(NotificationLog)
        .where(
            NotificationLog.user_id == uuid.UUID(user_id),
            NotificationLog.read.is_(False),
        )
        .values(read=True)
    )
    await session.commit()
    return {"status": "ok"}


@router.get("/preferences")
async def get_notification_prefs(request: Request, session: AsyncSession = Depends(get_session)):
    user_id = request.state.user_id
    result = await session.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        return {"email_enabled": True, "whatsapp_enabled": False}
    prefs = user.notification_prefs or {}
    return {
        "email_enabled": prefs.get("email_enabled", True),
        "whatsapp_enabled": prefs.get("whatsapp_enabled", False),
        "whatsapp_phone_number_id": prefs.get("whatsapp_phone_number_id", ""),
        "whatsapp_access_token": "••••" if prefs.get("whatsapp_access_token") else "",
        "whatsapp_to_number": prefs.get("whatsapp_to_number", ""),
    }


@router.patch("/preferences")
async def update_notification_prefs(
    request: Request,
    body: NotificationPrefsUpdate,
    session: AsyncSession = Depends(get_session),
):
    user_id = request.state.user_id
    result = await session.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        return {"status": "error", "detail": "User not found"}

    prefs = dict(user.notification_prefs or {})
    updates = body.model_dump(exclude_none=True)
    prefs.update(updates)
    user.notification_prefs = prefs
    await session.commit()
    return {"status": "ok"}
