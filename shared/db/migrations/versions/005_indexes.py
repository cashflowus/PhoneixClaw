"""Add composite indexes for query performance.

Revision ID: 005
Revises: 004
Create Date: 2026-03-04
"""
from typing import Sequence, Union

from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_trade_intents_agent_status", "trade_intents", ["agent_id", "status"])
    op.create_index("ix_trade_intents_symbol_created", "trade_intents", ["symbol", "created_at"])
    op.create_index("ix_positions_agent_status", "positions", ["agent_id", "status"])
    op.create_index("ix_positions_symbol_created", "positions", ["symbol", "created_at"])
    op.create_index("ix_agents_instance_status", "agents", ["instance_id", "status"])
    op.create_index("ix_agents_user_created", "agents", ["user_id", "created_at"])
    op.create_index("ix_agent_logs_created", "agent_logs", ["created_at"])
    op.create_index("ix_audit_logs_user_created", "audit_logs", ["user_id", "created_at"])
    op.create_index("ix_tasks_created_by", "tasks", ["created_by"])
    op.create_index("ix_connectors_user", "connectors", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_connectors_user")
    op.drop_index("ix_tasks_created_by")
    op.drop_index("ix_audit_logs_user_created")
    op.drop_index("ix_agent_logs_created")
    op.drop_index("ix_agents_user_created")
    op.drop_index("ix_agents_instance_status")
    op.drop_index("ix_positions_symbol_created")
    op.drop_index("ix_positions_agent_status")
    op.drop_index("ix_trade_intents_symbol_created")
    op.drop_index("ix_trade_intents_agent_status")
