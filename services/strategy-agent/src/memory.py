"""
Persistent conversation memory for the Strategy Agent.

Stores conversation summaries and key facts per user session,
enabling the agent to reference past strategies and conversations.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

MEMORY_DIR = os.getenv("AGENT_MEMORY_DIR", "/tmp/agent_memory")


class AgentMemory:
    """File-backed per-user memory store (OpenClaw-inspired local storage)."""

    def __init__(self, user_id: str):
        self.user_id = user_id
        self.memory_path = Path(MEMORY_DIR) / user_id
        self.memory_path.mkdir(parents=True, exist_ok=True)

    def _facts_file(self) -> Path:
        return self.memory_path / "facts.json"

    def _history_file(self) -> Path:
        return self.memory_path / "history.jsonl"

    def load_facts(self) -> dict:
        """Load persistent facts about this user's preferences and past work."""
        path = self._facts_file()
        if path.exists():
            try:
                return json.loads(path.read_text())
            except Exception:
                return {}
        return {}

    def save_facts(self, facts: dict):
        """Save/update persistent facts."""
        existing = self.load_facts()
        existing.update(facts)
        self._facts_file().write_text(json.dumps(existing, indent=2))

    def append_summary(self, summary: str, strategies_mentioned: list[str] | None = None):
        """Append a conversation summary to the history log."""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "summary": summary,
            "strategies_mentioned": strategies_mentioned or [],
        }
        with open(self._history_file(), "a") as f:
            f.write(json.dumps(entry) + "\n")

    def load_recent_summaries(self, limit: int = 5) -> list[dict]:
        """Load the N most recent conversation summaries."""
        path = self._history_file()
        if not path.exists():
            return []
        lines = path.read_text().strip().split("\n")
        summaries = []
        for line in lines[-limit:]:
            try:
                summaries.append(json.loads(line))
            except Exception:
                continue
        return summaries

    def build_context_block(self, strategies: list[dict] | None = None) -> str:
        """Build a memory context block to inject into the system prompt."""
        parts = []

        facts = self.load_facts()
        if facts:
            parts.append("USER PREFERENCES:")
            for k, v in facts.items():
                parts.append(f"  - {k}: {v}")

        summaries = self.load_recent_summaries(3)
        if summaries:
            parts.append("\nRECENT CONVERSATION HISTORY:")
            for s in summaries:
                ts = s.get("timestamp", "")[:10]
                parts.append(f"  [{ts}] {s['summary']}")
                if s.get("strategies_mentioned"):
                    parts.append(f"    Strategies: {', '.join(s['strategies_mentioned'])}")

        if strategies:
            parts.append("\nEXISTING STRATEGIES:")
            for s in strategies[:5]:
                parts.append(f"  - [{s.get('status', 'draft')}] {s.get('name', 'Unnamed')} (id: {s.get('id', '?')})")
                if s.get("text"):
                    parts.append(f"    {s['text'][:80]}")

        return "\n".join(parts) if parts else ""

    def extract_and_save_facts_from_conversation(self, messages: list[dict]):
        """Extract key facts from conversation to remember for next time."""
        facts = self.load_facts()

        for msg in messages:
            content = msg.get("content", "").lower()
            if msg.get("role") != "user":
                continue
            if any(w in content for w in ["i prefer", "i like", "i want", "always use"]):
                facts["last_preference_hint"] = msg["content"][:200]
            if any(w in content for w in ["risk", "conservative", "aggressive"]):
                if "conservative" in content:
                    facts["risk_preference"] = "conservative"
                elif "aggressive" in content:
                    facts["risk_preference"] = "aggressive"

        facts["last_interaction"] = datetime.now(timezone.utc).isoformat()
        self.save_facts(facts)
