"""
Task Board API — kanban tasks, agent roles, task management.

M3.4: Task Board and Agent Roles.
Reference: PRD Section 10.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v2/tasks", tags=["tasks"])

_tasks: dict[str, dict] = {}

AGENT_ROLE_TEMPLATES = [
    {"id": "day-trader", "name": "Day Trader", "description": "Intraday trading specialist"},
    {"id": "technical-analyst", "name": "Technical Analyst", "description": "Chart pattern and indicator expert"},
    {"id": "risk-analyzer", "name": "Risk Analyzer", "description": "Portfolio risk assessment specialist"},
    {"id": "market-researcher", "name": "Market Researcher", "description": "Fundamental and macro analysis"},
    {"id": "options-specialist", "name": "Options Specialist", "description": "Options flow and Greeks analysis"},
    {"id": "sentiment-analyst", "name": "Sentiment Analyst", "description": "Social media and news sentiment"},
    {"id": "quant-developer", "name": "Quant Developer", "description": "Algorithm and model development"},
    {"id": "compliance-officer", "name": "Compliance Officer", "description": "Regulatory and risk compliance"},
]


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    assigned_agent_id: str | None = None
    agent_role: str | None = None
    status: str = "TODO"
    priority: str = "medium"
    skills: list[str] = Field(default_factory=list)


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    assigned_agent_id: str | None = None
    priority: str | None = None
    skills: list[str] | None = None


@router.get("/roles")
async def list_roles():
    return AGENT_ROLE_TEMPLATES


@router.get("")
async def list_tasks(status_filter: str | None = None):
    tasks = list(_tasks.values())
    if status_filter:
        tasks = [t for t in tasks if t["status"] == status_filter]
    return sorted(tasks, key=lambda x: x.get("created_at", ""), reverse=True)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate):
    task_id = str(uuid.uuid4())
    task = {
        "id": task_id,
        **payload.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _tasks[task_id] = task
    return task


@router.patch("/{task_id}")
async def update_task(task_id: str, payload: TaskUpdate):
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        task[k] = v
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: str):
    if task_id not in _tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    del _tasks[task_id]


class TaskMove(BaseModel):
    status: str = Field(..., pattern="^(BACKLOG|IN_PROGRESS|UNDER_REVIEW|COMPLETED)$")


@router.patch("/{task_id}/move")
async def move_task(task_id: str, payload: TaskMove):
    """Move a task between Kanban columns."""
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    old_status = task["status"]
    task["status"] = payload.status
    if payload.status == "IN_PROGRESS" and not task.get("started_at"):
        task["started_at"] = datetime.now(timezone.utc).isoformat()
    if payload.status == "COMPLETED":
        task["completed_at"] = datetime.now(timezone.utc).isoformat()
    return {"id": task_id, "old_status": old_status, "new_status": payload.status}
