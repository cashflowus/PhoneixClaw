"""
Performance metric calculations for backtest results.

M2.7: Backtest analytics.
"""

import math
from typing import Any


def calculate_sharpe(
    returns: list[float], risk_free_rate: float = 0.0, periods_per_year: int = 252
) -> float:
    """Annualized Sharpe ratio from a list of periodic returns."""
    if len(returns) < 2:
        return 0.0

    excess = [r - risk_free_rate / periods_per_year for r in returns]
    mean = sum(excess) / len(excess)
    variance = sum((r - mean) ** 2 for r in excess) / (len(excess) - 1)
    std = math.sqrt(variance) if variance > 0 else 0.0

    if std == 0.0:
        return 0.0
    return (mean / std) * math.sqrt(periods_per_year)


def calculate_max_drawdown(equity_curve: list[float]) -> float:
    """Maximum peak-to-trough drawdown as a positive fraction (0–1)."""
    if len(equity_curve) < 2:
        return 0.0

    peak = equity_curve[0]
    max_dd = 0.0
    for value in equity_curve:
        if value > peak:
            peak = value
        dd = (peak - value) / peak if peak > 0 else 0.0
        if dd > max_dd:
            max_dd = dd
    return max_dd


def calculate_win_rate(trades: list[dict[str, Any]]) -> float:
    """Fraction of trades with positive PnL."""
    if not trades:
        return 0.0
    wins = sum(1 for t in trades if t.get("pnl", 0) > 0)
    return wins / len(trades)


def calculate_profit_factor(trades: list[dict[str, Any]]) -> float:
    """Ratio of gross profits to gross losses. Returns inf if no losses."""
    gross_profit = sum(t["pnl"] for t in trades if t.get("pnl", 0) > 0)
    gross_loss = abs(sum(t["pnl"] for t in trades if t.get("pnl", 0) < 0))

    if gross_loss == 0:
        return float("inf") if gross_profit > 0 else 0.0
    return gross_profit / gross_loss


def generate_report(metrics: dict[str, Any]) -> dict[str, Any]:
    """Build a human-readable summary from computed metrics."""
    return {
        "summary": {
            "sharpe_ratio": round(metrics.get("sharpe_ratio", 0.0), 3),
            "max_drawdown_pct": round(metrics.get("max_drawdown", 0.0) * 100, 2),
            "win_rate_pct": round(metrics.get("win_rate", 0.0) * 100, 2),
            "profit_factor": round(metrics.get("profit_factor", 0.0), 3),
            "total_return_pct": round(metrics.get("total_return", 0.0) * 100, 2),
            "total_trades": metrics.get("total_trades", 0),
        },
        "grade": _grade(metrics),
    }


def _grade(metrics: dict[str, Any]) -> str:
    sharpe = metrics.get("sharpe_ratio", 0)
    dd = metrics.get("max_drawdown", 1)
    wr = metrics.get("win_rate", 0)

    score = 0
    if sharpe > 1.5:
        score += 3
    elif sharpe > 0.8:
        score += 2
    elif sharpe > 0:
        score += 1

    if dd < 0.1:
        score += 3
    elif dd < 0.2:
        score += 2
    elif dd < 0.35:
        score += 1

    if wr > 0.55:
        score += 2
    elif wr > 0.45:
        score += 1

    grades = {8: "A+", 7: "A", 6: "B+", 5: "B", 4: "C+", 3: "C"}
    for threshold, grade in grades.items():
        if score >= threshold:
            return grade
    return "D"
