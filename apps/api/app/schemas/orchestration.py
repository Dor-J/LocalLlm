from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import APIModel


class OrchestrationStepRead(APIModel):
    id: UUID
    run_id: UUID
    step_index: int
    role: str
    status: str
    input_text: str | None = None
    output_text: str | None = None
    metadata: dict = Field(default_factory=dict, validation_alias="step_metadata")
    created_at: datetime


class OrchestrationRunRead(APIModel):
    id: UUID
    session_id: UUID
    trigger_message_id: UUID | None
    backend: str
    conversation_mode: str
    crew_template_id: str | None
    status: str
    prompt: str
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_json")
    created_at: datetime
    completed_at: datetime | None
    step_count: int = 0


class OrchestrationRunDetail(OrchestrationRunRead):
    steps: list[OrchestrationStepRead] = Field(default_factory=list)
