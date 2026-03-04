"""
Error logs API — create, list, update, stats. For Dev Sprint Board and error logging framework.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/v2/error-logs", tags=["error-logs"])

# In-memory store (ready for DB migration)
_store: list[dict] = []


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@router.post("")
async def create_error_log(body: dict) -> dict:
    """Create an error log entry from frontend or OpenClaw agent activity (source=openclaw_agent)."""
    log_id = str(uuid.uuid4())
    now = _now()
    entry = {
        "id": log_id,
        "component": body.get("component", "global"),
        "message": body.get("message", ""),
        "stack": body.get("stack"),
        "url": body.get("url", ""),
        "source": body.get("source", "global_handler"),
        "user_id": body.get("user_id"),
        "user_agent": body.get("user_agent"),
        "fingerprint": body.get("fingerprint", ""),
        "severity": body.get("severity", "error"),
        "status": "open",
        "fix_attempt_count": 0,
        "fix_notes": None,
        "created_at": now,
        "updated_at": now,
        "resolved_at": None,
    }
    _store.append(entry)
    return {"id": log_id, "ok": True}


@router.post("/ingest-agent-activity")
async def ingest_agent_activity(body: dict) -> dict:
    """Ingest logs from OpenClaw agents (bridge/cron). Creates error_log entries with source=openclaw_agent."""
    logs = body.get("logs", [])
    if not isinstance(logs, list):
        return {"ok": False, "detail": "logs must be an array"}
    instance_id = body.get("instance_id", "unknown")
    created = 0
    for item in logs:
        log_id = str(uuid.uuid4())
        now = _now()
        message = item.get("message", str(item))[:500]
        entry = {
            "id": log_id,
            "component": item.get("component") or item.get("agent_id") or instance_id,
            "message": message,
            "stack": item.get("stack"),
            "url": item.get("url", ""),
            "source": "openclaw_agent",
            "user_id": None,
            "user_agent": None,
            "fingerprint": item.get("fingerprint", str(hash(message))),
            "severity": item.get("severity", "error"),
            "status": "open",
            "fix_attempt_count": 0,
            "fix_notes": None,
            "created_at": now,
            "updated_at": now,
            "resolved_at": None,
        }
        _store.append(entry)
        created += 1
    return {"ok": True, "created": created}


@router.get("")
async def list_error_logs(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    component: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
) -> list:
    """List error logs with optional filters."""
    out = list(_store)
    if status:
        out = [e for e in out if e.get("status") == status]
    if severity:
        for s in severity.split(","):
            out = [e for e in out if e.get("severity") == s.strip()]
    if component:
        out = [e for e in out if e.get("component") == component]
    out.sort(key=lambda e: e.get("created_at", ""), reverse=True)
    return out[:limit]


@router.get("/stats")
async def get_stats() -> dict:
    """Aggregate stats for Dev Sprint Board."""
    total = len(_store)
    by_status: dict[str, int] = {}
    by_component: dict[str, int] = {}
    for e in _store:
        s = e.get("status", "open")
        by_status[s] = by_status.get(s, 0) + 1
        c = e.get("component", "global")
        by_component[c] = by_component.get(c, 0) + 1
    open_count = by_status.get("open", 0)
    fixed_agent = by_status.get("fixed_by_agent", 0)
    fixed_admin = by_status.get("fixed_by_admin", 0)
    needs_admin = by_status.get("needs_admin", 0)
    resolved = fixed_agent + fixed_admin + by_status.get("wont_fix", 0)
    fix_rate = (resolved / total * 100) if total else 0
    return {
        "total": total,
        "open": open_count,
        "fixed_by_agent": fixed_agent,
        "fixed_by_admin": fixed_admin,
        "needs_admin": needs_admin,
        "fix_rate_pct": round(fix_rate, 1),
        "by_status": by_status,
        "by_component": by_component,
    }


@router.get("/{log_id}")
async def get_error_log(log_id: str) -> dict:
    """Get a single error log by id."""
    for e in _store:
        if e.get("id") == log_id:
            return e
    return {"detail": "Not found"}


@router.patch("/{log_id}")
async def update_error_log(log_id: str, body: dict) -> dict:
    """Update status and optional fix_notes."""
    for e in _store:
        if e.get("id") == log_id:
            now = _now()
            if "status" in body:
                e["status"] = body["status"]
            if "fix_notes" in body:
                e["fix_notes"] = body["fix_notes"]
            if body.get("status") in ("fixed_by_agent", "fixed_by_admin", "wont_fix"):
                e["resolved_at"] = now
            if "fix_attempt_count" in body:
                e["fix_attempt_count"] = body["fix_attempt_count"]
            e["updated_at"] = now
            return e
    return {"detail": "Not found"}


@router.post("/trigger-agent-review")
async def trigger_agent_review() -> dict:
    """Simulate daily agent review: group open errors by component and return summary."""
    open_errors = [e for e in _store if e.get("status") == "open"]
    by_component: dict[str, list[dict]] = {}
    for e in open_errors:
        c = e.get("component", "global")
        if c not in by_component:
            by_component[c] = []
        by_component[c].append(
            {"id": e.get("id"), "message": (e.get("message") or "")[:200], "severity": e.get("severity")}
        )
    return {
        "ok": True,
        "open_count": len(open_errors),
        "by_component": {k: len(v) for k, v in by_component.items()},
        "summary": [
            {"component": k, "count": len(v), "samples": v[:3]}
            for k, v in by_component.items()
        ],
    }
