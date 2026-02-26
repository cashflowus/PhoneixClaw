import logging

logger = logging.getLogger(__name__)


def suggest_strategy(
    ticker: str,
    direction: str,
    iv_percentile: float | None = None,
) -> list[dict]:
    """Suggest multi-leg option strategies based on IV environment."""
    suggestions = []

    if iv_percentile is None:
        iv_percentile = 50

    if direction in ("bullish", "very_bullish"):
        if iv_percentile > 70:
            suggestions.append({
                "strategy": "Bull Put Spread",
                "rationale": "High IV favors selling premium. Defined risk with credit collected.",
                "legs": ["Sell OTM Put", "Buy further OTM Put"],
            })
        else:
            suggestions.append({
                "strategy": "Long Call",
                "rationale": "Low IV makes calls relatively cheap. Unlimited upside potential.",
                "legs": ["Buy ATM or slight OTM Call"],
            })
            suggestions.append({
                "strategy": "Call Debit Spread",
                "rationale": "Reduces cost basis while maintaining bullish exposure.",
                "legs": ["Buy ATM Call", "Sell OTM Call"],
            })
    elif direction in ("bearish", "very_bearish"):
        if iv_percentile > 70:
            suggestions.append({
                "strategy": "Bear Call Spread",
                "rationale": "High IV favors selling premium with defined risk.",
                "legs": ["Sell OTM Call", "Buy further OTM Call"],
            })
        else:
            suggestions.append({
                "strategy": "Long Put",
                "rationale": "Low IV makes puts relatively cheap for downside protection.",
                "legs": ["Buy ATM or slight OTM Put"],
            })
    else:
        suggestions.append({
            "strategy": "Iron Condor",
            "rationale": "Neutral sentiment favors range-bound strategy collecting premium.",
            "legs": ["Sell OTM Call", "Buy further OTM Call", "Sell OTM Put", "Buy further OTM Put"],
        })

    logger.info("Suggested %d strategies for %s (%s, IV: %.0f%%)",
                len(suggestions), ticker, direction, iv_percentile)
    return suggestions
