"""Add btree indexes for list queries and HNSW index for vector similarity search."""

from alembic import op

revision = "20260424_0005"
down_revision = "20260420_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_chat_sessions_updated_at
        ON chat_sessions (updated_at DESC);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_chat_messages_session_id_created_at
        ON chat_messages (session_id, created_at);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_embedding_records_embedding_hnsw
        ON embedding_records
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_embedding_records_embedding_hnsw;")
    op.execute("DROP INDEX IF EXISTS ix_chat_messages_session_id_created_at;")
    op.execute("DROP INDEX IF EXISTS ix_chat_sessions_updated_at;")
