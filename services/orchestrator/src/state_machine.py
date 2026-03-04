"""
Agent lifecycle state machine — governs transitions from CREATED through LIVE.

M2.4: Agent lifecycle management.
Reference: PRD Section 5, ArchitecturePlan §3.

States: CREATED -> BACKTESTING -> BACKTEST_COMPLETE -> REVIEW_PENDING -> PAPER -> LIVE
Additional: PAUSED, ERROR, PAUSED_OFFLINE (hybrid nodes), STOPPED
"""

import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class AgentState(str, Enum):
    CREATED = "CREATED"
    BACKTESTING = "BACKTESTING"
    BACKTEST_COMPLETE = "BACKTEST_COMPLETE"
    REVIEW_PENDING = "REVIEW_PENDING"
    PAPER = "PAPER"
    LIVE = "LIVE"
    PAUSED = "PAUSED"
    PAUSED_OFFLINE = "PAUSED_OFFLINE"
    ERROR = "ERROR"
    STOPPED = "STOPPED"


# Valid transitions: from_state -> set of allowed to_states
TRANSITIONS: dict[AgentState, set[AgentState]] = {
    AgentState.CREATED: {AgentState.BACKTESTING, AgentState.STOPPED},
    AgentState.BACKTESTING: {AgentState.BACKTEST_COMPLETE, AgentState.ERROR, AgentState.STOPPED},
    AgentState.BACKTEST_COMPLETE: {AgentState.REVIEW_PENDING, AgentState.BACKTESTING, AgentState.STOPPED},
    AgentState.REVIEW_PENDING: {AgentState.PAPER, AgentState.BACKTESTING, AgentState.STOPPED},
    AgentState.PAPER: {AgentState.LIVE, AgentState.PAUSED, AgentState.STOPPED, AgentState.ERROR},
    AgentState.LIVE: {AgentState.PAUSED, AgentState.STOPPED, AgentState.ERROR},
    AgentState.PAUSED: {AgentState.PAPER, AgentState.LIVE, AgentState.STOPPED, AgentState.BACKTESTING},
    AgentState.PAUSED_OFFLINE: {AgentState.PAUSED, AgentState.PAPER, AgentState.LIVE, AgentState.STOPPED},
    AgentState.ERROR: {AgentState.CREATED, AgentState.STOPPED, AgentState.BACKTESTING},
    AgentState.STOPPED: {AgentState.CREATED},
}


REVIEW_GATE_CRITERIA = {
    "min_win_rate": 0.50,
    "min_sharpe_ratio": 1.0,
    "max_drawdown_pct": 20.0,
    "min_trades": 30,
}


class TransitionError(Exception):
    pass


class AgentStateMachine:
    """Manages agent state transitions with validation and audit logging."""

    def __init__(self, agent_id: str, current_state: str):
        self.agent_id = agent_id
        self.state = AgentState(current_state)
        self._history: list[dict[str, Any]] = []

    def can_transition(self, to_state: AgentState) -> bool:
        allowed = TRANSITIONS.get(self.state, set())
        return to_state in allowed

    def transition(self, to_state: str, reason: str = "", actor: str = "system") -> AgentState:
        target = AgentState(to_state)
        if not self.can_transition(target):
            raise TransitionError(
                f"Cannot transition from {self.state.value} to {target.value}. "
                f"Allowed: {[s.value for s in TRANSITIONS.get(self.state, set())]}"
            )

        old_state = self.state
        self.state = target
        entry = {
            "agent_id": self.agent_id,
            "from": old_state.value,
            "to": target.value,
            "reason": reason,
            "actor": actor,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self._history.append(entry)
        logger.info("Agent %s: %s -> %s (%s)", self.agent_id, old_state.value, target.value, reason)
        return self.state

    def check_review_gate(self, metrics: dict[str, Any]) -> dict[str, Any]:
        """Check if backtest metrics meet minimum criteria for review approval."""
        results = {}
        criteria = REVIEW_GATE_CRITERIA

        results["win_rate"] = {
            "passed": metrics.get("win_rate", 0) >= criteria["min_win_rate"],
            "value": metrics.get("win_rate", 0),
            "threshold": criteria["min_win_rate"],
        }
        results["sharpe_ratio"] = {
            "passed": metrics.get("sharpe_ratio", 0) >= criteria["min_sharpe_ratio"],
            "value": metrics.get("sharpe_ratio", 0),
            "threshold": criteria["min_sharpe_ratio"],
        }
        results["max_drawdown"] = {
            "passed": metrics.get("max_drawdown_pct", 100) <= criteria["max_drawdown_pct"],
            "value": metrics.get("max_drawdown_pct", 0),
            "threshold": criteria["max_drawdown_pct"],
        }
        results["min_trades"] = {
            "passed": metrics.get("total_trades", 0) >= criteria["min_trades"],
            "value": metrics.get("total_trades", 0),
            "threshold": criteria["min_trades"],
        }

        all_passed = all(r["passed"] for r in results.values())
        return {"approved": all_passed, "criteria": results}

    @property
    def history(self) -> list[dict]:
        return list(self._history)
