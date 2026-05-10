from typing import Any

from app.models import ChatSession
from app.services.agent_orchestration.base import AgentOrchestrationService, AgentRoutingResult
from app.services.agent_orchestration.templates import ConversationMode, CrewTemplateId
from app.services.llm.base import LLMChatMessage


class ExperimentalComposioOrchestrator(AgentOrchestrationService):
    """
    Placeholder adapter boundary for future ComposioHQ / agent-orchestrator usage.

    This implementation deliberately does not execute tools, create worktrees, or
    pretend to run a production multi-agent runtime inside the chat request path.
    """

    @property
    def enabled(self) -> bool:
        return True

    @property
    def mode(self) -> str:
        return "experimental-composio"

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
            enabled=True,
            mode=self.mode,
            conversation_mode=conversation_mode,
            crew_template_id=crew_template_id,
            system_messages=[
                LLMChatMessage(
                    role="system",
                    content=(
                        "Experimental agent orchestration mode is enabled. "
                        "No external actions or coding agents are executed yet; "
                        "this is only a routing boundary for future integration."
                    ),
                )
            ],
            metadata={
                "conversation_mode": conversation_mode,
                "crew_template_id": crew_template_id,
                "todo": (
                    "Integrate ComposioHQ agent-orchestrator for explicit, opt-in "
                    "coding-agent workflows outside the core chat runtime."
                ),
            },
        )

    async def demo_dispatch(self, *, prompt: str) -> dict[str, Any]:
        return {
            "enabled": True,
            "backend": self.mode,
            "message": (
                "This is a dev-only placeholder. A future adapter can map this prompt "
                "into an explicit orchestration request without coupling the chat runtime "
                "to coding-agent workflows."
            ),
            "prompt": prompt,
        }
