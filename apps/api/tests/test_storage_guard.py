from uuid import uuid4

import pytest

from app.services.storage_guard import StorageGuardService, StorageLimitExceededError


class FakeSessionRepository:
    def __init__(self, session_count: int) -> None:
        self.session_count = session_count

    async def count_sessions(self) -> int:
        return self.session_count


class FakeMessageRepository:
    def __init__(self, message_count: int, total_messages: int) -> None:
        self.message_count = message_count
        self.total_messages = total_messages

    async def count_by_session(self, session_id) -> int:
        return self.message_count

    async def count_all_messages(self) -> int:
        return self.total_messages


class FakeEmbeddingRepository:
    def __init__(self, chunk_count: int, embedding_count: int, database_bytes: int) -> None:
        self.chunk_count = chunk_count
        self.embedding_count = embedding_count
        self.database_bytes = database_bytes

    async def count_chunks(self) -> int:
        return self.chunk_count

    async def count_embedding_records(self) -> int:
        return self.embedding_count

    async def get_database_size_bytes(self) -> int:
        return self.database_bytes


class FakeImageAssetRepository:
    def __init__(self, image_count: int = 0, image_bytes: int = 0) -> None:
        self.image_count = image_count
        self.image_bytes = image_bytes

    async def count_by_session(self, session_id) -> int:
        return self.image_count

    async def count_all_image_assets(self) -> int:
        return self.image_count

    async def sum_all_image_bytes(self) -> int:
        return self.image_bytes


def build_guard(
    *,
    session_count: int = 0,
    message_count: int = 0,
    total_messages: int = 0,
    chunk_count: int = 0,
    embedding_count: int = 0,
    database_bytes: int = 0,
) -> StorageGuardService:
    return StorageGuardService(
        session_repository=FakeSessionRepository(session_count),
        message_repository=FakeMessageRepository(message_count, total_messages),
        image_asset_repository=FakeImageAssetRepository(),
        embedding_repository=FakeEmbeddingRepository(chunk_count, embedding_count, database_bytes),
        max_sessions=2,
        max_messages_per_session=3,
        max_images_per_session=4,
        max_image_upload_bytes=10,
        max_document_chunks=4,
        max_embedding_records=5,
        max_database_bytes=100,
        warning_ratio=0.8,
    )


@pytest.mark.asyncio
async def test_guard_session_creation_rejects_when_limit_is_reached() -> None:
    guard = build_guard(session_count=2)

    with pytest.raises(StorageLimitExceededError, match="Session limit reached"):
        await guard.guard_session_creation()


@pytest.mark.asyncio
async def test_guard_message_creation_rejects_when_limit_is_reached() -> None:
    guard = build_guard(message_count=3)

    with pytest.raises(StorageLimitExceededError, match="Message limit reached"):
        await guard.guard_message_creation(session_id=uuid4())


@pytest.mark.asyncio
async def test_guard_database_size_rejects_when_limit_is_reached() -> None:
    guard = build_guard(database_bytes=100)

    with pytest.raises(StorageLimitExceededError, match="Database size limit reached"):
        await guard.guard_database_size()
