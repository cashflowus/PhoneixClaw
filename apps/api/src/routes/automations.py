"""
Automations API — cron-scheduled tasks and NL task input.

M3.5: Automation scheduler.
Reference: PRD Section 10.2.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v2/automations", tags=["automations"])

_automations: dict[str, dict] = {}

AUTOMATION_TEMPLATES = [
    {"id": "morning-briefing", "name": "Morning Market Briefing", "cron": "0 8 * * 1-5", "description": "Daily pre-market summary"},
    {"id": "eod-report", "name": "End of Day Report", "cron": "0 16 * * 1-5", "description": "Daily P&L and position summary"},
    {"id": "earnings-watch", "name": "Earnings Watch", "cron": "0 7 * * 1-5", "description": "Upcoming earnings alerts"},
    {"id": "options-expiry", "name": "Options Expiry Check", "cron": "0 9 * * 5", "description": "Weekly options expiration review"},
    {"id": "portfolio-rebalance", "name": "Portfolio Rebalance", "cron": "0 10 1 * *", "description": "Monthly portfolio rebalancing"},
    {"id": "risk-report", "name": "Weekly Risk Report", "cron": "0 17 * * 5", "description": "Weekly risk metrics summary"},
]


class AutomationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    cron_expression: str = "0 8 * * 1-5"
    task_prompt: str = ""
    delivery_channel: str = "dashboard"
    target_instance_id: str | None = None
    is_active: bool = True


@router.get("/templates")
async def list_templates():
    return AUTOMATION_TEMPLATES


@router.get("")
async def list_automations():
    return sorted(_automations.values(), key=lambda x: x.get("created_at", ""), reverse=True)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_automation(payload: AutomationCreate):
    auto_id = str(uuid.uuid4())
    automation = {
        "id": auto_id,
        **payload.model_dump(),
        "last_run": None,
        "next_run": None,
        "run_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _automations[auto_id] = automation
    return automation


@router.patch("/{auto_id}")
async def update_automation(auto_id: str, payload: dict):
    auto = _automations.get(auto_id)
    if not auto:
        raise HTTPException(status_code=404, detail="Automation not found")
    for k, v in payload.items():
        if k not in ("id", "created_at"):
            auto[k] = v
    return auto


@router.delete("/{auto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_automation(auto_id: str):
    if auto_id not in _automations:
        raise HTTPException(status_code=404, detail="Automation not found")
    del _automations[auto_id]


@router.post("/{auto_id}/run")
async def trigger_automation(auto_id: str):
    auto = _automations.get(auto_id)
    if not auto:
        raise HTTPException(status_code=404, detail="Automation not found")
    auto["last_run"] = datetime.now(timezone.utc).isoformat()
    auto["run_count"] = auto.get("run_count", 0) + 1
    return {"status": "triggered", "automation_id": auto_id}
