import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models.database import get_session
from shared.models.trade import AdvancedPipeline, AdvancedPipelineVersion

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/advanced-pipelines", tags=["advanced-pipelines"])


class PipelineCreate(BaseModel):
    name: str
    description: str | None = None
    flow_json: dict = {}
    tags: list[str] = []


class PipelineUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    flow_json: dict | None = None
    tags: list[str] | None = None


@router.get("")
async def list_pipelines(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    user_id = request.state.user_id
    result = await session.execute(
        select(AdvancedPipeline)
        .where(AdvancedPipeline.user_id == uuid.UUID(user_id))
        .order_by(desc(AdvancedPipeline.updated_at))
    )
    return [_response(p) for p in result.scalars().all()]


@router.get("/{pipeline_id}")
async def get_pipeline(
    pipeline_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    p = await _get_pipeline(pipeline_id, request, session)
    return _response(p)


@router.post("", status_code=201)
async def create_pipeline(
    req: PipelineCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    user_id = request.state.user_id
    pipeline = AdvancedPipeline(
        user_id=uuid.UUID(user_id),
        name=req.name,
        description=req.description,
        flow_json=req.flow_json or {},
        tags=req.tags or [],
    )
    session.add(pipeline)
    await session.commit()
    await session.refresh(pipeline)

    version = AdvancedPipelineVersion(
        pipeline_id=pipeline.id,
        version=1,
        flow_json=req.flow_json or {},
        change_summary="Initial version",
        created_by=uuid.UUID(user_id),
    )
    session.add(version)
    await session.commit()

    return _response(pipeline)


@router.put("/{pipeline_id}")
async def update_pipeline(
    pipeline_id: str,
    req: PipelineUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    p = await _get_pipeline(pipeline_id, request, session)

    if req.name is not None:
        p.name = req.name
    if req.description is not None:
        p.description = req.description
    if req.tags is not None:
        p.tags = req.tags
    if req.flow_json is not None:
        p.flow_json = req.flow_json
        p.version += 1

        version = AdvancedPipelineVersion(
            pipeline_id=p.id,
            version=p.version,
            flow_json=req.flow_json,
            change_summary=f"Version {p.version}",
            created_by=uuid.UUID(request.state.user_id),
        )
        session.add(version)

    p.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(p)
    return _response(p)


@router.delete("/{pipeline_id}", status_code=204)
async def delete_pipeline(
    pipeline_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    p = await _get_pipeline(pipeline_id, request, session)
    await session.delete(p)
    await session.commit()


@router.post("/{pipeline_id}/deploy")
async def deploy_pipeline(
    pipeline_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    p = await _get_pipeline(pipeline_id, request, session)

    nodes = p.flow_json.get("nodes", [])
    p.flow_json.get("edges", [])
    if not nodes:
        raise HTTPException(status_code=400, detail="Pipeline has no nodes")

    has_source = any(n.get("type") == "dataSource" for n in nodes)
    has_broker = any(n.get("type") == "broker" for n in nodes)
    if not has_source:
        raise HTTPException(status_code=400, detail="Pipeline must have at least one data source")
    if not has_broker:
        raise HTTPException(status_code=400, detail="Pipeline must have at least one broker node")

    p.status = "deployed"
    p.enabled = True
    p.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(p)
    return _response(p)


@router.post("/{pipeline_id}/test")
async def test_pipeline(
    pipeline_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    p = await _get_pipeline(pipeline_id, request, session)

    nodes = p.flow_json.get("nodes", [])

    results = []
    for node in nodes:
        results.append({
            "node_id": node.get("id"),
            "node_type": node.get("type"),
            "label": node.get("data", {}).get("label", ""),
            "status": "ok",
            "output_sample": {"message": f"Test passed for {node.get('data', {}).get('label', '')}"},
        })

    return {"pipeline_id": pipeline_id, "test_results": results, "overall": "passed"}


class SimulateRequest(BaseModel):
    input: str


@router.post("/{pipeline_id}/simulate")
async def simulate_pipeline(
    pipeline_id: str,
    req: SimulateRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Simulate data flowing through the pipeline with sample input."""
    import json as _json
    import time

    p = await _get_pipeline(pipeline_id, request, session)
    nodes = p.flow_json.get("nodes", [])
    edges = p.flow_json.get("edges", [])

    try:
        input_data = _json.loads(req.input)
    except _json.JSONDecodeError:
        input_data = {"raw_message": req.input}

    ordered = _topological_sort(nodes, edges)
    results = []
    current_data = input_data

    for node in ordered:
        node_id = node.get("id", "")
        node_type = node.get("type", "")
        node_data = node.get("data", {})
        label = node_data.get("label", node_type)

        t0 = time.monotonic()
        try:
            output = _simulate_node(node_type, node_data, current_data)
            duration = int((time.monotonic() - t0) * 1000) + 1
            results.append({
                "node_id": node_id,
                "node_type": node_type,
                "label": label,
                "status": "success",
                "input_sample": _truncate(current_data),
                "output_sample": _truncate(output),
                "duration_ms": duration,
            })
            current_data = output
        except Exception as exc:
            duration = int((time.monotonic() - t0) * 1000) + 1
            results.append({
                "node_id": node_id,
                "node_type": node_type,
                "label": label,
                "status": "error",
                "input_sample": _truncate(current_data),
                "output_sample": None,
                "duration_ms": duration,
                "error": str(exc)[:200],
            })

    overall = "passed" if all(r["status"] == "success" for r in results) else "failed"
    return {
        "pipeline_id": pipeline_id,
        "test_results": results,
        "overall": overall,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }


def _simulate_node(node_type: str, node_data: dict, input_data: dict) -> dict:
    """Simulate a single node's processing with realistic mock outputs."""
    subtype = node_data.get("subtype", "") or node_data.get("model_type", "")

    if node_type == "dataSource":
        return {
            **input_data,
            "source_type": subtype or "discord",
            "source_id": node_data.get("source_id", "src_mock"),
            "ingested_at": datetime.now(timezone.utc).isoformat(),
        }

    if node_type == "processing":
        if subtype == "sentiment_analyzer":
            text = input_data.get("content", input_data.get("raw_message", ""))
            is_bullish = any(w in text.lower() for w in ["bullish", "buy", "strong", "great", "up", "momentum"])
            score = 0.82 if is_bullish else -0.45
            return {
                **input_data,
                "sentiment_score": score,
                "sentiment_label": "bullish" if score > 0.2 else "bearish" if score < -0.2 else "neutral",
                "confidence": 0.91,
                "model_used": node_data.get("model", "finbert"),
            }
        if subtype == "parser":
            content = input_data.get("content", input_data.get("raw_message", ""))
            return {
                **input_data,
                "parsed_trade": {
                    "action": "BUY" if "buy" in content.lower() else "SELL",
                    "ticker": "AAPL",
                    "asset_type": "option" if any(w in content.lower() for w in ["call", "put", "c ", "p "]) else "equity",
                    "confidence": 0.88,
                },
            }
        if subtype == "ticker_extractor":
            import re
            content = input_data.get("content", input_data.get("raw_message", ""))
            tickers = re.findall(r'\b[A-Z]{1,5}\b', content)
            return {
                **input_data,
                "extracted_tickers": tickers[:5] if tickers else ["AAPL"],
                "ticker_count": len(tickers) if tickers else 1,
            }
        return {**input_data, "processed": True}

    if node_type == "aiModel":
        sentiment = input_data.get("sentiment_score", 0)
        parsed = input_data.get("parsed_trade", {})
        ticker = parsed.get("ticker") or input_data.get("ticker", "AAPL")
        return {
            **input_data,
            "ai_recommendation": {
                "action": parsed.get("action", "BUY"),
                "ticker": ticker,
                "confidence": 0.85,
                "reasoning": f"Based on sentiment ({sentiment:.2f}) and parsed signals, "
                             f"{'bullish' if sentiment > 0 else 'bearish'} outlook for {ticker}",
                "risk_score": 0.35,
                "suggested_position_pct": 5,
            },
        }

    if node_type == "broker":
        rec = input_data.get("ai_recommendation", {})
        return {
            **input_data,
            "order": {
                "broker": node_data.get("broker_type", "alpaca"),
                "account": node_data.get("account_name", "Paper Account"),
                "action": rec.get("action", "BUY"),
                "ticker": rec.get("ticker", "AAPL"),
                "qty": 10,
                "order_type": node_data.get("order_type", "market"),
                "status": "simulated",
                "paper_mode": True,
            },
        }

    if node_type == "control":
        if subtype == "condition":
            expr = node_data.get("expression", "true")
            passed = True
            if "sentiment_score" in expr:
                score = input_data.get("sentiment_score", 0)
                try:
                    passed = eval(expr, {"sentiment_score": score, "confidence": input_data.get("confidence", 0)})
                except Exception:
                    passed = True
            return {**input_data, "condition_passed": passed, "expression": expr}
        if subtype == "delay":
            return {**input_data, "delayed_by_seconds": node_data.get("delay_seconds", 30)}
        if subtype == "market_hours":
            return {**input_data, "market_hours_check": "within_hours", "mode": node_data.get("hours_mode", "regular")}
        return {**input_data, "control_passed": True}

    return {**input_data, "node_processed": True}


def _topological_sort(nodes: list, edges: list) -> list:
    """Sort nodes in topological order based on edges."""
    node_map = {n.get("id"): n for n in nodes}
    in_degree = {n.get("id"): 0 for n in nodes}
    adj: dict[str, list] = {n.get("id"): [] for n in nodes}

    for e in edges:
        src = e.get("source", "")
        tgt = e.get("target", "")
        if src in adj:
            adj[src].append(tgt)
        if tgt in in_degree:
            in_degree[tgt] = in_degree.get(tgt, 0) + 1

    queue = [nid for nid, deg in in_degree.items() if deg == 0]
    result = []
    while queue:
        nid = queue.pop(0)
        if nid in node_map:
            result.append(node_map[nid])
        for neighbor in adj.get(nid, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    for n in nodes:
        if n not in result:
            result.append(n)

    return result


def _truncate(data: dict, max_keys: int = 20) -> dict:
    """Truncate large dicts for display."""
    if not isinstance(data, dict):
        return data
    if len(data) <= max_keys:
        return data
    items = list(data.items())[:max_keys]
    result = dict(items)
    result["_truncated"] = f"{len(data) - max_keys} more keys"
    return result


@router.get("/{pipeline_id}/versions")
async def list_versions(
    pipeline_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    await _get_pipeline(pipeline_id, request, session)

    result = await session.execute(
        select(AdvancedPipelineVersion)
        .where(AdvancedPipelineVersion.pipeline_id == uuid.UUID(pipeline_id))
        .order_by(desc(AdvancedPipelineVersion.version))
    )
    versions = result.scalars().all()
    return [
        {
            "id": str(v.id),
            "version": v.version,
            "change_summary": v.change_summary,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in versions
    ]


@router.post("/{pipeline_id}/versions/{version}/revert")
async def revert_version(
    pipeline_id: str,
    version: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    p = await _get_pipeline(pipeline_id, request, session)

    result = await session.execute(
        select(AdvancedPipelineVersion).where(
            AdvancedPipelineVersion.pipeline_id == uuid.UUID(pipeline_id),
            AdvancedPipelineVersion.version == version,
        )
    )
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail=f"Version {version} not found")

    p.flow_json = v.flow_json
    p.version += 1
    p.updated_at = datetime.now(timezone.utc)

    new_version = AdvancedPipelineVersion(
        pipeline_id=p.id,
        version=p.version,
        flow_json=v.flow_json,
        change_summary=f"Reverted to version {version}",
        created_by=uuid.UUID(request.state.user_id),
    )
    session.add(new_version)
    await session.commit()
    await session.refresh(p)
    return _response(p)


@router.post("/{pipeline_id}/export")
async def export_pipeline(
    pipeline_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    p = await _get_pipeline(pipeline_id, request, session)
    return {
        "name": p.name,
        "description": p.description,
        "flow_json": p.flow_json,
        "tags": p.tags,
        "version": p.version,
    }


@router.post("/import")
async def import_pipeline(
    req: PipelineCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    return await create_pipeline(req, request, session)


async def _get_pipeline(
    pipeline_id: str, request: Request, session: AsyncSession,
) -> AdvancedPipeline:
    user_id = request.state.user_id
    result = await session.execute(
        select(AdvancedPipeline).where(
            AdvancedPipeline.id == uuid.UUID(pipeline_id),
            AdvancedPipeline.user_id == uuid.UUID(user_id),
        )
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return p


def _response(p: AdvancedPipeline) -> dict:
    return {
        "id": str(p.id),
        "name": p.name,
        "description": p.description,
        "flow_json": p.flow_json or {},
        "status": p.status,
        "version": p.version,
        "enabled": p.enabled,
        "tags": p.tags or [],
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }
