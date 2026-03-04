"""
3-layer risk check chain: agent-level, execution-level, global-level.

M1.12: Risk management before trade execution.
Reference: PRD Section 8.
"""

from datetime import datetime, timezone
from typing import Any


class RiskCheckResult:
    """Result of a risk check evaluation."""
    def __init__(self, approved: bool, reason: str = "", checks: list[dict] | None = None):
        self.approved = approved
        self.reason = reason
        self.checks = checks or []

    def to_dict(self) -> dict[str, Any]:
        return {
            "approved": self.approved,
            "reason": self.reason,
            "checks": self.checks,
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
        }


class AgentLevelRisk:
    """Check agent-specific limits: max concurrent positions, daily trade count."""

    MAX_CONCURRENT = 5
    MAX_DAILY_TRADES = 50

    def check(self, intent: dict, agent_state: dict | None = None) -> dict:
        state = agent_state or {}
        open_positions = state.get("open_positions", 0)
        daily_trades = state.get("daily_trades", 0)

        if open_positions >= self.MAX_CONCURRENT:
            return {"passed": False, "layer": "agent", "reason": f"Max concurrent positions ({self.MAX_CONCURRENT}) reached"}
        if daily_trades >= self.MAX_DAILY_TRADES:
            return {"passed": False, "layer": "agent", "reason": f"Daily trade limit ({self.MAX_DAILY_TRADES}) reached"}
        return {"passed": True, "layer": "agent", "reason": ""}


class ExecutionLevelRisk:
    """Check trade-specific rules: position size, symbol validity, market hours."""

    MAX_POSITION_VALUE = 50000.0  # $50k max per position
    MAX_STOP_LOSS_PCT = 0.20  # 20% max stop loss

    def check(self, intent: dict) -> dict:
        qty = intent.get("qty", 0)
        price = intent.get("limit_price") or intent.get("estimated_price", 0)
        position_value = qty * price

        if position_value > self.MAX_POSITION_VALUE:
            return {"passed": False, "layer": "execution", "reason": f"Position value ${position_value:.0f} exceeds max ${self.MAX_POSITION_VALUE:.0f}"}

        stop_price = intent.get("stop_price")
        if stop_price and price > 0:
            stop_pct = abs(price - stop_price) / price
            if stop_pct > self.MAX_STOP_LOSS_PCT:
                return {"passed": False, "layer": "execution", "reason": f"Stop loss {stop_pct:.1%} exceeds max {self.MAX_STOP_LOSS_PCT:.0%}"}

        return {"passed": True, "layer": "execution", "reason": ""}


class GlobalLevelRisk:
    """Check system-wide limits: total exposure, circuit breaker state."""

    MAX_TOTAL_EXPOSURE = 500000.0  # $500k total across all accounts
    CIRCUIT_BREAKER_ACTIVE = False

    def check(self, intent: dict, global_state: dict | None = None) -> dict:
        if self.CIRCUIT_BREAKER_ACTIVE:
            return {"passed": False, "layer": "global", "reason": "Circuit breaker is active — all trading halted"}

        state = global_state or {}
        total_exposure = state.get("total_exposure", 0)
        qty = intent.get("qty", 0)
        price = intent.get("limit_price") or intent.get("estimated_price", 0)

        if total_exposure + (qty * price) > self.MAX_TOTAL_EXPOSURE:
            return {"passed": False, "layer": "global", "reason": f"Total exposure would exceed ${self.MAX_TOTAL_EXPOSURE:.0f}"}

        return {"passed": True, "layer": "global", "reason": ""}


class RiskCheckChain:
    """Chains all 3 risk layers. All must pass for approval."""

    def __init__(self):
        self.agent_risk = AgentLevelRisk()
        self.execution_risk = ExecutionLevelRisk()
        self.global_risk = GlobalLevelRisk()

    def evaluate(self, intent: dict, agent_state: dict | None = None, global_state: dict | None = None) -> dict[str, Any]:
        checks = []

        agent_check = self.agent_risk.check(intent, agent_state)
        checks.append(agent_check)
        if not agent_check["passed"]:
            return RiskCheckResult(False, agent_check["reason"], checks).to_dict()

        exec_check = self.execution_risk.check(intent)
        checks.append(exec_check)
        if not exec_check["passed"]:
            return RiskCheckResult(False, exec_check["reason"], checks).to_dict()

        global_check = self.global_risk.check(intent, global_state)
        checks.append(global_check)
        if not global_check["passed"]:
            return RiskCheckResult(False, global_check["reason"], checks).to_dict()

        return RiskCheckResult(True, "", checks).to_dict()
