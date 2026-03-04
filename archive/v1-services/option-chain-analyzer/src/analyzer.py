import logging
from dataclasses import dataclass

from shared.unusual_whales.client import UnusualWhalesClient
from shared.unusual_whales.models import OptionContract

logger = logging.getLogger(__name__)

WEIGHT_OI = 0.30
WEIGHT_DELTA = 0.20
WEIGHT_IV = 0.20
WEIGHT_SPREAD = 0.15
WEIGHT_GEX = 0.15


@dataclass
class ScoredContract:
    contract: OptionContract
    score: float
    rationale: str


def _score_contract(contract: OptionContract, direction: str, gex_level: float = 0) -> float:
    oi_score = min(contract.open_interest / 10000.0, 1.0) if contract.open_interest else 0

    target_delta = 0.45 if direction == "bullish" else -0.45
    delta_val = contract.delta or 0
    delta_fit = 1.0 - min(abs(delta_val - target_delta), 1.0)

    iv = contract.implied_volatility or 0
    iv_score = max(0, 1.0 - (iv / 2.0))

    bid = contract.bid or 0
    ask = contract.ask or 0
    spread_score = 1.0
    if ask > 0:
        spread_pct = (ask - bid) / ask
        spread_score = max(0, 1.0 - spread_pct * 2)

    gex_score = min(abs(gex_level) / 1e9, 1.0) if gex_level else 0.5

    total = (
        WEIGHT_OI * oi_score +
        WEIGHT_DELTA * delta_fit +
        WEIGHT_IV * iv_score +
        WEIGHT_SPREAD * spread_score +
        WEIGHT_GEX * gex_score
    )
    return round(total, 4)


async def analyze_option_chain(
    uw_client: UnusualWhalesClient,
    ticker: str,
    direction: str,
    max_results: int = 3,
) -> list[ScoredContract]:
    """Fetch option chain from Unusual Whales and score contracts."""
    try:
        chain = await uw_client.get_option_chain(ticker)
    except Exception:
        logger.exception("Failed to fetch option chain for %s", ticker)
        return []

    contracts = chain.contracts if chain else []
    if not contracts:
        logger.warning("No option contracts found for %s", ticker)
        return []

    opt_type = "call" if direction in ("bullish", "very_bullish") else "put"
    filtered = [c for c in contracts if c.option_type == opt_type]
    if not filtered:
        filtered = contracts

    gex_level = 0.0
    try:
        gex = await uw_client.get_gex(ticker)
        if gex:
            gex_level = gex.net_gex or 0
    except Exception:
        pass

    scored = []
    for c in filtered:
        s = _score_contract(c, direction, gex_level)
        rationale = (
            f"OI={c.open_interest}, delta={c.delta:.2f}, IV={c.implied_volatility:.1%}, "
            f"bid/ask={c.bid:.2f}/{c.ask:.2f}, score={s:.3f}"
        ) if c.delta and c.implied_volatility else f"score={s:.3f}"
        scored.append(ScoredContract(contract=c, score=s, rationale=rationale))

    scored.sort(key=lambda x: x.score, reverse=True)
    return scored[:max_results]
