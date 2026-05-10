from collections.abc import Sequence

from app.repositories.embeddings import EmbeddingRepository
from app.services.embeddings.base import EmbeddingProvider
from app.services.storage_guard import StorageGuardService


class EmbeddingService:
    def __init__(
        self,
        *,
        embedding_repository: EmbeddingRepository,
        embedding_provider: EmbeddingProvider,
        storage_guard_service: StorageGuardService,
        db_session,
    ) -> None:
        self.embedding_repository = embedding_repository
        self.embedding_provider = embedding_provider
        self.storage_guard_service = storage_guard_service
        self.db_session = db_session

    async def index_content(
        self,
        *,
        content: str,
        source_type: str,
        source_uri: str | None,
        metadata: dict,
        embedding: Sequence[float] | None,
        embedding_model: str | None,
    ):
        if embedding is None:
            embedding = await self.embedding_provider.embed_text(content=content)

        await self.storage_guard_service.guard_database_size()
        await self.storage_guard_service.guard_embedding_creation()
        chunk = await self.embedding_repository.create_chunk(
            source_type=source_type,
            source_uri=source_uri,
            content=content,
            metadata=metadata,
        )
        record = await self.embedding_repository.create_embedding_record(
            chunk_id=chunk.id,
            embedding=embedding,
            embedding_model=embedding_model,
            metadata=metadata,
        )
        await self.db_session.flush()
        await self.db_session.refresh(chunk)
        await self.db_session.refresh(record)
        await self.storage_guard_service.log_usage(context="index_embedding")
        return chunk, record
