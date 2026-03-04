"""
Backtest API — run, list, and view backtest results.

M2.3: Backtesting pipeline API.
Reference: PRD Section 11.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v2/backtests", tags=["backtests"])

# In-memory store for demo; production uses DB
_backtest_store: dict[str, dict] = {}


class BacktestRequest(BaseModel):
    agent_id: str
    type: str = "signal_driven"
    config: dict[str, Any] = Field(default_factory=dict)
    date_range_start: str | None = None
    date_range_end: str | None = None
    initial_capital: float = 100000.0


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def start_backtest(payload: BacktestRequest):
    """Start a backtest run. Returns immediately with a run ID."""
    run_id = str(uuid.uuid4())
    _backtest_store[run_id] = {
        "id": run_id,
        "agent_id": payload.agent_id,
        "type": payload.type,
        "status": "RUNNING",
        "config": payload.config,
        "initial_capital": payload.initial_capital,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "metrics": None,
    }
    return {"id": run_id, "status": "RUNNING"}


@router.get("")
async def list_backtests(agent_id: str | None = None):
    """List backtest runs."""
    results = list(_backtest_store.values())
    if agent_id:
        results = [r for r in results if r["agent_id"] == agent_id]
    return sorted(results, key=lambda x: x["started_at"], reverse=True)


@router.get("/{backtest_id}")
async def get_backtest(backtest_id: str):
    """Get backtest result details."""
    bt = _backtest_store.get(backtest_id)
    if not bt:
        raise HTTPException(status_code=404, detail="Backtest not found")
    return bt
