from typing import Any

from app.models import ChatSession
from app.services.agent_orchestration.base import AgentOrchestrationService, AgentRoutingResult
from app.services.agent_orchestration.templates import ConversationMode, CrewTemplateId


class NoOpAgentOrchestrator(AgentOrchestrationService):
    @property
    def enabled(self) -> bool:
        return False

    @property
    def mode(self) -> str:
        return "none"

    async def prepare_chat_request(
        self,
        *,
        session: ChatSession,
        prompt: str,
        selected_model: str,
        conversation_mode: ConversationMode,
        crew_template_id: CrewTemplateId | None,
    ) -> AgentRoutingResult:
        return AgentRoutingResult(
            enabled=False,
            mode=self.mode,
            conversation_mode=conversation_mode,
            crew_template_id=crew_template_id,
            metadata={
                "conversation_mode": conversation_mode,
                "crew_template_id": crew_template_id,
            },
        )

    async def demo_dispatch(self, *, prompt: str) -> dict[str, Any]:
        return {
            "enabled": False,
            "backend": self.mode,
            "message": "Experimental agent orchestration is disabled.",
            "prompt": prompt,
        }
