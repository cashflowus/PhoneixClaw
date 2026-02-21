import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models.database import get_session
from shared.models.trade import (
    AccountSourceMapping,
    Channel,
    DataSource,
    TradingAccount,
    User,
)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _require_admin(request: Request) -> str:
    if not getattr(request.state, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return request.state.user_id


@router.get("/users")
async def list_users(
    admin_id: str = Depends(_require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(User).order_by(User.created_at))
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "name": u.name,
            "is_active": u.is_active,
            "is_admin": u.is_admin,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_login": u.last_login.isoformat() if u.last_login else None,
        }
        for u in users
    ]


@router.get("/sources")
async def list_all_sources(
    admin_id: str = Depends(_require_admin),
    session: AsyncSession = Depends(get_session),
):
    """List all data sources across all users with owner info."""
    stmt = (
        select(DataSource, User.email, User.name)
        .join(User, DataSource.user_id == User.id)
        .order_by(DataSource.created_at)
    )
    result = await session.execute(stmt)
    rows = result.all()

    sources = []
    for ds, email, name in rows:
        ch_count = (
            await session.execute(
                select(func.count(Channel.id)).where(Channel.data_source_id == ds.id)
            )
        ).scalar() or 0

        sources.append({
            "id": str(ds.id),
            "user_id": str(ds.user_id),
            "owner_email": email,
            "owner_name": name,
            "source_type": ds.source_type,
            "display_name": ds.display_name,
            "auth_type": ds.auth_type,
            "enabled": ds.enabled,
            "connection_status": ds.connection_status,
            "channel_count": ch_count,
            "created_at": ds.created_at.isoformat() if ds.created_at else None,
        })
    return sources


@router.get("/sources/{source_id}/channels")
async def list_source_channels(
    source_id: str,
    admin_id: str = Depends(_require_admin),
    session: AsyncSession = Depends(get_session),
):
    """List channels for any source (admin access)."""
    result = await session.execute(
        select(Channel).where(Channel.data_source_id == uuid.UUID(source_id))
    )
    channels = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "channel_identifier": c.channel_identifier,
            "display_name": c.display_name,
            "enabled": c.enabled,
        }
        for c in channels
    ]


@router.post("/mappings")
async def create_admin_mapping(
    request: Request,
    admin_id: str = Depends(_require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Map any user's channel to admin's trading account."""
    body = await request.json()
    trading_account_id = body.get("trading_account_id")
    channel_id = body.get("channel_id")

    if not trading_account_id or not channel_id:
        raise HTTPException(status_code=400, detail="trading_account_id and channel_id required")

    ta = await session.get(TradingAccount, uuid.UUID(trading_account_id))
    if not ta or str(ta.user_id) != admin_id:
        raise HTTPException(status_code=403, detail="Trading account does not belong to you")

    ch = await session.get(Channel, uuid.UUID(channel_id))
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")

    existing = await session.execute(
        select(AccountSourceMapping).where(
            AccountSourceMapping.trading_account_id == ta.id,
            AccountSourceMapping.channel_id == ch.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Mapping already exists")

    mapping = AccountSourceMapping(
        trading_account_id=ta.id,
        channel_id=ch.id,
        config_overrides=body.get("config_overrides", {}),
    )
    session.add(mapping)
    await session.commit()
    await session.refresh(mapping)

    return {
        "id": str(mapping.id),
        "trading_account_id": str(mapping.trading_account_id),
        "channel_id": str(mapping.channel_id),
        "enabled": mapping.enabled,
    }


@router.post("/users/{user_id}/promote")
async def promote_user(
    user_id: str,
    admin_id: str = Depends(_require_admin),
    session: AsyncSession = Depends(get_session),
):
    user = await session.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = True
    await session.commit()
    return {"status": "promoted", "user_id": user_id}


@router.post("/users/{user_id}/demote")
async def demote_user(
    user_id: str,
    admin_id: str = Depends(_require_admin),
    session: AsyncSession = Depends(get_session),
):
    if user_id == admin_id:
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    user = await session.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = False
    await session.commit()
    return {"status": "demoted", "user_id": user_id}
