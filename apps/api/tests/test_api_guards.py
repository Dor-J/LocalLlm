from uuid import uuid4

from fastapi.testclient import TestClient

from app.dependencies import get_chat_service
from app.main import app


class DummyChatService:
    async def create_session(self, *, title=None):
        raise AssertionError("service should not be called for invalid payloads")

    async def generate_response(self, **kwargs):
        raise AssertionError("service should not be called for invalid payloads")


def test_chat_completion_rejects_too_long_content() -> None:
    app.dependency_overrides[get_chat_service] = lambda: DummyChatService()

    try:
        client = TestClient(app)
        response = client.post(
            f"/api/v1/chats/{uuid4()}/completions",
            json={
                "content": "x" * 8001,
                "selectedModel": "qwen3.5:2b",
                "agentMode": False,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422


def test_chat_completion_rejects_oversized_request_body() -> None:
    app.dependency_overrides[get_chat_service] = lambda: DummyChatService()

    try:
        client = TestClient(app)
        response = client.post(
            f"/api/v1/chats/{uuid4()}/completions",
            json={
                "content": "x" * 140000,
                "selectedModel": "qwen3.5:2b",
                "agentMode": False,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 413
