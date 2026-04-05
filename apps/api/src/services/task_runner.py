"""Task Runner — executes backtesting pipeline as local Python subprocesses.

Replaces the VPS-based agent_gateway. Instead of SSH-ing to remote machines
and shipping agent bundles, we run the backtesting tools directly on the API
server as background asyncio tasks.

Claude Code Cloud Tasks can also trigger backtesting by POSTing progress
callbacks to the /backtest-progress endpoint.
"""

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

from shared.db.engine import get_session as _get_session
from shared.db.models.agent import Agent, AgentBacktest
from shared.db.models.system_log import SystemLog

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[4]
BACKTESTING_TOOLS = REPO_ROOT / "agents" / "backtesting" / "tools"

_running_tasks: dict[str, asyncio.Task] = {}


async def run_backtest(
    agent_id: uuid.UUID,
    backtest_id: uuid.UUID,
    config: dict,
) -> None:
    """Run the full backtesting pipeline as sequential subprocess steps.

    Each step is a Python script in agents/backtesting/tools/. Progress is
    written to the DB so the dashboard can poll it. On completion, the agent
    status transitions to BACKTEST_COMPLETE.
    """
    task_key = str(agent_id)
    if task_key in _running_tasks and not _running_tasks[task_key].done():
        logger.warning("Backtest already running for agent %s", agent_id)
        return

    task = asyncio.create_task(_run_pipeline(agent_id, backtest_id, config))
    _running_tasks[task_key] = task


async def _run_pipeline(
    agent_id: uuid.UUID,
    backtest_id: uuid.UUID,
    config: dict,
) -> None:
    """Execute each pipeline step, updating DB progress along the way."""
    config_path = REPO_ROOT / "data" / f"backtest_{agent_id}.json"
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(config, indent=2, default=str))

    steps = [
        ("transform", "transform.py", 15),
        ("enrich", "enrich.py", 30),
        ("preprocess", "preprocess.py", 35),
        ("train_xgboost", "train_xgboost.py", 45),
        ("train_lightgbm", "train_lightgbm.py", 50),
        ("train_catboost", "train_catboost.py", 55),
        ("train_rf", "train_rf.py", 58),
        ("evaluate", "evaluate_models.py", 70),
        ("patterns", "discover_patterns.py", 80),
        ("explainability", "build_explainability.py", 85),
        ("create_live_agent", "create_live_agent.py", 95),
    ]

    async for session in _get_session():
        try:
            for step_name, script, pct in steps:
                script_path = BACKTESTING_TOOLS / script
                if not script_path.exists():
                    logger.warning("Step %s script not found: %s", step_name, script_path)
                    continue

                await _update_progress(session, agent_id, backtest_id, step_name, pct, f"Running {step_name}...")

                exit_code, stdout, stderr = await _run_script(script_path, config_path)

                if exit_code != 0:
                    error_msg = (stderr or stdout or "Unknown error")[:500]
                    logger.error("Step %s failed (exit %d): %s", step_name, exit_code, error_msg)
                    await _mark_failed(session, agent_id, backtest_id, step_name, error_msg)
                    return

                logger.info("Step %s completed for agent %s", step_name, agent_id)

            await _mark_completed(session, agent_id, backtest_id)

        except Exception as exc:
            logger.exception("Pipeline crashed for agent %s", agent_id)
            await _mark_failed(session, agent_id, backtest_id, "pipeline_error", str(exc)[:500])
        finally:
            config_path.unlink(missing_ok=True)
            _running_tasks.pop(str(agent_id), None)


async def _run_script(script_path: Path, config_path: Path) -> tuple[int, str, str]:
    """Run a Python script as an asyncio subprocess."""
    python = os.getenv("PYTHON_BIN", "python3")
    proc = await asyncio.create_subprocess_exec(
        python, str(script_path), str(config_path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(BACKTESTING_TOOLS.parent),
    )
    stdout_bytes, stderr_bytes = await proc.communicate()
    return (
        proc.returncode or 0,
        stdout_bytes.decode(errors="replace")[-2000:],
        stderr_bytes.decode(errors="replace")[-2000:],
    )


async def _update_progress(
    session, agent_id: uuid.UUID, backtest_id: uuid.UUID,
    step: str, pct: int, message: str,
) -> None:
    bt_result = await session.execute(select(AgentBacktest).where(AgentBacktest.id == backtest_id))
    bt = bt_result.scalar_one_or_none()
    if bt:
        bt.current_step = step
        bt.progress_pct = pct

    log = SystemLog(
        id=uuid.uuid4(), source="backtest", level="INFO", service="task-runner",
        agent_id=str(agent_id), backtest_id=str(backtest_id),
        message=message, step=step, progress_pct=pct,
    )
    session.add(log)
    await session.commit()


async def _mark_completed(session, agent_id: uuid.UUID, backtest_id: uuid.UUID) -> None:
    now = datetime.now(timezone.utc)

    bt_result = await session.execute(select(AgentBacktest).where(AgentBacktest.id == backtest_id))
    bt = bt_result.scalar_one_or_none()
    if bt:
        bt.status = "COMPLETED"
        bt.progress_pct = 100
        bt.current_step = "completed"
        bt.completed_at = now

    agent_result = await session.execute(select(Agent).where(Agent.id == agent_id))
    agent = agent_result.scalar_one_or_none()
    if agent:
        agent.status = "BACKTEST_COMPLETE"
        agent.updated_at = now

    log = SystemLog(
        id=uuid.uuid4(), source="backtest", level="INFO", service="task-runner",
        agent_id=str(agent_id), backtest_id=str(backtest_id),
        message="Backtesting pipeline completed successfully", step="completed", progress_pct=100,
    )
    session.add(log)
    await session.commit()
    logger.info("Backtest completed for agent %s", agent_id)


async def _mark_failed(
    session, agent_id: uuid.UUID, backtest_id: uuid.UUID,
    step: str, error_msg: str,
) -> None:
    now = datetime.now(timezone.utc)

    bt_result = await session.execute(select(AgentBacktest).where(AgentBacktest.id == backtest_id))
    bt = bt_result.scalar_one_or_none()
    if bt:
        bt.status = "FAILED"
        bt.error_message = error_msg
        bt.completed_at = now

    agent_result = await session.execute(select(Agent).where(Agent.id == agent_id))
    agent = agent_result.scalar_one_or_none()
    if agent:
        agent.status = "CREATED"
        agent.updated_at = now

    log = SystemLog(
        id=uuid.uuid4(), source="backtest", level="ERROR", service="task-runner",
        agent_id=str(agent_id), backtest_id=str(backtest_id),
        message=error_msg, step=step,
    )
    session.add(log)
    await session.commit()


def get_running_backtests() -> list[str]:
    """Return agent IDs with active backtest tasks."""
    return [k for k, t in _running_tasks.items() if not t.done()]


def cancel_backtest(agent_id: str) -> bool:
    """Cancel a running backtest task."""
    task = _running_tasks.get(agent_id)
    if task and not task.done():
        task.cancel()
        return True
    return False
