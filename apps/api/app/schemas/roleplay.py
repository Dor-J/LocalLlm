from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import Field, StringConstraints

from app.schemas.base import APIModel

RoleplayCrewTemplateId = Annotated[
    str,
    StringConstraints(pattern="^(roleplay-fantasy|roleplay-debate)$"),
]


class RoleplayRoleUpsert(APIModel):
    id: UUID | None = None
    name: Annotated[str, StringConstraints(min_length=1, max_length=120)]
    description: Annotated[str | None, StringConstraints(max_length=1000)] = None
    system_prompt: Annotated[str, StringConstraints(min_length=1, max_length=8000)]


class RoleplayRoleRead(APIModel):
    id: UUID
    template_id: UUID
    name: str
    description: str | None
    system_prompt: str
    sort_order: int
    created_at: datetime
    updated_at: datetime


class RoleplayTemplateCreate(APIModel):
    name: Annotated[str, StringConstraints(min_length=1, max_length=120)]
    description: Annotated[str | None, StringConstraints(max_length=1000)] = None
    crew_template_id: RoleplayCrewTemplateId = "roleplay-fantasy"
    scene_state: dict = Field(default_factory=dict, validation_alias="scene_state_json")
    roles: list[RoleplayRoleUpsert] = Field(default_factory=list)


class RoleplayTemplateUpdate(APIModel):
    name: Annotated[str, StringConstraints(min_length=1, max_length=120)]
    description: Annotated[str | None, StringConstraints(max_length=1000)] = None
    crew_template_id: RoleplayCrewTemplateId
    scene_state: dict = Field(default_factory=dict, validation_alias="scene_state_json")
    roles: list[RoleplayRoleUpsert] = Field(default_factory=list)


class RoleplayTemplateSummary(APIModel):
    id: UUID
    name: str
    description: str | None
    crew_template_id: str
    scene_state: dict = Field(default_factory=dict, validation_alias="scene_state_json")
    role_count: int
    created_at: datetime
    updated_at: datetime


class RoleplayTemplateRead(APIModel):
    id: UUID
    name: str
    description: str | None
    crew_template_id: str
    scene_state: dict = Field(default_factory=dict, validation_alias="scene_state_json")
    roles: list[RoleplayRoleRead]
    created_at: datetime
    updated_at: datetime
