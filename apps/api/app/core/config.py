from functools import lru_cache

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "local-first-ai-chat-api"
    api_v1_prefix: str = "/api/v1"
    log_format: str = Field(default="text", alias="LOG_FORMAT")
    database_url: str = "postgresql+psycopg://localchat:localchat@postgres:5432/localchat"
    database_pool_size: int = Field(default=5, alias="DATABASE_POOL_SIZE")
    database_max_overflow: int = Field(default=10, alias="DATABASE_MAX_OVERFLOW")
    database_pool_recycle: int = Field(
        default=1800, alias="DATABASE_POOL_RECYCLE"
    )  # seconds; refresh connections periodically
    database_pool_timeout: float = Field(
        default=30.0, alias="DATABASE_POOL_TIMEOUT"
    )
    db_slow_query_log_ms: float = Field(
        default=200.0, alias="DB_SLOW_QUERY_LOG_MS"
    )  # log each statement at WARNING if slower than this
    uvicorn_workers: int = Field(default=2, ge=1, alias="UVICORN_WORKERS")
    uvicorn_reload: bool = Field(
        default=False, alias="UVICORN_RELOAD"
    )  # dev only; disable in production
    cors_origins_raw: str = Field(
        default="http://localhost:3000",
        alias="CORS_ORIGINS",
    )
    ollama_base_url: str = "http://ollama:11434"
    ollama_allowed_models_raw: str = Field(
        default="qwen3.5:2b,gemma4:e2b,gemma4-e2b-uncensored-q5_k_p",
        alias="OLLAMA_ALLOWED_MODELS",
    )
    ollama_timeout_seconds: float = 600.0
    ollama_model_cache_ttl_seconds: float = 30.0
    minio_endpoint: str = "http://minio:9000"
    minio_access_key: str = "localchat"
    minio_secret_key: str = "localchat-secret"
    minio_bucket_name: str = "localchat-images"
    minio_secure: bool = False
    experimental_agent_orchestration_enabled: bool = False
    agent_orchestrator_backend: str = "noop"
    max_request_body_bytes: int = 131072
    max_chat_content_chars: int = 8000
    max_chat_title_chars: int = 120
    max_source_content_chars: int = 20000
    max_embedding_dimensions: int = 4096
    max_sessions: int = 500
    max_messages_per_session: int = 400
    max_images_per_session: int = 24
    max_image_list_per_page: int = Field(
        default=200,
        ge=1,
        le=10_000,
        alias="MAX_IMAGE_LIST_PER_PAGE",
    )  # cap for GET /images
    max_image_upload_bytes: int = 10 * 1024 * 1024
    max_document_chunks: int = 20000
    max_embedding_records: int = 20000
    max_database_bytes: int = 1073741824
    storage_warning_ratio: float = 0.8
    storage_usage_log_min_interval_seconds: float = 60.0

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origins(self) -> list[str]:
        return [value.strip() for value in self.cors_origins_raw.split(",") if value.strip()]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def allowed_models(self) -> tuple[str, ...]:
        return tuple(
            value.strip() for value in self.ollama_allowed_models_raw.split(",") if value.strip()
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
