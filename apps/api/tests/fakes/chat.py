"""Reusable fake collaborators for ``ChatService``-style tests.

Centralising these fakes keeps individual test modules lean and guarantees
behavioural parity (e.g. counting commits/flushes consistently).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import uuid4

from app.services.agent_orchestration.base import AgentRoutingResult, AgentTurnResult
from app.services.llm.base import LLMChatResult


@dataclass
class FakeSession:
    """Minimal stand-in for ``ChatSession`` rows."""

    id: object
    title: str | None = None
    conversation_mode: str = "regular"
    crew_template_id: str | None = None
    scene_state_json: dict = field(default_factory=dict)
    updated_at: object | None = None


@dataclass
class FakeMessage:
    """Minimal stand-in for ``ChatMessage`` rows."""

    id: object
    session_id: object
    role: str
    content: str
    selected_model: str | None
    message_metadata: dict = field(default_factory=dict)


@dataclass
class FakeImageAsset:
    """Minimal stand-in for ``ImageAsset`` rows."""

    id: object
    session_id: object
    object_key: str
    file_name: str
    content_type: str
    byte_size: int
    sha256: str
    image_metadata: dict = field(default_factory=dict)


class FakeSessionRepository:
    def __init__(self, session: FakeSession) -> None:
        self.session = session

    async def list_sessions(self, *, limit, offset):
        rows = [self.session]
        return rows[offset : offset + limit], len(rows)

    async def get_session_with_messages(self, session_id):
        session = await self.get_session(session_id)
        if session is None:
            return None
        if not hasattr(session, "messages"):
            session.messages = []  # type: ignore[attr-defined]
        return session

    async def create_session(
        self,
        *,
        title=None,
        conversation_mode="regular",
        crew_template_id=None,
        scene_state_json=None,
    ):
        self.session.title = title
        self.session.conversation_mode = conversation_mode
        self.session.crew_template_id = crew_template_id
        self.session.scene_state_json = scene_state_json or {}
        return self.session

    async def count_sessions(self):
        return 1

    async def get_session(self, session_id):
        if session_id == self.session.id:
            return self.session
        return None

    async def delete_session(self, session):
        return None

    async def touch_session(self, session):
        return session

    async def set_title_if_missing(self, session, *, title):
        if session.title is None:
            session.title = title
        return session


class FakeMessageRepository:
    def __init__(self) -> None:
        self.messages: list[FakeMessage] = []

    async def list_by_session(self, session_id):
        return [message for message in self.messages if message.session_id == session_id]

    async def list_by_session_paginated(self, session_id, *, limit, offset):
        rows = [m for m in self.messages if m.session_id == session_id]
        total = len(rows)
        return rows[offset : offset + limit], total

    async def create_message(self, *, session_id, role, content, selected_model, metadata=None):
        message = FakeMessage(
            id=uuid4(),
            session_id=session_id,
            role=role.value,
            content=content,
            selected_model=selected_model,
            message_metadata=metadata or {},
        )
        self.messages.append(message)
        return message

    async def count_by_session(self, session_id):
        return len([message for message in self.messages if message.session_id == session_id])

    async def count_all_messages(self):
        return len(self.messages)


class FakeEmbeddingRepository:
    async def count_chunks(self):
        return 0

    async def count_embedding_records(self):
        return 0

    async def get_database_size_bytes(self):
        return 1024


class FakeLLMProvider:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def ensure_model_available(self, *, model):
        return None

    async def complete_chat(self, *, model, messages):
        self.calls.append({"model": model, "messages": messages})
        return LLMChatResult(content="Synthetic answer", model=model, metadata={"source": "test"})

    async def stream_chat(self, *, model, messages):
        yield "not used"

    async def stream_chat_tokens(self, *, model, messages):
        self.calls.append({"model": model, "messages": messages})
        for delta in ("Synth", "etic", " answer"):
            yield delta


class FakeImageAssetService:
    def __init__(self, *, image_content: bytes | None = None) -> None:
        self.image_content = image_content or b"fake-image"
        self.deleted_sessions: list[object] = []
        self.loaded_image_requests: list[list[object]] = []

    async def delete_images_for_session(self, session_id):
        self.deleted_sessions.append(session_id)

    async def ensure_images_allowed_for_model(self, *, selected_model, image_asset_ids):
        if image_asset_ids and selected_model != "gemma4:e2b":
            raise ValueError("Image attachments are only supported with gemma4:e2b.")

    async def load_images_for_completion(self, *, session_id, image_asset_ids):
        self.loaded_image_requests.append(list(image_asset_ids))
        return ["ZmFrZS1pbWFnZQ=="] if image_asset_ids else []


class FakeAgentOrchestrator:
    enabled = False
    mode = "none"

    async def prepare_chat_request(
        self,
        *,
        session,
        prompt,
        selected_model,
        conversation_mode,
        crew_template_id,
    ):
        return AgentRoutingResult(
            enabled=False,
            mode="none",
            conversation_mode=conversation_mode,
            crew_template_id=crew_template_id,
            system_messages=[],
        )

    async def demo_dispatch(self, *, prompt):
        return {}


class FakeCrewAgentOrchestrator(FakeAgentOrchestrator):
    enabled = True
    mode = "crewai"

    def __init__(self) -> None:
        self.turn_calls: list[dict] = []

    async def prepare_chat_request(
        self,
        *,
        session,
        prompt,
        selected_model,
        conversation_mode,
        crew_template_id,
    ):
        return AgentRoutingResult(
            enabled=True,
            mode=self.mode,
            conversation_mode=conversation_mode,
            crew_template_id=crew_template_id,
            system_messages=[],
            metadata={
                "conversation_mode": conversation_mode,
                "crew_template_id": crew_template_id,
                "template": {"id": crew_template_id},
            },
        )

    async def execute_turn(
        self,
        *,
        session,
        prompt,
        selected_model,
        conversation_mode,
        crew_template_id,
        history,
        images=None,
        trigger_message_id=None,
    ):
        self.turn_calls.append(
            {
                "session_id": session.id,
                "prompt": prompt,
                "selected_model": selected_model,
                "conversation_mode": conversation_mode,
                "crew_template_id": crew_template_id,
                "history_length": len(history),
                "images": list(images or []),
                "trigger_message_id": trigger_message_id,
            }
        )
        return AgentTurnResult(
            response=LLMChatResult(
                content="Crew orchestrated reply",
                model=selected_model,
                metadata={"source": "fake-crew"},
            ),
            metadata={
                "run_id": "run-crew-1",
                "steps": [{"role": "director", "status": "completed", "step_index": 0}],
            },
        )


class FakeDBSession:
    def __init__(self) -> None:
        self.commits = 0
        self.flushes = 0

    async def commit(self):
        self.commits += 1

    async def flush(self):
        self.flushes += 1

    async def refresh(self, instance):
        return instance


class FakeStorageGuard:
    def __init__(self) -> None:
        self.contexts: list[str] = []

    async def guard_database_size(self):
        return None

    async def guard_session_creation(self):
        return None

    async def guard_message_creation(self, *, session_id):
        return None

    async def guard_embedding_creation(self):
        return None

    async def log_usage(self, *, context: str, force: bool = False):
        self.contexts.append(context)
        return None
