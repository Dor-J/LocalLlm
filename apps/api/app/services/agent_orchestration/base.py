from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.models import ChatSession
from app.services.agent_orchestration.templates import ConversationMode, CrewTemplateId
from app.services.llm.base import LLMChatMessage, LLMChatResult


@dataclass(slots=True)
class AgentRoutingResult:
    enabled: bool
    mode: str
    conversation_mode: ConversationMode
    crew_template_id: CrewTemplateId | None = None
    system_messages: list[LLMChatMessage] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class AgentTurnResult:
    response: LLMChatResult
    metadata: dict[str, Any] = field(default_factory=dict)


class AgentOrchestrationService(ABC):
    @property
    @abstractmethod
    def enabled(self) -> bool:
        raise NotImplementedError

    @property
    @abstractmethod
    def mode(self) -> str:
        raise NotImplementedError

    @abstractmethod
    async def prepare_chat_request(
        self,
        *,
        session: ChatSession,
        prompt: str,
        selected_model: str,
        conversation_mode: ConversationMode,
        crew_template_id: CrewTemplateId | None,
    ) -> AgentRoutingResult:
        raise NotImplementedError

    async def execute_turn(
        self,
        *,
        session: ChatSession,
        prompt: str,
        selected_model: str,
        conversation_mode: ConversationMode,
        crew_template_id: CrewTemplateId | None,
        history: list[LLMChatMessage],
        images: list[str] | None = None,
        trigger_message_id: Any | None = None,
    ) -> AgentTurnResult | None:
        return None

    async def list_session_runs(self, *, session_id: Any) -> list[Any]:
        return []

    async def get_run_trace(self, *, run_id: Any) -> Any | None:
        return None

    @abstractmethod
    async def demo_dispatch(self, *, prompt: str) -> dict[str, Any]:
        raise NotImplementedError
