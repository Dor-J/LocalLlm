from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from fastapi.testclient import TestClient

from app.dependencies import get_chat_service
from app.main import app


@dataclass
class FakeStep:
    id: object
    run_id: object
    step_index: int
    role: str
    status: str
    input_text: str | None
    output_text: str | None
    step_metadata: dict
    created_at: datetime


@dataclass
class FakeRun:
    id: object
    session_id: object
    trigger_message_id: object | None
    backend: str
    conversation_mode: str
    crew_template_id: str | None
    status: str
    prompt: str
    metadata_json: dict
    created_at: datetime
    completed_at: datetime | None
    steps: list[FakeStep]


class DummyChatService:
    def __init__(self) -> None:
        run_id = uuid4()
        session_id = uuid4()
        self.run = FakeRun(
            id=run_id,
            session_id=session_id,
            trigger_message_id=None,
            backend="crewai",
            conversation_mode="task",
            crew_template_id="research-assistant",
            status="completed",
            prompt="Plan the release",
            metadata_json={"runtime": "crewai-task"},
            created_at=datetime.now(UTC),
            completed_at=datetime.now(UTC),
            steps=[
                FakeStep(
                    id=uuid4(),
                    run_id=run_id,
                    step_index=0,
                    role="manager",
                    status="completed",
                    input_text="Plan the release",
                    output_text="Do the work",
                    step_metadata={},
                    created_at=datetime.now(UTC),
                )
            ],
        )

    async def list_orchestration_runs(self, session_id):
        return [self.run]

    async def get_orchestration_run(self, run_id):
        return self.run if run_id == self.run.id else None


def test_list_orchestration_runs() -> None:
    service = DummyChatService()
    app.dependency_overrides[get_chat_service] = lambda: service

    try:
        client = TestClient(app)
        response = client.get(f"/api/v1/chats/{service.run.session_id}/runs")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["stepCount"] == 1
    assert payload[0]["status"] == "completed"


def test_get_orchestration_run() -> None:
    service = DummyChatService()
    app.dependency_overrides[get_chat_service] = lambda: service

    try:
        client = TestClient(app)
        response = client.get(f"/api/v1/runs/{service.run.id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["stepCount"] == 1
    assert payload["steps"][0]["role"] == "manager"
