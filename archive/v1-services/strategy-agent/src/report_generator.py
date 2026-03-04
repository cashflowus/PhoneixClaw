import logging

from shared.llm.client import OllamaClient

logger = logging.getLogger(__name__)


async def generate_report(
    strategy_text: str,
    parsed_config: dict,
    backtest_result: dict,
    benchmarks: dict,
) -> dict:
    """Generate AI narrative and compile full report."""
    try:
        llm = OllamaClient()
        prompt = f"""Analyze these backtest results for a trading strategy:

Strategy: {strategy_text}

Results:
- Total Return: {backtest_result.get('total_return_pct', 0):.1f}%
- Sharpe Ratio: {backtest_result.get('sharpe_ratio', 0):.2f}
- Max Drawdown: {backtest_result.get('max_drawdown_pct', 0):.1f}%
- Win Rate: {backtest_result.get('win_rate', 0) * 100:.0f}%
- Number of Trades: {backtest_result.get('num_trades', 0)}
- Alpha vs SPY: {benchmarks.get('alpha', 0):.1f}%

Provide a concise 3-4 sentence analysis of the strategy's performance, risks, and potential improvements."""

        narrative = await llm.generate(
            prompt=prompt,
            system="You are a quantitative analyst. Be specific and data-driven.",
        )
    except Exception:
        logger.exception("AI narrative generation failed")
        ret = backtest_result.get("total_return_pct", 0)
        narrative = f"The strategy returned {ret:.1f}% with {backtest_result.get('num_trades', 0)} trades."

    pseudocode = _generate_pseudocode(parsed_config)

    return {
        "narrative": narrative,
        "pseudocode": pseudocode,
        "metrics": {
            "total_return_pct": backtest_result.get("total_return_pct", 0),
            "sharpe_ratio": backtest_result.get("sharpe_ratio", 0),
            "max_drawdown_pct": backtest_result.get("max_drawdown_pct", 0),
            "win_rate": backtest_result.get("win_rate", 0),
            "profit_factor": backtest_result.get("profit_factor", 0),
            "num_trades": backtest_result.get("num_trades", 0),
        },
        "equity_curve": backtest_result.get("equity_curve", []),
        "benchmarks": benchmarks,
        "trades": backtest_result.get("trades", []),
    }


def _generate_pseudocode(config: dict) -> str:
    lines = ["STRATEGY PSEUDOCODE", "=" * 40, ""]
    lines.append(f"Name: {config.get('name', 'Unnamed')}")
    lines.append(f"Direction: {config.get('direction', 'long')}")
    lines.append(f"Asset: {config.get('asset_type', 'equity')}")
    lines.append("")

    if config.get("entry_rules"):
        lines.append("ENTRY CONDITIONS:")
        for rule in config["entry_rules"]:
            lines.append(f"  IF {rule}")

    if config.get("exit_rules"):
        lines.append("")
        lines.append("EXIT CONDITIONS:")
        for rule in config["exit_rules"]:
            lines.append(f"  IF {rule}")

    if config.get("filters"):
        lines.append("")
        lines.append("FILTERS:")
        for f in config["filters"]:
            lines.append(f"  REQUIRE {f}")

    if config.get("time_constraints"):
        lines.append("")
        lines.append(f"TIME: {config['time_constraints']}")

    return "\n".join(lines)
