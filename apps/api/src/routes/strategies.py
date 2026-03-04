"""
Strategy CRUD API — manage strategy agents and templates.

M2.6: Strategy agent management.
Reference: PRD Section 3.5.
"""

from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v2/strategies", tags=["strategies"])

STRATEGY_DIR = Path("openclaw/configs/strategies")

STRATEGY_TEMPLATES = [
    {"id": "mean-reversion", "name": "Mean Reversion", "description": "Buy oversold, sell overbought using RSI/Bollinger bands"},
    {"id": "momentum", "name": "Momentum", "description": "Follow trends using moving average crossovers"},
    {"id": "breakout", "name": "Breakout", "description": "Trade breakouts from consolidation ranges"},
    {"id": "pairs-trading", "name": "Pairs Trading", "description": "Statistical arbitrage between correlated assets"},
    {"id": "options-selling", "name": "Options Selling", "description": "Sell premium on high-IV options"},
]


class StrategyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    template_id: str
    symbol: str = "SPY"
    config: dict[str, Any] = Field(default_factory=dict)


@router.get("/templates")
async def list_templates():
    return STRATEGY_TEMPLATES


@router.get("")
async def list_strategies():
    # In production: query DB
    return []


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_strategy(payload: StrategyCreate):
    template = next((t for t in STRATEGY_TEMPLATES if t["id"] == payload.template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return {
        "id": f"strategy-{payload.name.lower().replace(' ', '-')}",
        "name": payload.name,
        "template": template,
        "symbol": payload.symbol,
        "status": "CREATED",
        "config": payload.config,
    }
