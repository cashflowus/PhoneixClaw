"""
Reinforcement Learning engine for agent parameter optimization.

M3.2: RL feedback loop.
Reference: PRD Section 9.
"""

import json
import logging
import random
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class RLState:
    """Represents the observable state of an agent."""
    def __init__(self, win_rate: float, sharpe: float, drawdown: float, error_rate: float):
        self.win_rate = round(win_rate, 2)
        self.sharpe = round(sharpe, 1)
        self.drawdown = round(drawdown, 2)
        self.error_rate = round(error_rate, 2)

    def to_key(self) -> str:
        return f"wr{self.win_rate}_sh{self.sharpe}_dd{self.drawdown}_er{self.error_rate}"


class RLAction:
    """Possible actions the Dev Agent can take."""
    INCREASE_STOP_LOSS = "increase_stop_loss"
    DECREASE_STOP_LOSS = "decrease_stop_loss"
    ADJUST_POSITION_SIZE = "adjust_position_size"
    ADD_FILTER = "add_filter"
    REMOVE_FILTER = "remove_filter"
    PAUSE_AGENT = "pause_agent"
    RESTART_AGENT = "restart_agent"
    NO_ACTION = "no_action"

    ALL = [INCREASE_STOP_LOSS, DECREASE_STOP_LOSS, ADJUST_POSITION_SIZE,
           ADD_FILTER, REMOVE_FILTER, PAUSE_AGENT, RESTART_AGENT, NO_ACTION]


class QLearningEngine:
    """
    Q-learning based RL engine for optimizing agent trading parameters.
    Uses epsilon-greedy exploration with decaying epsilon.
    """

    def __init__(self, alpha: float = 0.1, gamma: float = 0.95, epsilon: float = 0.3):
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon
        self.epsilon_decay = 0.995
        self.epsilon_min = 0.05
        self.q_table: dict[str, dict[str, float]] = defaultdict(lambda: {a: 0.0 for a in RLAction.ALL})
        self._episode_count = 0
        self._total_reward = 0.0
        self._history: list[dict] = []

    def choose_action(self, state: RLState) -> str:
        """Epsilon-greedy action selection."""
        if random.random() < self.epsilon:
            return random.choice(RLAction.ALL)
        state_key = state.to_key()
        q_values = self.q_table[state_key]
        return max(q_values, key=q_values.get)

    def update(self, state: RLState, action: str, reward: float, next_state: RLState) -> None:
        """Q-learning update rule: Q(s,a) = Q(s,a) + α[r + γ·max(Q(s',a')) - Q(s,a)]"""
        s = state.to_key()
        s_next = next_state.to_key()
        max_q_next = max(self.q_table[s_next].values())
        old_q = self.q_table[s][action]
        self.q_table[s][action] = old_q + self.alpha * (reward + self.gamma * max_q_next - old_q)

        self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)
        self._episode_count += 1
        self._total_reward += reward
        self._history.append({
            "episode": self._episode_count,
            "state": s,
            "action": action,
            "reward": reward,
            "new_q": round(self.q_table[s][action], 4),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    def calculate_reward(self, before: dict, after: dict) -> float:
        """Calculate reward based on performance change."""
        pnl_change = after.get("total_pnl", 0) - before.get("total_pnl", 0)
        win_rate_change = after.get("win_rate", 0) - before.get("win_rate", 0)
        error_penalty = -10 * after.get("error_count", 0)
        return pnl_change * 0.01 + win_rate_change * 100 + error_penalty

    def get_metrics(self) -> dict[str, Any]:
        return {
            "total_episodes": self._episode_count,
            "avg_reward": round(self._total_reward / max(1, self._episode_count), 4),
            "q_table_size": len(self.q_table),
            "epsilon": round(self.epsilon, 4),
            "recent_history": self._history[-20:],
        }

    def save(self, path: str) -> None:
        """Persist Q-table to file."""
        with open(path, "w") as f:
            json.dump(dict(self.q_table), f, indent=2)

    def load(self, path: str) -> None:
        """Load Q-table from file."""
        with open(path) as f:
            data = json.load(f)
            for k, v in data.items():
                self.q_table[k] = v
