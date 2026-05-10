from datetime import datetime
from typing import Literal

from app.schemas.base import APIModel


class OllamaHealthStatus(APIModel):
    ready: bool
    base_url: str
    available_models: list[str]
    missing_allowed_models: list[str]
    error: str | None


class DatabaseHealthStatus(APIModel):
    ready: bool
    error: str | None


class MinioHealthStatus(APIModel):
    ready: bool
    endpoint: str
    bucket_name: str
    bucket_exists: bool | None
    error: str | None


class HealthResponse(APIModel):
    status: Literal["ok", "degraded"]
    app_name: str
    allowed_models: list[str]
    agent_orchestration_enabled: bool
    ollama: OllamaHealthStatus
    database: DatabaseHealthStatus
    minio: MinioHealthStatus
    timestamp: datetime
