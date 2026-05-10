"""Integration tests for the SSE chat-completion stream endpoint (P1-API-02)."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from uuid import uuid4

import httpx
import pytest

from app.dependencies import get_chat_service
from app.main import app


class _StubChatService:
    """Emits a canned sequence of SSE events regardless of input."""

    def __init__(self, events: list[dict]) -> None:
        self._events = events

    async def stream_response(self, **_kwargs) -> AsyncIterator[dict]:
        for event in self._events:
            yield event


def _parse_events(text: str) -> list[dict]:
    return [
        json.loads(line[len("data: ") :]) for line in text.splitlines() if line.startswith("data: ")
    ]


@pytest.mark.anyio
async def test_stream_route_emits_meta_token_done_sequence() -> None:
    session_id = uuid4()
    user_id = uuid4()
    assistant_id = uuid4()
    events = [
        {
            "type": "meta",
            "sessionId": str(session_id),
            "userMessage": {"id": str(user_id), "role": "user", "content": "hi"},
        },
        {"type": "token", "content": "Hello"},
        {"type": "token", "content": " world"},
        {
            "type": "done",
            "assistantMessage": {
                "id": str(assistant_id),
                "role": "assistant",
                "content": "Hello world",
            },
            "orchestration": {"enabled": False, "mode": "none"},
        },
    ]
    stub = _StubChatService(events)
    app.dependency_overrides[get_chat_service] = lambda: stub

    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                f"/api/v1/chats/{session_id}/completions/stream",
                json={
                    "content": "hi",
                    "selected_model": "qwen3.5:2b",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    parsed = _parse_events(response.text)
    assert [event["type"] for event in parsed] == ["meta", "token", "token", "done"]
    assert parsed[1]["content"] == "Hello"
    assert parsed[3]["assistantMessage"]["content"] == "Hello world"


@pytest.mark.anyio
async def test_stream_route_emits_error_event_on_invalid_request() -> None:
    session_id = uuid4()

    class _BoomService:
        async def stream_response(self, **_kwargs) -> AsyncIterator[dict]:
            raise ValueError("Chat session not found")
            yield  # pragma: no cover - keep async generator shape

    app.dependency_overrides[get_chat_service] = lambda: _BoomService()
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                f"/api/v1/chats/{session_id}/completions/stream",
                json={"content": "hi", "selected_model": "qwen3.5:2b"},
            )
    finally:
        app.dependency_overrides.clear()

    parsed = _parse_events(response.text)
    assert parsed[-1]["type"] == "error"
    assert parsed[-1]["code"] == "invalid_request"
