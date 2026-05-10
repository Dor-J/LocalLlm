from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.db.session import get_db_session
from app.repositories.chat_messages import ChatMessageRepository
from app.repositories.chat_sessions import ChatSessionRepository
from app.repositories.embeddings import EmbeddingRepository
from app.repositories.image_assets import ImageAssetRepository
from app.repositories.roleplay_templates import RoleplayTemplateRepository
from app.services.agent_orchestration.base import AgentOrchestrationService
from app.services.agent_orchestration.crewai import CrewAIOrchestrator
from app.services.agent_orchestration.experimental_composio import (
    ExperimentalComposioOrchestrator,
)
from app.services.agent_orchestration.noop import NoOpAgentOrchestrator
from app.services.chat_service import ChatService
from app.services.embeddings.base import NoOpEmbeddingProvider
from app.services.embeddings.embedding_service import EmbeddingService
from app.services.image_assets.image_asset_service import ImageAssetService
from app.services.llm.ollama_client import OllamaClient
from app.services.roleplay_templates import RoleplayTemplateService
from app.services.storage.minio_storage import MinioStorageService
from app.services.storage_guard import StorageGuardService
from app.services.vector_search.vector_search_service import VectorSearchService


def get_ollama_client(request: Request) -> OllamaClient:
    return request.app.state.ollama_client


def get_agent_orchestration_service(
    db_session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    llm_provider: OllamaClient = Depends(get_ollama_client),
) -> AgentOrchestrationService:
    if (
        settings.experimental_agent_orchestration_enabled
        and settings.agent_orchestrator_backend == "experimental-composio"
    ):
        return ExperimentalComposioOrchestrator()
    if settings.agent_orchestrator_backend == "crewai":
        return CrewAIOrchestrator(
            db_session=db_session,
            llm_provider=llm_provider,
        )
    return NoOpAgentOrchestrator()


def get_storage_guard_service(
    db_session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> StorageGuardService:
    return StorageGuardService(
        session_repository=ChatSessionRepository(db_session),
        message_repository=ChatMessageRepository(db_session),
        image_asset_repository=ImageAssetRepository(db_session),
        embedding_repository=EmbeddingRepository(db_session),
        max_sessions=settings.max_sessions,
        max_messages_per_session=settings.max_messages_per_session,
        max_images_per_session=settings.max_images_per_session,
        max_image_upload_bytes=settings.max_image_upload_bytes,
        max_document_chunks=settings.max_document_chunks,
        max_embedding_records=settings.max_embedding_records,
        max_database_bytes=settings.max_database_bytes,
        warning_ratio=settings.storage_warning_ratio,
        usage_log_min_interval_seconds=settings.storage_usage_log_min_interval_seconds,
    )


def get_minio_storage_service(settings: Settings = Depends(get_settings)) -> MinioStorageService:
    return MinioStorageService(
        endpoint=settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        bucket_name=settings.minio_bucket_name,
        secure=settings.minio_secure,
    )


def get_image_asset_service(
    db_session: AsyncSession = Depends(get_db_session),
    storage_guard_service: StorageGuardService = Depends(get_storage_guard_service),
    minio_storage_service: MinioStorageService = Depends(get_minio_storage_service),
) -> ImageAssetService:
    return ImageAssetService(
        image_asset_repository=ImageAssetRepository(db_session),
        storage_service=minio_storage_service,
        storage_guard_service=storage_guard_service,
        session_repository=ChatSessionRepository(db_session),
        db_session=db_session,
    )


def get_chat_service(
    db_session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    llm_provider: OllamaClient = Depends(get_ollama_client),
    agent_orchestration_service: AgentOrchestrationService = Depends(
        get_agent_orchestration_service
    ),
    image_asset_service: ImageAssetService = Depends(get_image_asset_service),
    storage_guard_service: StorageGuardService = Depends(get_storage_guard_service),
) -> ChatService:
    return ChatService(
        session_repository=ChatSessionRepository(db_session),
        message_repository=ChatMessageRepository(db_session),
        llm_provider=llm_provider,
        agent_orchestration_service=agent_orchestration_service,
        image_asset_service=image_asset_service,
        storage_guard_service=storage_guard_service,
        allowed_models=settings.allowed_models,
        db_session=db_session,
    )


def get_roleplay_template_service(
    db_session: AsyncSession = Depends(get_db_session),
) -> RoleplayTemplateService:
    return RoleplayTemplateService(
        repository=RoleplayTemplateRepository(db_session),
        db_session=db_session,
    )


def get_embedding_service(
    db_session: AsyncSession = Depends(get_db_session),
    storage_guard_service: StorageGuardService = Depends(get_storage_guard_service),
) -> EmbeddingService:
    return EmbeddingService(
        embedding_repository=EmbeddingRepository(db_session),
        embedding_provider=NoOpEmbeddingProvider(),
        storage_guard_service=storage_guard_service,
        db_session=db_session,
    )


def get_vector_search_service(
    db_session: AsyncSession = Depends(get_db_session),
) -> VectorSearchService:
    return VectorSearchService(embedding_repository=EmbeddingRepository(db_session))
