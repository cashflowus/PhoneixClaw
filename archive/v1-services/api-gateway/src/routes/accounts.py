import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.crypto.credentials import encrypt_credentials
from shared.models.database import get_session
from shared.models.trade import TradingAccount

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])

class AccountCreate(BaseModel):
    broker_type: str
    display_name: str
    credentials: dict
    paper_mode: bool = True
    risk_config: dict | None = None

class AccountResponse(BaseModel):
    id: str
    broker_type: str
    display_name: str
    paper_mode: bool
    enabled: bool
    health_status: str
    risk_config: dict
    created_at: str

class AccountUpdate(BaseModel):
    display_name: str | None = None
    paper_mode: bool | None = None
    risk_config: dict | None = None
    enabled: bool | None = None

@router.get("", response_model=list[AccountResponse])
async def list_accounts(request: Request, session: AsyncSession = Depends(get_session)):
    user_id = request.state.user_id
    result = await session.execute(select(TradingAccount).where(TradingAccount.user_id == uuid.UUID(user_id)))
    accounts = result.scalars().all()
    return [_to_response(a) for a in accounts]

@router.post("", response_model=AccountResponse, status_code=201)
async def create_account(req: AccountCreate, request: Request, session: AsyncSession = Depends(get_session)):
    user_id = request.state.user_id
    account = TradingAccount(
        user_id=uuid.UUID(user_id),
        broker_type=req.broker_type,
        display_name=req.display_name,
        credentials_encrypted=encrypt_credentials(req.credentials),
        paper_mode=req.paper_mode,
        risk_config=req.risk_config or {
            "max_position_size": 10, "max_daily_loss": 1000,
            "max_total_contracts": 100, "max_notional_value": 50000,
        },
    )
    session.add(account)
    await session.commit()
    await session.refresh(account)
    return _to_response(account)

@router.patch("/{account_id}", response_model=AccountResponse)
@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: str, req: AccountUpdate, request: Request,
    session: AsyncSession = Depends(get_session),
):
    user_id = request.state.user_id
    result = await session.execute(
        select(TradingAccount).where(
            TradingAccount.id == uuid.UUID(account_id),
            TradingAccount.user_id == uuid.UUID(user_id),
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if req.display_name is not None:
        account.display_name = req.display_name
    if req.paper_mode is not None:
        account.paper_mode = req.paper_mode
    if req.risk_config is not None:
        account.risk_config = req.risk_config
    if req.enabled is not None:
        account.enabled = req.enabled
    account.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(account)
    return _to_response(account)

@router.delete("/{account_id}", status_code=204)
async def delete_account(
    account_id: str, request: Request,
    session: AsyncSession = Depends(get_session),
):
    user_id = request.state.user_id
    result = await session.execute(
        select(TradingAccount).where(
            TradingAccount.id == uuid.UUID(account_id),
            TradingAccount.user_id == uuid.UUID(user_id),
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    await session.delete(account)
    await session.commit()

@router.post("/{account_id}/toggle-mode", response_model=AccountResponse)
async def toggle_mode(
    account_id: str, request: Request,
    session: AsyncSession = Depends(get_session),
):
    user_id = request.state.user_id
    result = await session.execute(
        select(TradingAccount).where(
            TradingAccount.id == uuid.UUID(account_id),
            TradingAccount.user_id == uuid.UUID(user_id),
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    account.paper_mode = not account.paper_mode
    account.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(account)
    return _to_response(account)

@router.post("/{account_id}/verify")
async def verify_account(
    account_id: str, request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Verify Alpaca connectivity: check credentials, account status, buying power, and positions."""
    user_id = request.state.user_id
    is_admin = getattr(request.state, "is_admin", False)

    filters = [TradingAccount.id == uuid.UUID(account_id)]
    if not is_admin:
        filters.append(TradingAccount.user_id == uuid.UUID(user_id))

    result = await session.execute(select(TradingAccount).where(*filters))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    from shared.broker.factory import create_broker_adapter

    try:
        adapter = create_broker_adapter(
            account.broker_type, account.credentials_encrypted, account.paper_mode,
        )
    except Exception as e:
        logger.exception("Failed to create broker adapter for account %s", account_id)
        return {
            "success": False,
            "stage": "credential_decrypt",
            "error": str(e),
        }

    results: dict = {
        "account_id": str(account.id),
        "broker_type": account.broker_type,
        "paper_mode": account.paper_mode,
    }

    try:
        acct_info = await adapter.get_account()
        results["account_info"] = acct_info
        results["account_connected"] = True
    except Exception as e:
        logger.exception("Alpaca account check failed for %s", account_id)
        results["account_connected"] = False
        results["account_error"] = str(e)
        try:
            await adapter.close()
        except Exception:
            pass
        return {"success": False, "stage": "account_check", **results}

    try:
        positions = await adapter.get_positions()
        results["open_positions"] = len(positions)
        results["positions"] = positions[:10]
    except Exception as e:
        results["positions_error"] = str(e)
        results["open_positions"] = -1

    try:
        quote = await adapter.get_quote("SPY")
        results["market_data"] = {"spy_quote": quote}
        results["market_data_connected"] = True
    except Exception as e:
        results["market_data_connected"] = False
        results["market_data_error"] = str(e)

    try:
        await adapter.close()
    except Exception:
        pass

    account.health_status = "healthy" if results.get("account_connected") else "unhealthy"
    account.updated_at = datetime.now(timezone.utc)
    await session.commit()

    return {"success": True, "stage": "complete", **results}


def _to_response(account: TradingAccount) -> AccountResponse:
    return AccountResponse(
        id=str(account.id), broker_type=account.broker_type, display_name=account.display_name,
        paper_mode=account.paper_mode, enabled=account.enabled, health_status=account.health_status,
        risk_config=account.risk_config, created_at=account.created_at.isoformat(),
    )
