"""
Position monitoring agent — manages exits for trading agent positions.

M2.13: Monitoring agent capabilities.
Reference: PRD Section 8.
"""

import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class ExitReason:
    STOP_LOSS = "stop_loss"
    TRAILING_STOP = "trailing_stop"
    TAKE_PROFIT = "take_profit"
    EOD_SWEEP = "eod_sweep"
    EXIT_SIGNAL = "exit_signal"
    MANUAL = "manual"
    CIRCUIT_BREAKER = "circuit_breaker"


class PositionMonitor:
    """
    Monitors open positions and generates exit signals.
    Paired with each trading agent.
    """

    DEFAULT_STOP_LOSS_PCT = 0.20  # 20% max
    DEFAULT_TRAILING_STOP_PCT = 0.05  # 5% trailing
    DEFAULT_TAKE_PROFIT_PCT = 0.30  # 30% target
    EOD_CLOSE_MINUTES_BEFORE = 15  # Close 15 min before market end

    def __init__(self, config: dict[str, Any] | None = None):
        cfg = config or {}
        self.stop_loss_pct = cfg.get("stop_loss_pct", self.DEFAULT_STOP_LOSS_PCT)
        self.trailing_stop_pct = cfg.get("trailing_stop_pct", self.DEFAULT_TRAILING_STOP_PCT)
        self.take_profit_pct = cfg.get("take_profit_pct", self.DEFAULT_TAKE_PROFIT_PCT)
        self._high_watermarks: dict[str, float] = {}

    def evaluate_position(self, position: dict) -> dict[str, Any]:
        """Evaluate a position against all exit rules. Returns exit signal if triggered."""
        symbol = position.get("symbol", "")
        entry = position.get("entry_price", 0)
        current = position.get("current_price", 0)
        side = position.get("side", "long")

        if entry <= 0 or current <= 0:
            return {"exit": False}

        pnl_pct = (current - entry) / entry if side == "long" else (entry - current) / entry

        # Track high watermark for trailing stop
        pos_id = position.get("id", symbol)
        if pos_id not in self._high_watermarks:
            self._high_watermarks[pos_id] = current
        if current > self._high_watermarks[pos_id]:
            self._high_watermarks[pos_id] = current

        # Stop loss
        if pnl_pct <= -self.stop_loss_pct:
            return {"exit": True, "reason": ExitReason.STOP_LOSS, "pnl_pct": round(pnl_pct, 4)}

        # Take profit
        if pnl_pct >= self.take_profit_pct:
            return {"exit": True, "reason": ExitReason.TAKE_PROFIT, "pnl_pct": round(pnl_pct, 4)}

        # Trailing stop
        high = self._high_watermarks[pos_id]
        if high > entry and pnl_pct > 0:
            drawdown_from_high = (high - current) / high
            if drawdown_from_high >= self.trailing_stop_pct:
                return {"exit": True, "reason": ExitReason.TRAILING_STOP, "pnl_pct": round(pnl_pct, 4)}

        return {"exit": False, "pnl_pct": round(pnl_pct, 4)}

    def check_eod_sweep(self, market_close_minutes_remaining: int) -> bool:
        """Should we sweep all positions due to end of day?"""
        return market_close_minutes_remaining <= self.EOD_CLOSE_MINUTES_BEFORE
