"""Shared HTTP clients from app lifespan (P0-API-01)."""

from fastapi.testclient import TestClient
from starlette.requests import Request

from app.dependencies import get_ollama_client
from app.main import app


def _minimal_http_scope(application):
    return {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.4"},
        "http_version": "1.1",
        "method": "GET",
        "path": "/",
        "raw_path": b"/",
        "root_path": "",
        "scheme": "http",
        "client": ("127.0.0.1", 8000),
        "server": ("127.0.0.1", 8000),
        "headers": [],
        "state": {},
        "app": application,
    }


def test_lifespan_attaches_shared_clients() -> None:
    with TestClient(app):
        assert hasattr(app.state, "ollama_client")
        assert app.state.ollama_client is not None


def test_get_ollama_client_returns_app_state_instance() -> None:
    with TestClient(app):

        async def receive() -> dict:
            return {"type": "http.disconnect"}

        req = Request(_minimal_http_scope(app), receive)
        assert get_ollama_client(req) is app.state.ollama_client
