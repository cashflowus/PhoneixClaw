"""
Network API routes: graph data and agent messages.

M2.10: Agent-to-Agent Communication, network visualization.
"""

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/v2/network", tags=["network"])


@router.get("/graph")
async def get_network_graph(
    limit: int = Query(50, ge=1, le=200),
):
    """Return nodes and edges for network graph visualization."""
    nodes = [
        {"id": "inst-1", "type": "instance", "label": "OpenClaw-A", "status": "online"},
        {"id": "inst-2", "type": "instance", "label": "OpenClaw-B", "status": "online"},
        {"id": "agent-1", "type": "agent", "label": "TradingAgent-1", "instance_id": "inst-1"},
        {"id": "agent-2", "type": "agent", "label": "TradingAgent-2", "instance_id": "inst-1"},
        {"id": "agent-3", "type": "agent", "label": "RiskAgent", "instance_id": "inst-2"},
    ]
    edges = [
        {"from": "agent-1", "to": "agent-2", "type": "request-response", "count": 12},
        {"from": "agent-1", "to": "agent-3", "type": "broadcast", "count": 5},
        {"from": "agent-2", "to": "agent-3", "type": "chain", "count": 3},
    ]
    return {"nodes": nodes, "edges": edges}


@router.get("/messages")
async def get_network_messages(
    limit: int = Query(50, ge=1, le=200),
    pattern: str | None = None,
):
    """Return recent agent-to-agent messages."""
    messages = [
        {
            "id": "msg-1",
            "from_agent_id": "agent-1",
            "to_agent_id": "agent-2",
            "pattern": "request-response",
            "intent": "price_check",
            "status": "SENT",
            "created_at": "2025-03-03T10:00:00Z",
        },
        {
            "id": "msg-2",
            "from_agent_id": "agent-1",
            "to_agent_id": "agent-3",
            "pattern": "broadcast",
            "intent": "position_update",
            "status": "DELIVERED",
            "created_at": "2025-03-03T10:01:00Z",
        },
    ]
    if pattern:
        messages = [m for m in messages if m["pattern"] == pattern]
    return {"messages": messages[:limit]}
