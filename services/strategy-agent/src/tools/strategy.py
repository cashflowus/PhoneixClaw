"""Strategy creation, modification, parsing, backtest, and deployment tools."""

from __future__ import annotations

import logging

from . import register_tool

logger = logging.getLogger(__name__)


@register_tool(
    name="create_strategy",
    description="Creates and saves a new trading strategy from a natural-language description",
    parameters={
        "name": "string",
        "strategy_text": "string (the strategy description / rules)",
        "ticker": "string (default: 'SPY')",
    },
)
async def create_strategy(params: dict) -> dict:
    return {
        "name": params.get("name", "Unnamed"),
        "strategy_text": params.get("strategy_text", ""),
        "ticker": params.get("ticker", "SPY"),
        "status": "created",
    }


@register_tool(
    name="parse_strategy",
    description="Parses a natural-language strategy into structured trading rules (entry, exit, risk, indicators)",
    parameters={"strategy_text": "string"},
)
async def parse_strategy_tool(params: dict) -> dict:
    from services.strategy_agent.src.parser import parse_strategy

    text = params.get("strategy_text", "")
    parsed = await parse_strategy(text)
    return {"parsed_config": parsed}


@register_tool(
    name="backtest",
    description="Runs a historical backtest on a strategy using real market data. Returns metrics, equity curve, and analysis.",
    parameters={
        "strategy_text": "string",
        "ticker": "string (default: 'SPY')",
        "period_years": "int (default: 2)",
    },
)
async def backtest_tool(params: dict) -> dict:
    from services.strategy_agent.src.backtest_engine import run_backtest
    from services.strategy_agent.src.benchmark_comparer import compare_with_benchmarks
    from services.strategy_agent.src.data_fetcher import fetch_historical_data
    from services.strategy_agent.src.parser import parse_strategy
    from services.strategy_agent.src.report_generator import generate_report

    strategy_text = params.get("strategy_text", "")
    ticker = params.get("ticker", "SPY")
    period_years = int(params.get("period_years", 2))

    config = await parse_strategy(strategy_text)
    ticker = config.get("ticker") or ticker
    data = await fetch_historical_data(ticker, period_years)

    if data.empty:
        return {"error": f"No historical data available for {ticker}"}

    result = run_backtest(data, config)
    benchmarks = await compare_with_benchmarks(result, ticker, period_years)
    report = await generate_report(strategy_text, config, result, benchmarks)

    return {
        "parsed_config": config,
        "ticker": ticker,
        "report": report,
    }


@register_tool(
    name="modify_strategy",
    description="Modifies an existing strategy with new rules or parameters",
    parameters={
        "strategy_id": "string",
        "modifications": "string (description of changes)",
        "new_text": "string (optional, full replacement text)",
    },
)
async def modify_strategy(params: dict) -> dict:
    return {
        "strategy_id": params.get("strategy_id", ""),
        "modifications_applied": params.get("modifications", ""),
        "new_text": params.get("new_text", ""),
        "status": "modified",
    }


@register_tool(
    name="deploy",
    description="Deploys a backtested strategy for live trading. This action requires user approval before execution.",
    parameters={"strategy_id": "string"},
    requires_approval=True,
)
async def deploy_strategy(params: dict) -> dict:
    strategy_id = params.get("strategy_id", "")
    return {
        "strategy_id": strategy_id,
        "status": "pending_approval",
        "message": "Strategy deployment requires your approval. Please confirm to proceed.",
    }
