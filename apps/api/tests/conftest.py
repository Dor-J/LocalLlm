"""Shared pytest fixtures for the API test suite.

Exposes factories for common fakes plus a real-app ``httpx.AsyncClient`` bound
via ``ASGITransport`` so integration tests can exercise the FastAPI app without
a live server.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import httpx
import pytest

from tests.fakes import (
    FakeAgentOrchestrator,
    FakeCrewAgentOrchestrator,
    FakeDBSession,
    FakeImageAssetService,
    FakeLLMProvider,
    FakeMessageRepository,
    FakeSession,
    FakeSessionRepository,
    FakeStorageGuard,
)


@pytest.fixture
def fake_session() -> FakeSession:
    from uuid import uuid4

    return FakeSession(id=uuid4())


@pytest.fixture
def session_repository_factory():
    def _make(session: FakeSession) -> FakeSessionRepository:
        return FakeSessionRepository(session)

    return _make


@pytest.fixture
def message_repository() -> FakeMessageRepository:
    return FakeMessageRepository()


@pytest.fixture
def llm_provider() -> FakeLLMProvider:
    return FakeLLMProvider()


@pytest.fixture
def storage_guard() -> FakeStorageGuard:
    return FakeStorageGuard()


@pytest.fixture
def image_asset_service() -> FakeImageAssetService:
    return FakeImageAssetService()


@pytest.fixture
def agent_orchestrator() -> FakeAgentOrchestrator:
    return FakeAgentOrchestrator()


@pytest.fixture
def crew_agent_orchestrator() -> FakeCrewAgentOrchestrator:
    return FakeCrewAgentOrchestrator()


@pytest.fixture
def db_session() -> FakeDBSession:
    return FakeDBSession()


@pytest.fixture
async def app_client() -> AsyncIterator[httpx.AsyncClient]:
    """Return an ``AsyncClient`` bound to the real FastAPI app via ``ASGITransport``."""

    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
