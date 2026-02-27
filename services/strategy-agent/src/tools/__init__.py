"""
Tool registry for the Strategy Agent.

Each tool is an async function that accepts a dict of params and returns a dict result.
Tools are registered via the TOOL_REGISTRY dict and described in TOOL_DESCRIPTIONS for the LLM.
"""

from __future__ import annotations

import logging
from typing import Callable, Awaitable

logger = logging.getLogger(__name__)

ToolFn = Callable[[dict], Awaitable[dict]]

TOOL_REGISTRY: dict[str, ToolFn] = {}

TOOL_DESCRIPTIONS: list[dict] = []


def register_tool(
    name: str,
    description: str,
    parameters: dict[str, str],
    *,
    requires_approval: bool = False,
):
    """Decorator to register a tool function."""
    def decorator(fn: ToolFn) -> ToolFn:
        TOOL_REGISTRY[name] = fn
        TOOL_DESCRIPTIONS.append({
            "name": name,
            "description": description,
            "parameters": parameters,
            "requires_approval": requires_approval,
        })
        return fn
    return decorator


async def execute_tool(name: str, params: dict) -> dict:
    """Execute a registered tool by name, returning the result or error."""
    fn = TOOL_REGISTRY.get(name)
    if not fn:
        return {"error": f"Unknown tool: {name}"}
    try:
        return await fn(params)
    except Exception as e:
        logger.exception("Tool %s failed", name)
        return {"error": str(e)}


def build_tool_descriptions_text() -> str:
    """Build a formatted text block of all tool descriptions for the system prompt."""
    lines = []
    for t in TOOL_DESCRIPTIONS:
        lines.append(f"TOOL: {t['name']}")
        lines.append(f"  Description: {t['description']}")
        params_str = ", ".join(f'"{k}": {v}' for k, v in t["parameters"].items())
        lines.append(f"  Parameters: {{{params_str}}}")
        if t.get("requires_approval"):
            lines.append("  ⚠ Requires user approval before execution")
        lines.append("")
    return "\n".join(lines)
