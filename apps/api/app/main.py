from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.middleware.request_context import RequestContextMiddleware
from app.middleware.request_size import RequestSizeLimitMiddleware
from app.services.llm.ollama_client import OllamaClient, build_http_timeout

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    ollama_http = httpx.AsyncClient(timeout=build_http_timeout(settings.ollama_timeout_seconds))
    app.state.ollama_client = OllamaClient(
        base_url=settings.ollama_base_url,
        timeout_seconds=settings.ollama_timeout_seconds,
        model_cache_ttl_seconds=settings.ollama_model_cache_ttl_seconds,
        http_client=ollama_http,
    )
    try:
        yield
    finally:
        await ollama_http.aclose()


settings = get_settings()

app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    RequestContextMiddleware,
)

app.add_middleware(
    RequestSizeLimitMiddleware,
    max_body_bytes=settings.max_request_body_bytes,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-Id"],
    expose_headers=["X-Request-Id"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)
