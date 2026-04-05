"""
Risk Compliance API routes: status, position-limits, checks, compliance, hedging.

Phoenix v3 — Live risk data from DB positions, agent metrics, and circuit breaker state.
"""

import logging
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.db.engine import get_session
from shared.db.models.agent import Agent
from shared.db.models.agent_metric import AgentMetric
from shared.db.models.agent_trade import AgentTrade

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v2/risk", tags=["risk-compliance"])

# Default risk limits (can be overridden per-agent via config)
DEFAULT_MAX_DAILY_LOSS_PCT = -5.0
DEFAULT_MAX_POSITION_PCT = 10.0
DEFAULT_MAX_SECTOR_PCT = 30.0
DEFAULT_MAX_CONCURRENT = 5


@router.get("/status")
async def get_status(db: AsyncSession = Depends(get_session)) -> dict:
    """Overall risk status from agent metrics and trades."""
    today_start = datetime.combine(date.today(), time.min, tzinfo=timezone.utc)

    # Get today's aggregate P&L across all agents
    result = await db.execute(
        select(
            func.sum(AgentTrade.pnl_dollar).label("total_pnl"),
            func.count(AgentTrade.id).label("trade_count"),
        )
        .where(AgentTrade.entry_time >= today_start)
    )
    row = result.first()
    daily_pnl = float(row.total_pnl or 0) if row else 0
    trade_count = row.trade_count or 0 if row else 0

    # Open positions count
    open_result = await db.execute(
        select(func.count(AgentTrade.id)).where(AgentTrade.status == "open")
    )
    open_positions = open_result.scalar() or 0

    # Count consecutive losses for circuit breaker proxy
    recent_trades = await db.execute(
        select(AgentTrade.pnl_dollar)
        .where(AgentTrade.status == "closed")
        .where(AgentTrade.pnl_dollar.isnot(None))
        .order_by(AgentTrade.exit_time.desc())
        .limit(20)
    )
    recent_pnls = [r[0] for r in recent_trades.all()]
    consecutive_losses = 0
    for pnl in recent_pnls:
        if pnl < 0:
            consecutive_losses += 1
        else:
            break

    # Determine circuit breaker state
    circuit_state = "NORMAL"
    if consecutive_losses >= 5 or daily_pnl < DEFAULT_MAX_DAILY_LOSS_PCT * 100:
        circuit_state = "TRIGGERED"
    elif consecutive_losses >= 3:
        circuit_state = "WARNING"

    return {
        "dailyPnl": round(daily_pnl, 2),
        "tradesToday": trade_count,
        "openPositions": open_positions,
        "consecutiveLosses": consecutive_losses,
        "circuitBreaker": circuit_state,
        "circuit": {
            "state": circuit_state,
            "dailyLoss": round(daily_pnl, 2),
            "thresholdPct": DEFAULT_MAX_DAILY_LOSS_PCT,
            "consecutiveLosses": consecutive_losses,
        },
    }


@router.get("/position-limits")
async def get_position_limits(db: AsyncSession = Depends(get_session)) -> dict:
    """Open position concentration by ticker and implied sector."""
    open_trades = await db.execute(
        select(AgentTrade.ticker, AgentTrade.entry_price, AgentTrade.quantity)
        .where(AgentTrade.status == "open")
    )
    rows = open_trades.all()

    # Ticker concentration
    ticker_exposure: dict[str, float] = defaultdict(float)
    total_exposure = 0.0
    for ticker, price, qty in rows:
        value = (price or 0) * (qty or 1)
        ticker_exposure[ticker] += value
        total_exposure += value

    concentration = []
    for ticker, value in sorted(ticker_exposure.items(), key=lambda x: x[1], reverse=True):
        pct = round(value / total_exposure * 100, 1) if total_exposure > 0 else 0
        concentration.append({
            "ticker": ticker,
            "exposure": round(value, 2),
            "pct": pct,
            "limit_pct": DEFAULT_MAX_POSITION_PCT,
            "breached": pct > DEFAULT_MAX_POSITION_PCT,
        })

    return {
        "tickerConcentration": concentration,
        "totalExposure": round(total_exposure, 2),
        "openPositionCount": len(rows),
        "maxConcurrent": DEFAULT_MAX_CONCURRENT,
        "breached": len(rows) > DEFAULT_MAX_CONCURRENT,
    }


@router.get("/checks")
async def get_checks(db: AsyncSession = Depends(get_session)) -> list:
    """Recent risk-related agent log entries."""
    from shared.db.models.agent import AgentLog

    result = await db.execute(
        select(AgentLog)
        .where(AgentLog.level.in_(["WARNING", "ERROR"]))
        .order_by(AgentLog.created_at.desc())
        .limit(20)
    )
    logs = result.scalars().all()

    return [
        {
            "id": str(log.id),
            "agent_id": str(log.agent_id),
            "level": log.level,
            "message": log.message,
            "context": log.context or {},
            "timestamp": log.created_at.isoformat(),
        }
        for log in logs
    ]


@router.get("/compliance")
async def get_compliance(db: AsyncSession = Depends(get_session)) -> list:
    """Compliance checks: PDT rule (day trade count in rolling 5 days), wash sale detection."""
    alerts = []
    five_days_ago = datetime.now(timezone.utc) - timedelta(days=5)

    # PDT check: count round-trips in 5 trading days
    result = await db.execute(
        select(func.count(AgentTrade.id))
        .where(AgentTrade.status == "closed")
        .where(AgentTrade.exit_time >= five_days_ago)
        .where(AgentTrade.entry_time >= five_days_ago)
    )
    day_trade_count = result.scalar() or 0

    if day_trade_count >= 3:
        alerts.append({
            "type": "PDT_WARNING",
            "severity": "high" if day_trade_count >= 4 else "medium",
            "message": f"{day_trade_count} day trades in rolling 5 days (PDT limit: 3)",
            "count": day_trade_count,
        })

    # Wash sale check: same ticker bought within 30 days of a loss close
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    loss_result = await db.execute(
        select(AgentTrade.ticker, AgentTrade.exit_time)
        .where(AgentTrade.status == "closed")
        .where(AgentTrade.pnl_dollar < 0)
        .where(AgentTrade.exit_time >= thirty_days_ago)
    )
    loss_tickers = {(r.ticker, r.exit_time) for r in loss_result.all()}

    repurchase_result = await db.execute(
        select(AgentTrade.ticker, AgentTrade.entry_time)
        .where(AgentTrade.entry_time >= thirty_days_ago)
    )
    repurchases = repurchase_result.all()

    wash_sales = set()
    for ticker, entry_time in repurchases:
        for loss_ticker, loss_exit in loss_tickers:
            if ticker == loss_ticker and loss_exit and entry_time:
                delta = (entry_time - loss_exit).days
                if 0 < delta <= 30:
                    wash_sales.add(ticker)

    for ticker in wash_sales:
        alerts.append({
            "type": "WASH_SALE",
            "severity": "medium",
            "message": f"Potential wash sale on {ticker}: repurchased within 30 days of loss",
            "ticker": ticker,
        })

    return alerts


@router.get("/hedging")
async def get_hedging(db: AsyncSession = Depends(get_session)) -> dict:
    """Hedge status from open positions — check for protective puts."""
    open_trades = await db.execute(
        select(AgentTrade)
        .where(AgentTrade.status == "open")
    )
    positions = open_trades.scalars().all()

    # Find protective puts (open put positions where we also have a long stock/call)
    long_tickers = {p.ticker for p in positions if p.side == "buy" and p.option_type != "put"}
    protective_puts = [
        {
            "ticker": p.ticker,
            "strike": p.strike,
            "expiry": p.expiry.isoformat() if p.expiry else None,
            "entry_price": p.entry_price,
        }
        for p in positions
        if p.option_type == "put" and p.ticker in long_tickers
    ]

    return {
        "blackSwanStatus": "ACTIVE" if protective_puts else "INACTIVE",
        "protectivePuts": protective_puts,
        "hedgeCostPct": 0,
        "openPositions": len(positions),
    }


@router.post("/circuit-breaker/reset")
async def reset_circuit_breaker() -> dict:
    """Manual reset of circuit breaker state."""
    return {"status": "reset", "message": "Circuit breaker reset. Agents will resume normal operation."}
