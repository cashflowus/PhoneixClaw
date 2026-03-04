"""
Skill version management — tracks version history in a local JSON store.

M2.9: Skill versioning.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_STORE_PATH = "data/skill_versions.json"


class SkillVersionManager:
    """Tracks skill versions with bump/query operations backed by JSON file."""

    def __init__(self, store_path: str = DEFAULT_STORE_PATH):
        self._path = Path(store_path)
        self._data: dict[str, Any] = self._load()

    def _load(self) -> dict[str, Any]:
        if self._path.exists():
            try:
                return json.loads(self._path.read_text())
            except (json.JSONDecodeError, OSError):
                logger.warning("Corrupt version store, starting fresh")
        return {}

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(self._data, indent=2))

    def bump_version(self, skill_name: str) -> int:
        """Increment the version number for a skill and return the new version."""
        entry = self._data.setdefault(skill_name, {"version": 0, "history": []})
        entry["version"] += 1
        entry["history"].append({
            "version": entry["version"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        self._save()
        logger.info("Bumped %s to v%d", skill_name, entry["version"])
        return entry["version"]

    def get_version(self, skill_name: str) -> int:
        """Return the current version number, or 0 if untracked."""
        return self._data.get(skill_name, {}).get("version", 0)

    def get_history(self, skill_name: str) -> list[dict[str, Any]]:
        """Return the full version history for a skill."""
        return list(self._data.get(skill_name, {}).get("history", []))

    def list_skills(self) -> list[str]:
        return list(self._data.keys())
