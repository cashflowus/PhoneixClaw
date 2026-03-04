"""
Performance API routes: portfolio, accounts, agents, sources, instruments, risk.

M2.14: Performance analytics and dashboards.
"""

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/v2/performance", tags=["performance"])


@router.get("/portfolio")
async def get_portfolio_performance(
    period: str = Query("7d", pattern="^(1d|7d|30d|90d)$"),
):
    """Return portfolio-level performance metrics."""
    return {
        "total_value": 125000.0,
        "total_pnl": 3250.0,
        "total_pnl_pct": 2.67,
        "period": period,
        "equity_curve": [120000, 121500, 122000, 123500, 124000, 124500, 125000],
        "timestamps": ["2025-02-24", "2025-02-25", "2025-02-26", "2025-02-27", "2025-02-28", "2025-03-01", "2025-03-02"],
    }


@router.get("/accounts")
async def get_accounts_performance(
    limit: int = Query(20, ge=1, le=100),
):
    """Return per-account performance metrics."""
    return {
        "accounts": [
            {"id": "acc-1", "name": "IBKR Main", "pnl": 2100.0, "pnl_pct": 2.1, "trades_count": 45},
            {"id": "acc-2", "name": "Alpaca Paper", "pnl": 1150.0, "pnl_pct": 1.15, "trades_count": 28},
        ]
    }


@router.get("/agents")
async def get_agents_performance(
    limit: int = Query(20, ge=1, le=100),
):
    """Return per-agent performance metrics."""
    return {
        "agents": [
            {"id": "agent-1", "name": "TradingAgent-1", "pnl": 1800.0, "win_rate": 0.62, "trades_count": 35},
            {"id": "agent-2", "name": "TradingAgent-2", "pnl": 950.0, "win_rate": 0.58, "trades_count": 22},
            {"id": "agent-3", "name": "RiskAgent", "pnl": 500.0, "win_rate": 0.55, "trades_count": 16},
        ]
    }


@router.get("/sources")
async def get_sources_performance(
    limit: int = Query(20, ge=1, le=100),
):
    """Return performance by data/strategy source."""
    return {
        "sources": [
            {"id": "strat-1", "name": "Momentum", "pnl": 2200.0, "trades_count": 42},
            {"id": "strat-2", "name": "MeanReversion", "pnl": 1050.0, "trades_count": 31},
        ]
    }


@router.get("/instruments")
async def get_instruments_performance(
    limit: int = Query(20, ge=1, le=100),
):
    """Return performance by instrument/symbol."""
    return {
        "instruments": [
            {"symbol": "AAPL", "pnl": 850.0, "trades_count": 18},
            {"symbol": "SPY", "pnl": 1200.0, "trades_count": 25},
            {"symbol": "TSLA", "pnl": 650.0, "trades_count": 12},
        ]
    }


@router.get("/summary")
async def get_performance_summary():
    """Return aggregated performance summary across all accounts and agents."""
    return {
        "total_pnl": 3250.0,
        "total_pnl_pct": 2.67,
        "win_rate": 0.61,
        "sharpe_ratio": 1.82,
        "max_drawdown": -2.1,
        "max_drawdown_pct": -2.1,
        "total_trades": 73,
        "winning_trades": 45,
        "losing_trades": 28,
        "avg_trade_pnl": 44.52,
        "best_trade": 620.0,
        "worst_trade": -310.0,
        "profit_factor": 2.15,
    }


@router.get("/risk")
async def get_risk_metrics(
    period: str = Query("7d", pattern="^(1d|7d|30d)$"),
):
    """Return risk metrics (VaR, drawdown, exposure)."""
    return {
        "var_95": -1250.0,
        "var_99": -2100.0,
        "max_drawdown": -2.1,
        "max_drawdown_pct": -2.1,
        "exposure_pct": 45.0,
        "period": period,
    }
