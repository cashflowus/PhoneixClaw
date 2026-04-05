"""V3 architecture: remove VPS instance references, add worker fields.

Drops the claude_code_instances FK columns from agents and adds
worker_container_id / worker_status for Docker-managed trading workers.

Revision ID: 007
Revises: 006
Create Date: 2026-04-03
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("worker_container_id", sa.String(100), nullable=True))
    op.add_column("agents", sa.Column("worker_status", sa.String(30), nullable=False, server_default="STOPPED"))

    op.drop_constraint("agents_instance_id_fkey", "agents", type_="foreignkey")
    op.drop_constraint("agents_backtest_instance_id_fkey", "agents", type_="foreignkey")
    op.drop_constraint("agents_trading_instance_id_fkey", "agents", type_="foreignkey")
    op.drop_column("agents", "instance_id")
    op.drop_column("agents", "backtest_instance_id")
    op.drop_column("agents", "trading_instance_id")

    op.drop_table("claude_code_instances")


def downgrade() -> None:
    op.create_table(
        "claude_code_instances",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("host", sa.String(255), nullable=False),
        sa.Column("ssh_port", sa.Integer, nullable=False, server_default="22"),
        sa.Column("ssh_username", sa.String(100), nullable=False, server_default="root"),
        sa.Column("ssh_key_encrypted", sa.Text, nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="general"),
        sa.Column("status", sa.String(20), nullable=False, server_default="ONLINE"),
        sa.Column("node_type", sa.String(20), nullable=False, server_default="vps"),
        sa.Column("capabilities", sa.dialects.postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("claude_version", sa.String(50), nullable=True),
        sa.Column("agent_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_offline_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )

    op.add_column("agents", sa.Column("instance_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("agents", sa.Column("backtest_instance_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("agents", sa.Column("trading_instance_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))

    op.create_foreign_key("agents_instance_id_fkey", "agents", "claude_code_instances", ["instance_id"], ["id"])
    op.create_foreign_key("agents_backtest_instance_id_fkey", "agents", "claude_code_instances", ["backtest_instance_id"], ["id"])
    op.create_foreign_key("agents_trading_instance_id_fkey", "agents", "claude_code_instances", ["trading_instance_id"], ["id"])

    op.drop_column("agents", "worker_status")
    op.drop_column("agents", "worker_container_id")
