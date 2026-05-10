from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from fastapi.testclient import TestClient

from app.dependencies import get_roleplay_template_service
from app.main import app


@dataclass
class FakeRole:
    id: object
    template_id: object
    name: str
    description: str | None
    system_prompt: str
    sort_order: int
    created_at: datetime
    updated_at: datetime


@dataclass
class FakeTemplate:
    id: object
    name: str
    description: str | None
    crew_template_id: str
    scene_state_json: dict
    roles: list[FakeRole]
    created_at: datetime
    updated_at: datetime


class DummyRoleplayTemplateService:
    def __init__(self) -> None:
        template_id = uuid4()
        self.template = FakeTemplate(
            id=template_id,
            name="Council Chamber",
            description="Political fantasy roleplay.",
            crew_template_id="roleplay-fantasy",
            scene_state_json={"scene": "council chamber"},
            roles=[
                FakeRole(
                    id=uuid4(),
                    template_id=template_id,
                    name="Chancellor",
                    description="Keeps order",
                    system_prompt="Guide the council with formal authority.",
                    sort_order=0,
                    created_at=datetime.now(UTC),
                    updated_at=datetime.now(UTC),
                )
            ],
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

    async def list_templates(self):
        return [self.template]

    async def get_template(self, template_id):
        if template_id != self.template.id:
            raise ValueError("Roleplay template not found.")
        return self.template


def test_list_roleplay_templates() -> None:
    service = DummyRoleplayTemplateService()
    app.dependency_overrides[get_roleplay_template_service] = lambda: service

    try:
        client = TestClient(app)
        response = client.get("/api/v1/roleplays/templates")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["name"] == "Council Chamber"
    assert payload[0]["roleCount"] == 1


def test_get_roleplay_template() -> None:
    service = DummyRoleplayTemplateService()
    app.dependency_overrides[get_roleplay_template_service] = lambda: service

    try:
        client = TestClient(app)
        response = client.get(f"/api/v1/roleplays/templates/{service.template.id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["sceneState"]["scene"] == "council chamber"
    assert payload["roles"][0]["name"] == "Chancellor"
