import uuid
from collections.abc import Sequence

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.types import serialize_vector
from app.models import DocumentChunk, EmbeddingRecord


class EmbeddingRepository:
    def __init__(self, db_session: AsyncSession) -> None:
        self.db_session = db_session

    async def create_chunk(
        self,
        *,
        source_type: str,
        source_uri: str | None,
        content: str,
        metadata: dict | None = None,
    ) -> DocumentChunk:
        chunk = DocumentChunk(
            source_type=source_type,
            source_uri=source_uri,
            content=content,
            chunk_metadata=metadata or {},
        )
        self.db_session.add(chunk)
        await self.db_session.flush()
        await self.db_session.refresh(chunk)
        return chunk

    async def create_embedding_record(
        self,
        *,
        chunk_id: uuid.UUID,
        embedding: Sequence[float],
        embedding_model: str | None,
        metadata: dict | None = None,
    ) -> EmbeddingRecord:
        record = EmbeddingRecord(
            chunk_id=chunk_id,
            embedding=list(embedding),
            embedding_dimensions=len(embedding),
            embedding_model=embedding_model,
            embedding_metadata=metadata or {},
        )
        self.db_session.add(record)
        await self.db_session.flush()
        await self.db_session.refresh(record)
        return record

    async def search_similar(
        self,
        *,
        query_embedding: Sequence[float],
        limit: int,
    ) -> list[dict]:
        statement = text("""
            SELECT
              er.id AS embedding_record_id,
              dc.id AS chunk_id,
              dc.content AS content,
              dc.source_type AS source_type,
              dc.source_uri AS source_uri,
              er.embedding <=> CAST(:query_embedding AS vector) AS distance
            FROM embedding_records er
            JOIN document_chunks dc ON dc.id = er.chunk_id
            WHERE er.embedding_dimensions = :embedding_dimensions
            ORDER BY er.embedding <=> CAST(:query_embedding AS vector)
            LIMIT :limit
            """)
        result = await self.db_session.execute(
            statement,
            {
                "query_embedding": serialize_vector(query_embedding),
                "embedding_dimensions": len(query_embedding),
                "limit": limit,
            },
        )
        return [dict(row._mapping) for row in result]

    async def count_chunks(self) -> int:
        statement = select(func.count()).select_from(DocumentChunk)
        result = await self.db_session.execute(statement)
        return int(result.scalar_one())

    async def count_embedding_records(self) -> int:
        statement = select(func.count()).select_from(EmbeddingRecord)
        result = await self.db_session.execute(statement)
        return int(result.scalar_one())

    async def get_database_size_bytes(self) -> int:
        statement = text("SELECT pg_database_size(current_database())")
        result = await self.db_session.execute(statement)
        return int(result.scalar_one())
