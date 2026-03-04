"""
Tests for OpenClaw instance management and heartbeat ingestion. M1.8.
"""

import json
from pathlib import Path

import pytest


class TestAgentConfigs:
    """Verify that OpenClaw agent config templates exist and are well-formed."""

    CONFIGS_ROOT = Path(__file__).resolve().parents[3] / "openclaw" / "configs"

    def test_live_trader_configs_exist(self):
        agent_dir = self.CONFIGS_ROOT / "live-trading" / "live-trader-test"
        for fname in ["AGENTS.md", "TOOLS.md", "SOUL.md", "HEARTBEAT.md"]:
            fpath = agent_dir / fname
            assert fpath.exists(), f"Missing {fname} in live-trader-test"
            content = fpath.read_text(encoding="utf-8")
            assert len(content) > 50, f"{fname} is too short"

    def test_trade_monitor_configs_exist(self):
        agent_dir = self.CONFIGS_ROOT / "live-trading" / "trade-monitor-test"
        for fname in ["AGENTS.md", "TOOLS.md", "SOUL.md", "HEARTBEAT.md"]:
            fpath = agent_dir / fname
            assert fpath.exists(), f"Missing {fname} in trade-monitor-test"
            content = fpath.read_text(encoding="utf-8")
            assert len(content) > 50, f"{fname} is too short"

    def test_instance_d_config(self):
        config_path = self.CONFIGS_ROOT / "openclaw-instance-d.json"
        assert config_path.exists(), "Missing openclaw-instance-d.json"
        data = json.loads(config_path.read_text(encoding="utf-8"))
        assert data["role"] == "live-trading-ops"
        assert data["node_type"] == "vps"
        assert len(data["agents"]) >= 2

    def test_agent_config_references_skills(self):
        agent_md = (
            self.CONFIGS_ROOT / "live-trading" / "live-trader-test" / "AGENTS.md"
        ).read_text(encoding="utf-8")
        assert "signal-evaluator" in agent_md or "Skills" in agent_md

    def test_soul_has_risk_rules(self):
        soul_md = (
            self.CONFIGS_ROOT / "live-trading" / "live-trader-test" / "SOUL.md"
        ).read_text(encoding="utf-8")
        assert "20%" in soul_md, "Soul should mention 20% stop-loss rule"

    def test_heartbeat_has_interval(self):
        hb_md = (
            self.CONFIGS_ROOT / "live-trading" / "live-trader-test" / "HEARTBEAT.md"
        ).read_text(encoding="utf-8")
        assert "60" in hb_md or "Interval" in hb_md
