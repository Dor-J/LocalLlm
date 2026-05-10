from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import Field, StringConstraints

from app.schemas.base import APIModel
from app.services.agent_orchestration.templates import (
    ConversationMode,
    CrewTemplateId,
)


class ChatSessionCreate(APIModel):
    title: Annotated[str | None, StringConstraints(max_length=120)] = None
    conversation_mode: ConversationMode = "regular"
    crew_template_id: CrewTemplateId | None = None


class ChatSessionRead(APIModel):
    id: UUID
    title: str | None
    conversation_mode: ConversationMode
    crew_template_id: CrewTemplateId | None
    scene_state: dict = Field(default_factory=dict, validation_alias="scene_state_json")
    created_at: datetime
    updated_at: datetime


class CreateChatSessionResponse(APIModel):
    session: ChatSessionRead


class ChatSessionListPage(APIModel):
    """Paginated list of chat sessions (newest `updated_at` first)."""

    items: list[ChatSessionRead]
    total: int
    limit: int
    offset: int


class ChatMessageRead(APIModel):
    id: UUID
    session_id: UUID
    role: str
    content: str
    selected_model: str | None
    metadata: dict = Field(default_factory=dict, validation_alias="message_metadata")
    created_at: datetime


class ChatMessageListPage(APIModel):
    """A slice of messages for a session (oldest first, same as non-paginated order)."""

    items: list[ChatMessageRead]
    total: int
    limit: int
    offset: int


class ChatSessionDetail(APIModel):
    session: ChatSessionRead
    messages: list[ChatMessageRead]


class ChatCompletionRequest(APIModel):
    content: Annotated[str, StringConstraints(min_length=1, max_length=8000)]
    selected_model: Annotated[str, StringConstraints(min_length=1, max_length=64)]
    agent_mode: bool = False
    roleplay_enabled: bool = False
    image_asset_ids: list[UUID] = Field(default_factory=list)
    conversation_mode: ConversationMode | None = None
    crew_template_id: CrewTemplateId | None = None


class OrchestrationStatus(APIModel):
    enabled: bool
    mode: str
    run_id: UUID | None = None
    status: str | None = None
    step_count: int = 0
    summary: str | None = None


class ChatCompletionResponse(APIModel):
    session: ChatSessionRead
    user_message: ChatMessageRead
    assistant_message: ChatMessageRead
    orchestration: OrchestrationStatus
