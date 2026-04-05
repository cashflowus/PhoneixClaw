"""
0DTE SPX API routes: gamma levels, volume, vanna/charm, trade plan.

Phoenix v3 — Live data from Unusual Whales API with caching.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter

from shared.unusual_whales.client import UnusualWhalesClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v2/zero-dte", tags=["zero-dte"])

_uw = UnusualWhalesClient()


@router.get("/gamma-levels")
async def get_gamma_levels():
    """GEX (Gamma Exposure) by strike for SPX."""
    gex = await _uw.get_gex("SPX")
    return {
        "ticker": gex.ticker,
        "total_gex": gex.total_gex,
        "call_gex": gex.call_gex,
        "put_gex": gex.put_gex,
        "zero_gamma_level": gex.zero_gamma_level,
        "gex_by_strike": gex.gex_by_strike or {},
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/moc-imbalance")
async def get_moc_imbalance():
    """MOC data (released 3:50 PM ET). Best-effort from flow data."""
    # MOC imbalance is not directly available from UW — provide market tide as proxy
    tide = await _uw.get_market_tide()
    net = (tide.call_premium or 0) - (tide.put_premium or 0)
    direction = "BUY" if net > 0 else "SELL" if net < 0 else "NEUTRAL"
    return {
        "direction": direction,
        "net_premium": net,
        "call_premium": tide.call_premium,
        "put_premium": tide.put_premium,
        "put_call_ratio": tide.put_call_ratio,
        "releaseTime": "15:50",
        "source": "market_tide_proxy",
    }


@router.get("/vanna-charm")
async def get_vanna_charm():
    """Vanna/Charm derived from SPX option chain Greeks."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    chain = await _uw.get_option_chain("SPX", expiration=today)

    if not chain.contracts:
        return {"vannaLevel": 0, "vannaDirection": "neutral", "charmBidActive": False, "strikes": []}

    # Aggregate vanna from delta*vega across near-ATM strikes
    strikes_data = []
    total_vanna = 0
    for c in chain.contracts:
        if c.delta is not None and c.vega is not None:
            vanna_est = abs(c.delta * c.vega)
            total_vanna += vanna_est if c.option_type == "CALL" else -vanna_est
            strikes_data.append({
                "strike": c.strike,
                "type": c.option_type,
                "delta": c.delta,
                "gamma": c.gamma,
                "vega": c.vega,
                "vanna_est": round(vanna_est, 4),
                "volume": c.volume,
            })

    direction = "bullish" if total_vanna > 0 else "bearish" if total_vanna < 0 else "neutral"
    return {
        "vannaLevel": round(total_vanna, 2),
        "vannaDirection": direction,
        "charmBidActive": total_vanna > 0,
        "strikes": strikes_data[:20],  # top 20 by relevance
    }


@router.get("/volume")
async def get_volume():
    """0DTE volume breakdown from options flow."""
    flows = await _uw.get_options_flow("SPX", limit=100)

    call_vol = sum(f.volume for f in flows if f.option_type == "CALL")
    put_vol = sum(f.volume for f in flows if f.option_type == "PUT")
    ratio = round(put_vol / call_vol, 2) if call_vol > 0 else 0

    # Volume by strike
    strike_map: dict[float, dict] = {}
    for f in flows:
        key = f.strike
        if key not in strike_map:
            strike_map[key] = {"strike": key, "call_volume": 0, "put_volume": 0}
        if f.option_type == "CALL":
            strike_map[key]["call_volume"] += f.volume
        else:
            strike_map[key]["put_volume"] += f.volume

    volume_by_strike = sorted(strike_map.values(), key=lambda x: x["call_volume"] + x["put_volume"], reverse=True)[:15]

    # Largest trades
    largest = sorted(flows, key=lambda f: f.premium or 0, reverse=True)[:10]
    largest_trades = [{
        "ticker": f.ticker, "strike": f.strike, "type": f.option_type,
        "volume": f.volume, "premium": f.premium, "sentiment": f.sentiment,
    } for f in largest]

    gamma_squeeze = ratio < 0.5 and call_vol > 100000

    return {
        "callVolume": call_vol,
        "putVolume": put_vol,
        "ratio": ratio,
        "volumeByStrike": volume_by_strike,
        "largestTrades": largest_trades,
        "gammaSqueezeSignal": gamma_squeeze,
    }


@router.get("/trade-plan")
async def get_trade_plan():
    """Composite 0DTE trade plan from GEX + volume + flow signals."""
    gex = await _uw.get_gex("SPX")
    tide = await _uw.get_market_tide()
    flows = await _uw.get_options_flow("SPX", limit=50)

    signals = []

    # GEX signal
    if gex.total_gex is not None:
        gex_direction = "bullish" if gex.total_gex > 0 else "bearish"
        signals.append({"source": "GEX", "signal": gex_direction, "value": gex.total_gex})

    # Tide signal
    if tide.put_call_ratio is not None:
        if tide.put_call_ratio > 1.2:
            signals.append({"source": "Put/Call Ratio", "signal": "bearish (high put demand)", "value": tide.put_call_ratio})
        elif tide.put_call_ratio < 0.8:
            signals.append({"source": "Put/Call Ratio", "signal": "bullish (high call demand)", "value": tide.put_call_ratio})

    # Flow signal
    bullish_flows = sum(1 for f in flows if f.sentiment and f.sentiment.upper() == "BULLISH")
    bearish_flows = sum(1 for f in flows if f.sentiment and f.sentiment.upper() == "BEARISH")
    if bullish_flows > bearish_flows * 1.5:
        signals.append({"source": "Flow", "signal": "bullish", "value": f"{bullish_flows}B/{bearish_flows}Be"})
    elif bearish_flows > bullish_flows * 1.5:
        signals.append({"source": "Flow", "signal": "bearish", "value": f"{bullish_flows}B/{bearish_flows}Be"})

    bull_count = sum(1 for s in signals if "bullish" in s["signal"])
    bear_count = sum(1 for s in signals if "bearish" in s["signal"])
    direction = "LONG" if bull_count > bear_count else "SHORT" if bear_count > bull_count else "NEUTRAL"

    return {
        "direction": direction,
        "instrument": "SPX",
        "zero_gamma": gex.zero_gamma_level,
        "signals": signals,
        "signal_count": {"bullish": bull_count, "bearish": bear_count},
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
