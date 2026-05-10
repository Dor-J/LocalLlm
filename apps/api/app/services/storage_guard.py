from __future__ import annotations

import logging
from dataclasses import dataclass
from time import monotonic

logger = logging.getLogger("app.storage")


class StorageLimitExceededError(ValueError):
    pass


@dataclass(slots=True)
class StorageUsageSnapshot:
    session_count: int
    message_count: int
    image_count: int
    image_bytes: int
    chunk_count: int
    embedding_count: int
    database_bytes: int


class StorageGuardService:
    def __init__(
        self,
        *,
        session_repository,
        message_repository,
        image_asset_repository,
        embedding_repository,
        max_sessions: int,
        max_messages_per_session: int,
        max_images_per_session: int,
        max_image_upload_bytes: int,
        max_document_chunks: int,
        max_embedding_records: int,
        max_database_bytes: int,
        warning_ratio: float,
        usage_log_min_interval_seconds: float = 60.0,
    ) -> None:
        self.session_repository = session_repository
        self.message_repository = message_repository
        self.image_asset_repository = image_asset_repository
        self.embedding_repository = embedding_repository
        self.max_sessions = max_sessions
        self.max_messages_per_session = max_messages_per_session
        self.max_images_per_session = max_images_per_session
        self.max_image_upload_bytes = max_image_upload_bytes
        self.max_document_chunks = max_document_chunks
        self.max_embedding_records = max_embedding_records
        self.max_database_bytes = max_database_bytes
        self.warning_ratio = warning_ratio
        self._usage_log_min_interval_seconds = usage_log_min_interval_seconds
        self._last_log_at: float = 0.0

    async def guard_session_creation(self) -> None:
        session_count = await self.session_repository.count_sessions()
        if session_count >= self.max_sessions:
            raise StorageLimitExceededError(
                f"Session limit reached ({self.max_sessions}). "
                "Delete older chats before creating more."
            )

    async def guard_message_creation(self, *, session_id) -> None:
        message_count = await self.message_repository.count_by_session(session_id)
        if message_count >= self.max_messages_per_session:
            raise StorageLimitExceededError(
                "Message limit reached for this chat session. "
                "Start a new chat or prune old messages."
            )

    async def guard_image_creation(self, *, session_id) -> None:
        image_count = await self.image_asset_repository.count_by_session(session_id)
        if image_count >= self.max_images_per_session:
            raise StorageLimitExceededError(
                "Image attachment limit reached for this chat session. "
                "Remove old uploads before adding more."
            )

    async def guard_image_upload(self, *, size_bytes: int) -> None:
        if size_bytes > self.max_image_upload_bytes:
            raise StorageLimitExceededError(
                f"Image upload limit reached ({self.max_image_upload_bytes} bytes)."
            )

    async def guard_embedding_creation(self) -> None:
        chunk_count = await self.embedding_repository.count_chunks()
        if chunk_count >= self.max_document_chunks:
            raise StorageLimitExceededError(
                f"Document chunk limit reached ({self.max_document_chunks})."
            )

        embedding_count = await self.embedding_repository.count_embedding_records()
        if embedding_count >= self.max_embedding_records:
            raise StorageLimitExceededError(
                f"Embedding record limit reached ({self.max_embedding_records})."
            )

    async def guard_database_size(self) -> None:
        database_bytes = await self.embedding_repository.get_database_size_bytes()
        if database_bytes >= self.max_database_bytes:
            raise StorageLimitExceededError(
                f"Database size limit reached ({self.max_database_bytes} bytes)."
            )

    async def log_usage(
        self, *, context: str, force: bool = False
    ) -> StorageUsageSnapshot | None:
        now = monotonic()
        if (
            not force
            and self._usage_log_min_interval_seconds > 0
            and (now - self._last_log_at) < self._usage_log_min_interval_seconds
        ):
            return None

        snapshot = StorageUsageSnapshot(
            session_count=await self.session_repository.count_sessions(),
            message_count=await self.message_repository.count_all_messages(),
            image_count=await self.image_asset_repository.count_all_image_assets(),
            image_bytes=await self.image_asset_repository.sum_all_image_bytes(),
            chunk_count=await self.embedding_repository.count_chunks(),
            embedding_count=await self.embedding_repository.count_embedding_records(),
            database_bytes=await self.embedding_repository.get_database_size_bytes(),
        )

        logger.info(
            "storage_usage",
            extra={
                "context": context,
                "sessions": snapshot.session_count,
                "messages": snapshot.message_count,
                "images": snapshot.image_count,
                "image_bytes": snapshot.image_bytes,
                "chunks": snapshot.chunk_count,
                "embeddings": snapshot.embedding_count,
                "database_bytes": snapshot.database_bytes,
            },
        )

        if self._is_warning(snapshot.session_count, self.max_sessions):
            logger.warning(
                "storage_warning metric=sessions value=%s limit=%s",
                snapshot.session_count,
                self.max_sessions,
            )
        if self._is_warning(snapshot.embedding_count, self.max_embedding_records):
            logger.warning(
                "storage_warning metric=embeddings value=%s limit=%s",
                snapshot.embedding_count,
                self.max_embedding_records,
            )
        if self._is_warning(snapshot.image_count, self.max_images_per_session):
            logger.warning(
                "storage_warning metric=images value=%s limit=%s",
                snapshot.image_count,
                self.max_images_per_session,
            )
        if self._is_warning(snapshot.database_bytes, self.max_database_bytes):
            logger.warning(
                "storage_warning metric=database_bytes value=%s limit=%s",
                snapshot.database_bytes,
                self.max_database_bytes,
            )

        self._last_log_at = now
        return snapshot

    def _is_warning(self, value: int, limit: int) -> bool:
        return limit > 0 and value >= int(limit * self.warning_ratio)
