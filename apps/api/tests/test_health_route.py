from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.db.session import get_db_session
from app.dependencies import (
    get_minio_storage_service,
    get_ollama_client,
)
from app.main import app
from app.services.llm.ollama_client import OllamaStatus


class ReadyOllamaClient:
    async def get_status(self, *, allowed_models):
        return OllamaStatus(
            ready=True,
            base_url="http://host.docker.internal:11434",
            available_models=tuple(allowed_models),
            missing_allowed_models=(),
            error=None,
        )


class OfflineOllamaClient:
    async def get_status(self, *, allowed_models):
        return OllamaStatus(
            ready=False,
            base_url="http://host.docker.internal:11434",
            available_models=(),
            missing_allowed_models=tuple(allowed_models),
            error="Ollama is unreachable or returned an invalid response while listing models.",
        )


class FakeDbSession:
    def __init__(self, *, should_fail: bool = False) -> None:
        self._should_fail = should_fail

    async def execute(self, *_args, **_kwargs):
        if self._should_fail:
            raise RuntimeError("db unreachable")
        return None


async def override_db_session_ok():
    yield FakeDbSession()


async def override_db_session_fail():
    yield FakeDbSession(should_fail=True)


class FakeMinioClient:
    def __init__(self, *, should_fail: bool = False, bucket_exists: bool = True) -> None:
        self._should_fail = should_fail
        self._bucket_exists = bucket_exists

    def bucket_exists(self, _bucket_name: str) -> bool:
        if self._should_fail:
            raise RuntimeError("minio unreachable")
        return self._bucket_exists


class FakeMinioStorage:
    def __init__(self, *, should_fail: bool = False) -> None:
        self.endpoint = "http://minio:9000"
        self.bucket_name = "localchat-images"
        self.client = FakeMinioClient(should_fail=should_fail)


def override_settings():
    return SimpleNamespace(
        app_name="local-first-ai-chat-api",
        allowed_models=(
            "qwen3.5:2b",
            "gemma4:e2b",
            "gemma4-e2b-uncensored-q5_k_p",
        ),
        experimental_agent_orchestration_enabled=False,
        agent_orchestrator_backend="noop",
    )


def test_health_route_reports_ollama_ready() -> None:
    app.dependency_overrides[get_settings] = override_settings
    app.dependency_overrides[get_ollama_client] = lambda: ReadyOllamaClient()
    app.dependency_overrides[get_db_session] = override_db_session_ok
    app.dependency_overrides[get_minio_storage_service] = lambda: FakeMinioStorage()

    try:
        client = TestClient(app)
        response = client.get("/api/v1/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["ollama"]["ready"] is True
    assert payload["ollama"]["missingAllowedModels"] == []
    assert payload["database"]["ready"] is True
    assert payload["minio"]["ready"] is True


def test_health_route_reports_ollama_offline() -> None:
    app.dependency_overrides[get_settings] = override_settings
    app.dependency_overrides[get_ollama_client] = lambda: OfflineOllamaClient()
    app.dependency_overrides[get_db_session] = override_db_session_ok
    app.dependency_overrides[get_minio_storage_service] = lambda: FakeMinioStorage()

    try:
        client = TestClient(app)
        response = client.get("/api/v1/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "degraded"
    assert payload["ollama"]["ready"] is False
    assert payload["ollama"]["baseUrl"] == "http://host.docker.internal:11434"


def test_health_route_reports_crewai_enabled() -> None:
    def override_crewai_settings():
        settings = override_settings()
        settings.agent_orchestrator_backend = "crewai"
        return settings

    app.dependency_overrides[get_settings] = override_crewai_settings
    app.dependency_overrides[get_ollama_client] = lambda: ReadyOllamaClient()
    app.dependency_overrides[get_db_session] = override_db_session_ok
    app.dependency_overrides[get_minio_storage_service] = lambda: FakeMinioStorage()

    try:
        client = TestClient(app)
        response = client.get("/api/v1/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["agentOrchestrationEnabled"] is True
    assert "device" + "Control" not in payload


def test_health_route_reports_database_offline() -> None:
    app.dependency_overrides[get_settings] = override_settings
    app.dependency_overrides[get_ollama_client] = lambda: ReadyOllamaClient()
    app.dependency_overrides[get_db_session] = override_db_session_fail
    app.dependency_overrides[get_minio_storage_service] = lambda: FakeMinioStorage()

    try:
        client = TestClient(app)
        response = client.get("/api/v1/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "degraded"
    assert payload["database"]["ready"] is False


def test_health_route_reports_minio_offline() -> None:
    app.dependency_overrides[get_settings] = override_settings
    app.dependency_overrides[get_ollama_client] = lambda: ReadyOllamaClient()
    app.dependency_overrides[get_db_session] = override_db_session_ok
    app.dependency_overrides[get_minio_storage_service] = lambda: FakeMinioStorage(should_fail=True)

    try:
        client = TestClient(app)
        response = client.get("/api/v1/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "degraded"
    assert payload["minio"]["ready"] is False
