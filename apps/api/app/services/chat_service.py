from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

from app.models import ChatMessageRole
from app.services.agent_orchestration.base import AgentOrchestrationService, AgentRoutingResult
from app.services.agent_orchestration.templates import ConversationMode, CrewTemplateId
from app.services.chat import (
    build_provider_history,
    normalize_session_preferences,
    resolve_turn_preferences,
    select_completion_history,
)
from app.services.image_assets.image_asset_service import ImageAssetService
from app.services.llm.base import (
    ChatProvider,
    LLMProviderUnavailableError,
    validate_selected_model,
)
from app.services.storage_guard import StorageGuardService


def _serialize_message(message) -> dict:
    """Return a JSON-friendly view of a message dataclass/ORM row."""

    return {
        "id": str(getattr(message, "id", "")),
        "sessionId": str(getattr(message, "session_id", "")),
        "role": getattr(message, "role", None),
        "content": getattr(message, "content", ""),
        "selectedModel": getattr(message, "selected_model", None),
        "metadata": getattr(message, "message_metadata", {}),
        "createdAt": (
            getattr(message, "created_at", None).isoformat()
            if getattr(message, "created_at", None) is not None
            else ""
        ),
    }


def _serialize_session(session) -> dict:
    return {
        "id": str(getattr(session, "id", "")),
        "title": getattr(session, "title", None),
        "conversationMode": getattr(session, "conversation_mode", "regular"),
        "crewTemplateId": getattr(session, "crew_template_id", None),
        "sceneState": getattr(session, "scene_state_json", {}) or {},
        "createdAt": (
            getattr(session, "created_at", None).isoformat()
            if getattr(session, "created_at", None) is not None
            else ""
        ),
        "updatedAt": (
            getattr(session, "updated_at", None).isoformat()
            if getattr(session, "updated_at", None) is not None
            else ""
        ),
    }


def _serialize_orchestration(orchestration) -> dict:
    metadata = orchestration.metadata or {}
    return {
        "enabled": orchestration.enabled,
        "mode": orchestration.mode,
        "runId": str(metadata.get("run_id")) if metadata.get("run_id") is not None else None,
        "status": metadata.get("status"),
        "stepCount": metadata.get("step_count", 0),
        "summary": metadata.get("summary"),
    }


class ChatService:
    """Coordinator that persists chat turns and dispatches to the right backend.

    ``generate_response`` delegates routing, history shaping, and preference
    resolution to helpers in :mod:`app.services.chat` to stay under ~80 lines.
    """

    def __init__(
        self,
        *,
        session_repository,
        message_repository,
        llm_provider: ChatProvider,
        agent_orchestration_service: AgentOrchestrationService,
        image_asset_service: ImageAssetService,
        storage_guard_service: StorageGuardService,
        allowed_models: tuple[str, ...],
        db_session,
    ) -> None:
        self.session_repository = session_repository
        self.message_repository = message_repository
        self.llm_provider = llm_provider
        self.agent_orchestration_service = agent_orchestration_service
        self.image_asset_service = image_asset_service
        self.storage_guard_service = storage_guard_service
        self.allowed_models = allowed_models
        self.db_session = db_session

    async def list_sessions(
        self,
        *,
        limit: int,
        offset: int,
    ):
        return await self.session_repository.list_sessions(limit=limit, offset=offset)

    async def create_session(
        self,
        *,
        title: str | None = None,
        conversation_mode: ConversationMode = "regular",
        crew_template_id: CrewTemplateId | None = None,
    ):
        await self.storage_guard_service.guard_database_size()
        await self.storage_guard_service.guard_session_creation()
        normalized_mode, normalized_template_id = normalize_session_preferences(
            conversation_mode=conversation_mode,
            crew_template_id=crew_template_id,
        )
        session = await self.session_repository.create_session(
            title=title,
            conversation_mode=normalized_mode,
            crew_template_id=normalized_template_id,
            scene_state_json={},
        )
        await self.storage_guard_service.log_usage(context="create_session")
        return session

    async def get_session(self, session_id: uuid.UUID):
        return await self.session_repository.get_session(session_id)

    async def get_session_detail(self, session_id: uuid.UUID):
        session = await self.session_repository.get_session_with_messages(session_id)
        if session is None:
            raise ValueError("Chat session not found")
        return session, list(session.messages)

    async def list_session_messages_paginated(
        self,
        session_id: uuid.UUID,
        *,
        limit: int,
        offset: int,
    ):
        await self.require_session(session_id)
        return await self.message_repository.list_by_session_paginated(
            session_id,
            limit=limit,
            offset=offset,
        )

    async def list_orchestration_runs(self, session_id: uuid.UUID):
        return await self.agent_orchestration_service.list_session_runs(session_id=session_id)

    async def get_orchestration_run(self, run_id: uuid.UUID):
        return await self.agent_orchestration_service.get_run_trace(run_id=run_id)

    async def delete_session(self, session_id: uuid.UUID) -> None:
        session = await self.require_session(session_id)
        await self.image_asset_service.delete_images_for_session(session_id)
        await self.session_repository.delete_session(session)

    async def generate_response(
        self,
        *,
        session_id: uuid.UUID,
        content: str,
        selected_model: str,
        agent_mode: bool,
        roleplay_enabled: bool = False,
        image_asset_ids: list[uuid.UUID] | None = None,
        conversation_mode: ConversationMode | None = None,
        crew_template_id: CrewTemplateId | None = None,
    ):
        validate_selected_model(selected_model, self.allowed_models)
        session = await self.require_session(session_id)
        await self.storage_guard_service.guard_database_size()
        await self.storage_guard_service.guard_message_creation(session_id=session_id)
        await self.image_asset_service.ensure_images_allowed_for_model(
            selected_model=selected_model,
            image_asset_ids=image_asset_ids or [],
        )
        images = await self.image_asset_service.load_images_for_completion(
            session_id=session_id,
            image_asset_ids=image_asset_ids or [],
        )

        user_message = await self._persist_user_message(
            session=session,
            content=content,
            selected_model=selected_model,
            agent_mode=agent_mode,
            roleplay_enabled=roleplay_enabled,
            image_asset_ids=image_asset_ids or [],
        )
        effective_mode, effective_template_id = resolve_turn_preferences(
            session=session,
            conversation_mode=conversation_mode,
            crew_template_id=crew_template_id,
            agent_mode=agent_mode,
            roleplay_enabled=roleplay_enabled,
        )
        session.conversation_mode = effective_mode
        session.crew_template_id = effective_template_id
        if not session.scene_state_json:
            session.scene_state_json = {}
        await self.session_repository.touch_session(session)
        await self.db_session.flush()
        await self.storage_guard_service.log_usage(context="store_user_message")

        return await self._handle_llm_turn(
            session=session,
            session_id=session_id,
            content=content,
            user_message=user_message,
            selected_model=selected_model,
            images=images,
            effective_mode=effective_mode,
            effective_template_id=effective_template_id,
        )

    async def _persist_user_message(
        self,
        *,
        session,
        content: str,
        selected_model: str,
        agent_mode: bool,
        roleplay_enabled: bool,
        image_asset_ids: list[uuid.UUID],
    ):
        user_message = await self.message_repository.create_message(
            session_id=session.id,
            role=ChatMessageRole.USER,
            content=content,
            selected_model=selected_model,
            metadata={
                "agent_mode_requested": agent_mode,
                "roleplay_enabled": roleplay_enabled,
                "conversation_mode": session.conversation_mode,
                "crew_template_id": session.crew_template_id,
                "image_asset_ids": [str(image_id) for image_id in image_asset_ids],
            },
        )
        title = content.strip().replace("\n", " ")[:80] or "New chat"
        await self.session_repository.set_title_if_missing(session, title=title)
        return user_message

    async def _handle_llm_turn(
        self,
        *,
        session,
        session_id: uuid.UUID,
        content: str,
        user_message,
        selected_model: str,
        images,
        effective_mode: ConversationMode,
        effective_template_id: CrewTemplateId | None,
    ):
        history = await self.message_repository.list_by_session(session_id)
        completion_history = select_completion_history(
            history=history,
            selected_model=selected_model,
        )
        orchestration_result = await self._prepare_orchestration(
            session=session,
            prompt=content,
            selected_model=selected_model,
            conversation_mode=effective_mode,
            crew_template_id=effective_template_id,
        )
        provider_history = build_provider_history(
            completion_history=completion_history,
            images=images,
            user_message_id=user_message.id,
        )

        turn_result = None
        if orchestration_result.enabled:
            turn_result = await self.agent_orchestration_service.execute_turn(
                session=session,
                prompt=content,
                selected_model=selected_model,
                conversation_mode=effective_mode,
                crew_template_id=effective_template_id,
                history=provider_history,
                images=images,
                trigger_message_id=user_message.id,
            )

        if turn_result is not None:
            llm_response = turn_result.response
            orchestration_metadata = {
                **orchestration_result.metadata,
                **turn_result.metadata,
            }
            orchestration_result.metadata = orchestration_metadata
        else:
            provider_messages = [*orchestration_result.system_messages, *provider_history]
            llm_response = await self.llm_provider.complete_chat(
                model=selected_model,
                messages=provider_messages,
            )
            orchestration_metadata = orchestration_result.metadata

        assistant_message = await self.message_repository.create_message(
            session_id=session_id,
            role=ChatMessageRole.ASSISTANT,
            content=llm_response.content,
            selected_model=selected_model,
            metadata={
                "provider": "ollama",
                "provider_metadata": llm_response.metadata,
                "orchestration": orchestration_metadata,
            },
        )
        await self.session_repository.touch_session(session)
        await self.db_session.flush()
        await self.db_session.refresh(session)
        await self.storage_guard_service.log_usage(context="store_assistant_message")

        return session, user_message, assistant_message, orchestration_result

    async def stream_response(
        self,
        *,
        session_id: uuid.UUID,
        content: str,
        selected_model: str,
        agent_mode: bool,
        roleplay_enabled: bool = False,
        image_asset_ids: list[uuid.UUID] | None = None,
        conversation_mode: ConversationMode | None = None,
        crew_template_id: CrewTemplateId | None = None,
    ) -> AsyncIterator[dict]:
        """Yield SSE-friendly event dicts for a chat turn.

        Emits ``meta`` once, then ``token`` deltas + ``done`` for the LLM path.
        Any upstream failure is surfaced as an ``error`` event and ends the stream.
        """

        validate_selected_model(selected_model, self.allowed_models)
        session = await self.require_session(session_id)
        await self.storage_guard_service.guard_database_size()
        await self.storage_guard_service.guard_message_creation(session_id=session_id)
        await self.image_asset_service.ensure_images_allowed_for_model(
            selected_model=selected_model,
            image_asset_ids=image_asset_ids or [],
        )
        images = await self.image_asset_service.load_images_for_completion(
            session_id=session_id,
            image_asset_ids=image_asset_ids or [],
        )

        user_message = await self._persist_user_message(
            session=session,
            content=content,
            selected_model=selected_model,
            agent_mode=agent_mode,
            roleplay_enabled=roleplay_enabled,
            image_asset_ids=image_asset_ids or [],
        )
        effective_mode, effective_template_id = resolve_turn_preferences(
            session=session,
            conversation_mode=conversation_mode,
            crew_template_id=crew_template_id,
            agent_mode=agent_mode,
            roleplay_enabled=roleplay_enabled,
        )
        session.conversation_mode = effective_mode
        session.crew_template_id = effective_template_id
        if not session.scene_state_json:
            session.scene_state_json = {}
        await self.session_repository.touch_session(session)
        await self.db_session.flush()
        await self.storage_guard_service.log_usage(context="store_user_message")

        yield {
            "type": "meta",
            "sessionId": str(session_id),
            "userMessage": _serialize_message(user_message),
        }

        try:
            history = await self.message_repository.list_by_session(session_id)
            completion_history = select_completion_history(
                history=history,
                selected_model=selected_model,
            )
            orchestration_result = await self._prepare_orchestration(
                session=session,
                prompt=content,
                selected_model=selected_model,
                conversation_mode=effective_mode,
                crew_template_id=effective_template_id,
            )
            provider_history = build_provider_history(
                completion_history=completion_history,
                images=images,
                user_message_id=user_message.id,
            )
            provider_messages = [*orchestration_result.system_messages, *provider_history]

            accumulated: list[str] = []
            if orchestration_result.enabled:
                turn_result = await self.agent_orchestration_service.execute_turn(
                    session=session,
                    prompt=content,
                    selected_model=selected_model,
                    conversation_mode=effective_mode,
                    crew_template_id=effective_template_id,
                    history=provider_history,
                    images=images,
                    trigger_message_id=user_message.id,
                )
                final_content = turn_result.response.content
                accumulated.append(final_content)
                yield {"type": "token", "content": final_content}
                provider_metadata = turn_result.response.metadata
                orchestration_metadata = {
                    **orchestration_result.metadata,
                    **turn_result.metadata,
                }
            else:
                async for delta in self.llm_provider.stream_chat_tokens(
                    model=selected_model,
                    messages=provider_messages,
                ):
                    accumulated.append(delta)
                    yield {"type": "token", "content": delta}
                provider_metadata = {"streamed": True}
                orchestration_metadata = orchestration_result.metadata

            final_content = "".join(accumulated)
            assistant_message = await self.message_repository.create_message(
                session_id=session_id,
                role=ChatMessageRole.ASSISTANT,
                content=final_content,
                selected_model=selected_model,
                metadata={
                    "provider": "ollama",
                    "provider_metadata": provider_metadata,
                    "orchestration": orchestration_metadata,
                },
            )
            await self.session_repository.touch_session(session)
            await self.db_session.flush()
            await self.db_session.refresh(session)
            await self.storage_guard_service.log_usage(context="store_assistant_message")

            orchestration_result.metadata = orchestration_metadata
            yield {
                "type": "done",
                "session": _serialize_session(session),
                "assistantMessage": _serialize_message(assistant_message),
                "orchestration": _serialize_orchestration(orchestration_result),
            }
        except LLMProviderUnavailableError as error:
            yield {
                "type": "error",
                "code": "llm_unavailable",
                "detail": str(error),
            }

    async def require_session(self, session_id: uuid.UUID):
        session = await self.session_repository.get_session(session_id)
        if session is None:
            raise ValueError("Chat session not found")
        return session

    async def _prepare_orchestration(
        self,
        *,
        session,
        prompt: str,
        selected_model: str,
        conversation_mode: ConversationMode,
        crew_template_id: CrewTemplateId | None,
    ):
        if conversation_mode == "regular":
            return AgentRoutingResult(
                enabled=False,
                mode="none",
                conversation_mode=conversation_mode,
                crew_template_id=None,
                metadata={
                    "conversation_mode": conversation_mode,
                    "crew_template_id": None,
                },
            )
        return await self.agent_orchestration_service.prepare_chat_request(
            session=session,
            prompt=prompt,
            selected_model=selected_model,
            conversation_mode=conversation_mode,
            crew_template_id=crew_template_id,
        )
