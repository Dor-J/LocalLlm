import asyncio

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.time import utc_now
from app.db.session import get_db_session
from app.dependencies import (
    get_minio_storage_service,
    get_ollama_client,
)
from app.schemas.health import (
    DatabaseHealthStatus,
    HealthResponse,
    MinioHealthStatus,
    OllamaHealthStatus,
)
from app.services.llm.ollama_client import OllamaClient
from app.services.storage.minio_storage import MinioStorageService

router = APIRouter()


async def _probe_database(
    db_session: AsyncSession, *, timeout_seconds: float
) -> DatabaseHealthStatus:
    try:
        await asyncio.wait_for(db_session.execute(text("SELECT 1")), timeout=timeout_seconds)
        return DatabaseHealthStatus(ready=True, error=None)
    except Exception as error:  # noqa: BLE001 - we want a degraded health payload
        return DatabaseHealthStatus(ready=False, error=str(error))


async def _probe_minio(
    minio_storage: MinioStorageService, *, timeout_seconds: float
) -> MinioHealthStatus:
    try:
        bucket_exists = await asyncio.wait_for(
            asyncio.to_thread(minio_storage.client.bucket_exists, minio_storage.bucket_name),
            timeout=timeout_seconds,
        )
        return MinioHealthStatus(
            ready=True,
            endpoint=minio_storage.endpoint,
            bucket_name=minio_storage.bucket_name,
            bucket_exists=bool(bucket_exists),
            error=None,
        )
    except Exception as error:  # noqa: BLE001 - we want a degraded health payload
        return MinioHealthStatus(
            ready=False,
            endpoint=minio_storage.endpoint,
            bucket_name=minio_storage.bucket_name,
            bucket_exists=None,
            error=str(error),
        )


@router.get("/health", response_model=HealthResponse)
async def health(
    settings=Depends(get_settings),
    ollama_client: OllamaClient = Depends(get_ollama_client),
    db_session: AsyncSession = Depends(get_db_session),
    minio_storage: MinioStorageService = Depends(get_minio_storage_service),
) -> HealthResponse:
    timeout_seconds = 2.0
    ollama_status, db_status, minio_status = await asyncio.gather(
        ollama_client.get_status(allowed_models=settings.allowed_models),
        _probe_database(db_session, timeout_seconds=timeout_seconds),
        _probe_minio(minio_storage, timeout_seconds=timeout_seconds),
    )
    degraded = (
        (not ollama_status.ready)
        or bool(ollama_status.missing_allowed_models)
        or (not db_status.ready)
        or (not minio_status.ready)
    )

    return HealthResponse(
        status="degraded" if degraded else "ok",
        app_name=settings.app_name,
        allowed_models=list(settings.allowed_models),
        agent_orchestration_enabled=(
            settings.experimental_agent_orchestration_enabled
            or settings.agent_orchestrator_backend == "crewai"
        ),
        ollama=OllamaHealthStatus(
            ready=ollama_status.ready,
            base_url=ollama_status.base_url,
            available_models=list(ollama_status.available_models),
            missing_allowed_models=list(ollama_status.missing_allowed_models),
            error=ollama_status.error,
        ),
        database=db_status,
        minio=minio_status,
        timestamp=utc_now(),
    )
