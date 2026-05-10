"""Add conversation modes and orchestration audit tables.

Revision ID: 20260418_0003
Revises: 20260418_0002
Create Date: 2026-04-18 12:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260418_0003"
down_revision = "20260418_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chat_sessions",
        sa.Column(
            "conversation_mode",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'regular'"),
        ),
    )
    op.add_column(
        "chat_sessions",
        sa.Column("crew_template_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "chat_sessions",
        sa.Column(
            "scene_state_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.create_table(
        "orchestration_runs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("trigger_message_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("backend", sa.String(length=32), nullable=False),
        sa.Column("conversation_mode", sa.String(length=16), nullable=False),
        sa.Column("crew_template_id", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("TIMEZONE('utc', NOW())"),
        ),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["trigger_message_id"], ["chat_messages.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_orchestration_runs_session_id",
        "orchestration_runs",
        ["session_id"],
        unique=False,
    )
    op.create_index(
        "ix_orchestration_runs_trigger_message_id",
        "orchestration_runs",
        ["trigger_message_id"],
        unique=False,
    )

    op.create_table(
        "orchestration_steps",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("step_index", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("input_text", sa.Text(), nullable=True),
        sa.Column("output_text", sa.Text(), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("TIMEZONE('utc', NOW())"),
        ),
        sa.ForeignKeyConstraint(["run_id"], ["orchestration_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_orchestration_steps_run_id",
        "orchestration_steps",
        ["run_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_orchestration_steps_run_id", table_name="orchestration_steps")
    op.drop_table("orchestration_steps")
    op.drop_index("ix_orchestration_runs_trigger_message_id", table_name="orchestration_runs")
    op.drop_index("ix_orchestration_runs_session_id", table_name="orchestration_runs")
    op.drop_table("orchestration_runs")
    op.drop_column("chat_sessions", "scene_state_json")
    op.drop_column("chat_sessions", "crew_template_id")
    op.drop_column("chat_sessions", "conversation_mode")
