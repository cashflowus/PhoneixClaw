"""
Agent Learning API routes — manage behavior learning sessions.

Sessions ingest content from YouTube, Discord, or trade logs to build
trading behavior profiles that can be deployed as autonomous agents.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v2/agent-learning", tags=["agent-learning"])

MOCK_SESSIONS: dict[str, dict[str, Any]] = {
    "ls-001": {
        "id": "ls-001",
        "agent_name": "SMB-Momentum-Learner",
        "source_type": "youtube_channel",
        "source_url": "https://youtube.com/@SMBCapital",
        "status": "READY",
        "progress": 100,
        "target_role": "day_trader",
        "learning_depth": "deep",
        "auto_deploy": False,
        "behavior_profile": {
            "risk_tolerance": "Moderate — 1-2% per trade",
            "preferred_instruments": ["SPY", "QQQ", "Large-cap momentum stocks"],
            "trading_style": "Intraday momentum with strict risk management",
            "entry_patterns": ["Opening range breakout", "VWAP reclaim", "Relative strength confirmation"],
            "exit_patterns": ["Trailing stop at 20 EMA", "Time-based exit at 3:30 PM", "Target 2:1 R:R"],
            "time_of_day": "9:30 AM – 11:30 AM, 2:00 PM – 4:00 PM",
            "position_sizing": "Fixed fractional — 1% risk per trade, scale in up to 3 entries",
        },
        "key_concepts": ["Tape reading", "Level 2 analysis", "Risk-first approach", "Sector rotation", "VWAP anchoring"],
        "created_at": "2026-02-28T14:00:00Z",
    },
    "ls-002": {
        "id": "ls-002",
        "agent_name": "Discord-Swing-Analyzer",
        "source_type": "discord_channel",
        "source_url": "discord://guild/123456/channel/789012",
        "status": "ANALYZING",
        "progress": 47,
        "target_role": "swing_trader",
        "learning_depth": "standard",
        "auto_deploy": True,
        "behavior_profile": None,
        "key_concepts": ["Earnings plays", "Technical breakouts"],
        "created_at": "2026-03-01T09:30:00Z",
    },
}


class SessionCreate(BaseModel):
    agent_name: str = Field(..., min_length=1, max_length=120)
    source_type: str = Field(..., pattern="^(youtube_channel|youtube_playlist|discord_channel|trade_log)$")
    source_url: str = Field(..., min_length=1)
    target_role: str = Field(..., pattern="^(day_trader|swing_trader|options_specialist|scalper)$")
    learning_depth: str = Field(default="standard", pattern="^(quick|standard|deep)$")
    auto_deploy: bool = False


@router.get("/sessions")
async def list_sessions():
    return list(MOCK_SESSIONS.values())


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(payload: SessionCreate):
    session_id = f"ls-{uuid.uuid4().hex[:6]}"
    session = {
        "id": session_id,
        "agent_name": payload.agent_name,
        "source_type": payload.source_type,
        "source_url": payload.source_url,
        "status": "INGESTING",
        "progress": 0,
        "target_role": payload.target_role,
        "learning_depth": payload.learning_depth,
        "auto_deploy": payload.auto_deploy,
        "behavior_profile": None,
        "key_concepts": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    MOCK_SESSIONS[session_id] = session
    return session


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    session = MOCK_SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


@router.post("/sessions/{session_id}/deploy")
async def deploy_session(session_id: str):
    session = MOCK_SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session["status"] != "READY":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session must be in READY state to deploy")
    session["status"] = "DEPLOYED"
    return {"id": session_id, "status": "DEPLOYED"}


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: str):
    if session_id not in MOCK_SESSIONS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    del MOCK_SESSIONS[session_id]
