"""
Agent Messages API — inter-agent communication log and messaging.

Reference: PRD Section 8 (Agent Communication), ArchitecturePlan §6.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v2/agent-messages", tags=["agent-messages"])

_messages: list[dict] = []


class MessageCreate(BaseModel):
    from_agent_id: str
    to_agent_id: str | None = None
    pattern: str = Field(default="request-response", pattern="^(request-response|broadcast|pub-sub|chain|consensus)$")
    intent: str = Field(..., min_length=1, max_length=100)
    data: dict = Field(default_factory=dict)
    topic: str | None = None
    body: str | None = None


class MessageResponse(BaseModel):
    id: str
    from_agent_id: str
    to_agent_id: str | None
    pattern: str
    intent: str
    data: dict
    topic: str | None
    body: str | None
    status: str
    created_at: str


@router.get("", response_model=list[MessageResponse])
async def list_messages(
    agent_id: str | None = None,
    topic: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List inter-agent messages with optional filters."""
    msgs = _messages
    if agent_id:
        msgs = [m for m in msgs if m["from_agent_id"] == agent_id or m.get("to_agent_id") == agent_id]
    if topic:
        msgs = [m for m in msgs if m.get("topic") == topic]
    return sorted(msgs, key=lambda x: x["created_at"], reverse=True)[offset:offset + limit]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=MessageResponse)
async def send_message(payload: MessageCreate):
    """Send an inter-agent message."""
    msg = {
        "id": str(uuid.uuid4()),
        **payload.model_dump(),
        "status": "SENT",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _messages.append(msg)
    return msg


@router.get("/{message_id}", response_model=MessageResponse)
async def get_message(message_id: str):
    """Get a specific message by ID."""
    for msg in _messages:
        if msg["id"] == message_id:
            return msg
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
