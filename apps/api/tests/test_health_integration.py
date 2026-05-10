"""Smoke-test the conftest wiring by exercising ``/api/v1/health`` end-to-end."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.core.config import get_settings
from app.db.session import get_db_session
from app.dependencies import (
    get_minio_storage_service,
    get_ollama_client,
)
from app.main import app
from app.services.llm.ollama_client import OllamaStatus


class _ReadyOllamaClient:
    async def get_status(self, *, allowed_models):
        return OllamaStatus(
            ready=True,
            base_url="http://host.docker.internal:11434",
            available_models=tuple(allowed_models),
            missing_allowed_models=(),
            error=None,
        )


class _FakeDbSession:
    async def execute(self, *_args, **_kwargs):
        return None


async def _override_db_session():
    yield _FakeDbSession()


class _FakeMinioClient:
    def bucket_exists(self, _name: str) -> bool:
        return True


class _FakeMinioStorage:
    endpoint = "http://minio:9000"
    bucket_name = "localchat-images"
    client = _FakeMinioClient()


def _override_settings(*, health_detailed: bool = True):
    return SimpleNamespace(
        app_name="local-first-ai-chat-api",
        allowed_models=("qwen3.5:2b",),
        experimental_agent_orchestration_enabled=False,
        agent_orchestrator_backend="noop",
        health_detailed=health_detailed,
    )


@pytest.mark.anyio
async def test_health_endpoint_via_app_client(app_client) -> None:
    app.dependency_overrides[get_settings] = lambda: _override_settings()
    app.dependency_overrides[get_ollama_client] = lambda: _ReadyOllamaClient()
    app.dependency_overrides[get_db_session] = _override_db_session
    app.dependency_overrides[get_minio_storage_service] = lambda: _FakeMinioStorage()

    try:
        response = await app_client.get("/api/v1/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["database"]["ready"] is True
    assert payload["minio"]["ready"] is True


@pytest.mark.anyio
async def test_health_minimal_payload_via_app_client(app_client) -> None:
    app.dependency_overrides[get_settings] = lambda: _override_settings(health_detailed=False)
    app.dependency_overrides[get_ollama_client] = lambda: _ReadyOllamaClient()
    app.dependency_overrides[get_db_session] = _override_db_session
    app.dependency_overrides[get_minio_storage_service] = lambda: _FakeMinioStorage()

    try:
        response = await app_client.get("/api/v1/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "app_name" not in payload
    assert payload["database"] == {"ready": True}
    assert payload["ollama"] == {"ready": True}
    assert payload["minio"] == {"ready": True}
    assert "timestamp" in payload
