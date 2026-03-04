"""Add strategies table.

Revision ID: 006
Revises: 005
Create Date: 2026-03-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "strategies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("template_id", sa.String(100), nullable=False, index=True),
        sa.Column("symbol", sa.String(20), nullable=False, server_default="SPY"),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("config", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("legs", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("backtest_params", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("skills_required", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column(
            "agent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("agents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("status", sa.String(30), nullable=False, server_default="CREATED"),
        sa.Column("backtest_pnl", sa.Float, nullable=True),
        sa.Column("backtest_sharpe", sa.Float, nullable=True),
        sa.Column("win_rate", sa.Float, nullable=True),
        sa.Column("max_drawdown", sa.Float, nullable=True),
        sa.Column("total_trades", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_strategies_agent_id", "strategies", ["agent_id"])
    op.create_index("ix_strategies_user_id", "strategies", ["user_id"])
    op.create_index("ix_strategies_status", "strategies", ["status"])


def downgrade() -> None:
    op.drop_index("ix_strategies_status")
    op.drop_index("ix_strategies_user_id")
    op.drop_index("ix_strategies_agent_id")
    op.drop_table("strategies")
