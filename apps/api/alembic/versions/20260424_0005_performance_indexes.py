"""Add btree indexes for list queries."""

from alembic import op

revision = "20260424_0005"
down_revision = "20260420_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_chat_sessions_updated_at
        ON chat_sessions (updated_at DESC);
        """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_chat_messages_session_id_created_at
        ON chat_messages (session_id, created_at);
        """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_chat_messages_session_id_created_at;")
    op.execute("DROP INDEX IF EXISTS ix_chat_sessions_updated_at;")
