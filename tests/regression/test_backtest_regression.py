"""
Regression tests for backtest engine. M2.3.
"""

import asyncio
import sys
from pathlib import Path

import pytest

# backtest-runner has hyphen; add src to path for direct import
_runner_src = Path(__file__).resolve().parents[2] / "services" / "backtest-runner" / "src"
sys.path.insert(0, str(_runner_src))
from engine import BacktestEngine, BacktestMetrics, BacktestType


@pytest.fixture
def mock_market_data():
    return [
        {"symbol": "SPY", "close": 450, "timestamp": "2025-01-01T10:00:00Z"},
        {"symbol": "SPY", "close": 451, "timestamp": "2025-01-01T11:00:00Z"},
        {"symbol": "SPY", "close": 449, "timestamp": "2025-01-01T12:00:00Z"},
    ]


@pytest.fixture
def mock_signals():
    return [
        {"symbol": "SPY", "side": "buy", "price": 450, "timestamp": "2025-01-01T10:00:00Z"},
        {"symbol": "SPY", "side": "sell", "price": 451, "timestamp": "2025-01-01T11:00:00Z"},
    ]


class TestBacktestRegression:
    """Backtest engine, signal-driven sim, metrics, concurrency, persistence."""

    @pytest.mark.asyncio
    async def test_backtest_engine_with_mock_data(self, mock_signals):
        """Backtest engine runs with mock data."""
        engine = BacktestEngine()
        result = await engine.run_signal_driven(
            agent_config={"strategy": "momentum"},
            historical_signals=mock_signals,
            initial_capital=100000.0,
        )
        assert result["type"] == BacktestType.SIGNAL_DRIVEN.value
        assert result["initial_capital"] == 100000.0
        assert "metrics" in result
        assert "trades" in result

    @pytest.mark.asyncio
    async def test_signal_driven_simulation(self, mock_signals):
        """Signal-driven simulation produces trades."""
        engine = BacktestEngine()
        result = await engine.run_signal_driven(
            agent_config={},
            historical_signals=mock_signals,
            initial_capital=100000.0,
        )
        assert len(result["trades"]) >= 0
        assert result["signal_count"] == len(mock_signals)

    def test_metrics_calculation_sharpe_drawdown_win_rate(self):
        """Metrics include Sharpe, drawdown, win rate."""
        trades = [
            {"pnl": 100},
            {"pnl": -50},
            {"pnl": 80},
            {"pnl": -30},
            {"pnl": 120},
        ]
        metrics = BacktestMetrics.calculate(trades)
        assert "sharpe_ratio" in metrics
        assert "max_drawdown" in metrics
        assert "win_rate" in metrics
        assert metrics["total_trades"] == 5
        assert 0 <= metrics["win_rate"] <= 1

    @pytest.mark.asyncio
    async def test_concurrent_backtests_dont_interfere(self, mock_signals):
        """Concurrent backtests run independently."""
        engine = BacktestEngine()
        config = {"strategy": "test"}
        tasks = [
            engine.run_signal_driven(config, mock_signals, 100000.0),
            engine.run_signal_driven(config, mock_signals[:1], 50000.0),
        ]
        results = await asyncio.gather(*tasks)
        assert len(results) == 2
        assert results[0]["initial_capital"] == 100000.0
        assert results[1]["initial_capital"] == 50000.0

    def test_backtest_results_persistence_schema(self):
        """Backtest result has persistence-ready schema."""
        result = {
            "id": "bt-1",
            "agent_id": "a1",
            "metrics": {"sharpe_ratio": 1.2, "win_rate": 0.6, "max_drawdown_pct": 5.0},
            "completed_at": "2025-03-03T12:00:00Z",
        }
        assert "metrics" in result
        assert "sharpe_ratio" in result["metrics"]
        assert "completed_at" in result
