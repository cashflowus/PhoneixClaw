"""
0DTE SPX API routes: gamma levels, MOC imbalance, vanna/charm, volume, trade plan, agent deploy, execute.

Phoenix v2 — EOD SPX/SPY 0DTE options trading.
"""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v2/zero-dte", tags=["zero-dte"])


class GammaLevel(BaseModel):
    strike: int
    gex: float
    type: str
    distance: int


class MocImbalance(BaseModel):
    direction: str
    amount: float
    historicalAvg: float
    predictedImpact: float
    tradeSignal: str
    releaseTime: str


class VannaCharmStrike(BaseModel):
    strike: int
    vanna: float
    charm: float


class VannaCharm(BaseModel):
    vannaLevel: float
    vannaDirection: str
    charmBidActive: bool
    strikes: list[VannaCharmStrike]


class VolumeByStrike(BaseModel):
    strike: int
    calls: int
    puts: int


class LargestTrade(BaseModel):
    strike: int
    type: str
    size: int
    premium: float


class Volume(BaseModel):
    callVolume: int
    putVolume: int
    ratio: float
    volumeByStrike: list[VolumeByStrike]
    largestTrades: list[LargestTrade]
    gammaSqueezeSignal: bool


class TradePlan(BaseModel):
    direction: str
    instrument: str
    strikes: str
    size: str
    entry: str
    stop: str
    target: str
    signals: list[str]


_MOCK_GAMMA = [
    {"strike": 5975, "gex": 1.2e9, "type": "Support", "distance": -12},
    {"strike": 5980, "gex": 0.8e9, "type": "Support", "distance": -7},
    {"strike": 5985, "gex": -0.3e9, "type": "Flip", "distance": -2},
    {"strike": 5990, "gex": -1.1e9, "type": "Wall", "distance": 3},
    {"strike": 5995, "gex": -0.9e9, "type": "Resistance", "distance": 8},
    {"strike": 6000, "gex": -0.5e9, "type": "Resistance", "distance": 13},
]
_MOCK_MOC = {
    "direction": "Sell",
    "amount": -847e6,
    "historicalAvg": -420e6,
    "predictedImpact": -0.12,
    "tradeSignal": "Bearish",
    "releaseTime": "15:50",
}
_MOCK_VANNA = {
    "vannaLevel": 0.42,
    "vannaDirection": "up",
    "charmBidActive": True,
    "strikes": [{"strike": 5975, "vanna": 0.12, "charm": -0.08}, {"strike": 5985, "vanna": 0.22, "charm": -0.15}],
}
_MOCK_VOLUME = {
    "callVolume": 680000,
    "putVolume": 520000,
    "ratio": 1.31,
    "volumeByStrike": [{"strike": 5975, "calls": 45, "puts": 32}, {"strike": 5985, "calls": 78, "puts": 55}],
    "largestTrades": [{"strike": 5985, "type": "Call", "size": 500, "premium": 2.4e6}],
    "gammaSqueezeSignal": False,
}
_MOCK_PLAN = {
    "direction": "SHORT",
    "instrument": "SPX",
    "strikes": "5990P / 5980P",
    "size": "2 contracts",
    "entry": "Market at 3:50",
    "stop": "5995",
    "target": "5970",
    "signals": ["GEX bearish", "MOC sell imbalance", "Charm bid active", "0DTE put flow"],
}


@router.get("/gamma-levels", response_model=list[GammaLevel])
async def get_gamma_levels() -> list[GammaLevel]:
    """GEX by strike."""
    return [GammaLevel(**g) for g in _MOCK_GAMMA]


@router.get("/moc-imbalance", response_model=MocImbalance)
async def get_moc_imbalance() -> MocImbalance:
    """MOC data (released 3:50 PM ET)."""
    return MocImbalance(**_MOCK_MOC)


@router.get("/vanna-charm", response_model=VannaCharm)
async def get_vanna_charm() -> VannaCharm:
    """Vanna/Charm data."""
    return VannaCharm(**_MOCK_VANNA)


@router.get("/volume", response_model=Volume)
async def get_volume() -> Volume:
    """0DTE volume breakdown."""
    return Volume(**_MOCK_VOLUME)


@router.get("/trade-plan", response_model=TradePlan)
async def get_trade_plan() -> TradePlan:
    """Composite EOD trade plan."""
    return TradePlan(**_MOCK_PLAN)


class AgentCreatePayload(BaseModel):
    instance_id: str


@router.post("/agent/create")
async def create_agent(payload: AgentCreatePayload) -> dict:
    """Deploy 0DTE agent to instance."""
    return {"status": "deployed", "instance_id": payload.instance_id}


class ExecutePayload(BaseModel):
    plan: dict[str, Any]


@router.post("/execute")
async def execute_plan(payload: ExecutePayload) -> dict:
    """Execute trade plan."""
    return {"status": "submitted", "plan": payload.plan}
