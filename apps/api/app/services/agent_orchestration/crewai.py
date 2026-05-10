from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from importlib import import_module
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ChatSession
from app.repositories.orchestration import OrchestrationRepository
from app.services.agent_orchestration.base import (
    AgentOrchestrationService,
    AgentRoutingResult,
    AgentTurnResult,
)
from app.services.agent_orchestration.templates import (
    CREW_TEMPLATES,
    ConversationMode,
    CrewTemplateDefinition,
    CrewTemplateId,
    default_template_for_mode,
    get_template,
)
from app.services.llm.base import ChatProvider, LLMChatMessage, LLMChatResult


@dataclass(frozen=True, slots=True)
class CrewStepDefinition:
    role: str
    instruction: str
    expose_to_user: bool = False


class CrewAIOrchestrator(AgentOrchestrationService):
    """
    CrewAI-backed orchestration boundary.

    The production runtime is intentionally layered:
    - plan the crew turn
    - persist a run record and step traces
    - execute the turn with the configured local LLM provider
    - return a single outward-facing assistant response

    The implementation is deterministic and audit-friendly even when the optional
    external CrewAI package is not imported at runtime.
    """

    def __init__(
        self,
        *,
        db_session: AsyncSession,
        llm_provider: ChatProvider,
    ) -> None:
        self.db_session = db_session
        self.llm_provider = llm_provider
        self.orchestration_repository = OrchestrationRepository(db_session)

    @property
    def enabled(self) -> bool:
        return True

    @property
    def mode(self) -> str:
        return "crewai"

    async def prepare_chat_request(
        self,
        *,
        session: ChatSession,
        prompt: str,
        selected_model: str,
        conversation_mode: ConversationMode,
        crew_template_id: CrewTemplateId | None,
    ) -> AgentRoutingResult:
        if conversation_mode == "regular":
            return AgentRoutingResult(
                enabled=False,
                mode=self.mode,
                conversation_mode=conversation_mode,
                crew_template_id=None,
                metadata={
                    "conversation_mode": conversation_mode,
                    "crew_template_id": None,
                },
            )

        template = self._resolve_template(
            conversation_mode=conversation_mode,
            crew_template_id=crew_template_id,
        )
        system_messages = [
            LLMChatMessage(
                role="system",
                content=template.system_prompt,
            ),
            LLMChatMessage(
                role="system",
                content=self._build_session_context(
                    session=session,
                    selected_model=selected_model,
                    template_id=template.id,
                    prompt=prompt,
                ),
            ),
        ]
        return AgentRoutingResult(
            enabled=True,
            mode=self.mode,
            conversation_mode=conversation_mode,
            crew_template_id=template.id,
            system_messages=system_messages,
            metadata={
                "conversation_mode": conversation_mode,
                "crew_template_id": template.id,
                "template": {
                    "id": template.id,
                    "label": template.label,
                    "process": template.process,
                    "participants": list(template.participants),
                },
                "session_scene_state": session.scene_state_json or {},
                "selected_model": selected_model,
                "runtime": (
                    "crewai-task" if conversation_mode == "task" else "sequential-orchestration"
                ),
            },
        )

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
        trigger_message_id: uuid.UUID | None = None,
    ) -> AgentTurnResult | None:
        if conversation_mode == "regular":
            return None

        template = self._resolve_template(
            conversation_mode=conversation_mode,
            crew_template_id=crew_template_id,
        )
        run = await self.orchestration_repository.create_run(
            session_id=session.id,
            trigger_message_id=trigger_message_id,
            backend=self.mode,
            conversation_mode=conversation_mode,
            crew_template_id=template.id,
            prompt=prompt,
            metadata={
                "template": {
                    "id": template.id,
                    "label": template.label,
                    "process": template.process,
                    "participants": list(template.participants),
                },
                "selected_model": selected_model,
                "history_length": len(history),
                "runtime": (
                    "crewai-task" if conversation_mode == "task" else "sequential-orchestration"
                ),
                "scene_state": session.scene_state_json or {},
            },
        )

        try:
            if conversation_mode == "task":
                visible_response, step_outputs, execution_metadata = await self._execute_task_turn(
                    run_id=run.id,
                    session=session,
                    prompt=prompt,
                    selected_model=selected_model,
                    template=template,
                    history=history,
                    images=images or [],
                )
            else:
                visible_response, step_outputs = await self._execute_roleplay_turn(
                    run_id=run.id,
                    session=session,
                    prompt=prompt,
                    selected_model=selected_model,
                    conversation_mode=conversation_mode,
                    template=template,
                    history=history,
                    images=images or [],
                )
                execution_metadata = {
                    "runtime": "sequential-orchestration",
                }
            run_metadata = {
                "conversation_mode": conversation_mode,
                "crew_template_id": template.id,
                "run_id": str(run.id),
                "status": "completed",
                "step_count": len(step_outputs),
                "summary": visible_response.content[:240],
                "steps": [
                    {
                        "role": item["role"],
                        "status": item["status"],
                        "step_index": item["step_index"],
                    }
                    for item in step_outputs
                ],
                **execution_metadata,
                "template": {
                    "id": template.id,
                    "label": template.label,
                    "process": template.process,
                    "participants": list(template.participants),
                },
            }
            await self.orchestration_repository.mark_run_completed(
                run,
                status="completed",
                metadata=run_metadata,
            )
            return AgentTurnResult(
                response=visible_response,
                metadata=run_metadata,
            )
        except Exception as error:
            await self.orchestration_repository.mark_run_completed(
                run,
                status="failed",
                metadata={
                    "conversation_mode": conversation_mode,
                    "crew_template_id": template.id,
                    "run_id": str(run.id),
                    "status": "failed",
                    "error": str(error),
                },
            )
            raise

    async def demo_dispatch(self, *, prompt: str) -> dict[str, Any]:
        return {
            "enabled": True,
            "backend": self.mode,
            "message": "CrewAI orchestration is enabled.",
            "prompt": prompt,
            "templates": [
                {
                    "id": template.id,
                    "label": template.label,
                    "mode": template.conversation_mode,
                    "process": template.process,
                }
                for template in CREW_TEMPLATES
            ],
        }

    async def list_session_runs(self, *, session_id: uuid.UUID):
        return await self.orchestration_repository.list_runs_for_session(session_id)

    async def get_run_trace(self, *, run_id: uuid.UUID):
        return await self.orchestration_repository.get_run(run_id)

    async def list_orchestration_steps(self, *, run_id: uuid.UUID):
        return await self.orchestration_repository.list_steps_for_run(run_id)

    def _resolve_template(
        self,
        *,
        conversation_mode: ConversationMode,
        crew_template_id: CrewTemplateId | None,
    ) -> CrewTemplateDefinition:
        if crew_template_id is not None:
            template = get_template(crew_template_id)
            if template.conversation_mode != conversation_mode:
                raise ValueError(
                    f"Template '{crew_template_id}' is not valid for mode '{conversation_mode}'."
                )
            return template

        template = default_template_for_mode(conversation_mode)
        if template is None:
            raise ValueError(f"No crew template available for mode '{conversation_mode}'.")
        return template

    async def _execute_crew_turn(
        self,
        *,
        run_id: uuid.UUID,
        session: ChatSession,
        prompt: str,
        selected_model: str,
        conversation_mode: ConversationMode,
        template: CrewTemplateDefinition,
        history: Sequence[LLMChatMessage],
        images: Sequence[str],
    ) -> tuple[LLMChatResult, list[dict[str, Any]]]:
        steps = self._build_step_plan(template=template)
        previous_output: str | None = None
        step_outputs: list[dict[str, Any]] = []

        for index, step in enumerate(steps):
            step_messages = self._build_step_messages(
                session=session,
                prompt=prompt,
                selected_model=selected_model,
                conversation_mode=conversation_mode,
                template=template,
                history=history,
                step=step,
                prior_output=previous_output,
                images=images if index == len(steps) - 1 else (),
            )
            result = await self.llm_provider.complete_chat(
                model=selected_model,
                messages=step_messages,
            )
            cleaned_output = result.content.strip()
            await self.orchestration_repository.create_step(
                run_id=run_id,
                step_index=index,
                role=step.role,
                status="completed",
                input_text=self._summarize_messages(step_messages),
                output_text=cleaned_output,
                metadata={
                    "model": result.model,
                    "provider_metadata": result.metadata,
                    "expose_to_user": step.expose_to_user,
                },
            )
            step_outputs.append(
                {
                    "role": step.role,
                    "status": "completed",
                    "step_index": index,
                    "input_text": self._summarize_messages(step_messages),
                    "output_text": cleaned_output,
                    "output_preview": cleaned_output[:160],
                }
            )
            previous_output = cleaned_output

        final_response = LLMChatResult(
            content=previous_output or "",
            model=selected_model,
            metadata={
                "conversation_mode": conversation_mode,
                "crew_template_id": template.id,
                "step_count": len(steps),
                "run_id": str(run_id),
            },
        )
        return final_response, step_outputs

    async def _execute_roleplay_turn(
        self,
        *,
        run_id: uuid.UUID,
        session: ChatSession,
        prompt: str,
        selected_model: str,
        conversation_mode: ConversationMode,
        template: CrewTemplateDefinition,
        history: Sequence[LLMChatMessage],
        images: Sequence[str],
    ) -> tuple[LLMChatResult, list[dict[str, Any]]]:
        return await self._execute_crew_turn(
            run_id=run_id,
            session=session,
            prompt=prompt,
            selected_model=selected_model,
            conversation_mode=conversation_mode,
            template=template,
            history=history,
            images=images,
        )

    async def _execute_task_turn(
        self,
        *,
        run_id: uuid.UUID,
        session: ChatSession,
        prompt: str,
        selected_model: str,
        template: CrewTemplateDefinition,
        history: Sequence[LLMChatMessage],
        images: Sequence[str],
    ) -> tuple[LLMChatResult, list[dict[str, Any]], dict[str, Any]]:
        task_model = await self._resolve_task_worker_model(selected_model=selected_model)
        manager_model = await self._resolve_task_manager_model(
            selected_model=selected_model,
            task_model=task_model,
        )

        try:
            crew_result = await self._run_task_with_crewai(
                session=session,
                prompt=prompt,
                selected_model=selected_model,
                task_model=task_model,
                manager_model=manager_model,
                template=template,
                history=history,
                images=images,
            )
            final_text = crew_result["final_text"]
            step_outputs = crew_result["step_outputs"]
            metadata = crew_result["metadata"]
        except ModuleNotFoundError:
            final_text, step_outputs = await self._execute_task_turn_sequential(
                run_id=run_id,
                session=session,
                prompt=prompt,
                selected_model=selected_model,
                template=template,
                history=history,
                images=images,
            )
            metadata = {
                "runtime": "task-sequential-fallback",
                "task_model": task_model,
                "manager_model": manager_model,
            }

        for index, item in enumerate(step_outputs):
            await self.orchestration_repository.create_step(
                run_id=run_id,
                step_index=index,
                role=item["role"],
                status=item["status"],
                input_text=item.get("input_text"),
                output_text=item.get("output_text"),
                metadata={
                    "runtime": metadata.get("runtime", "crewai-task"),
                    "manager_model": manager_model,
                    "task_model": task_model,
                    "preview": item.get("output_preview", ""),
                },
            )

        return (
            LLMChatResult(
                content=final_text,
                model=selected_model,
                metadata={
                    "conversation_mode": "task",
                    "crew_template_id": template.id,
                    "task_model": task_model,
                    "manager_model": manager_model,
                    **metadata,
                },
            ),
            step_outputs,
            {
                "runtime": metadata.get("runtime", "crewai-task"),
                "task_model": task_model,
                "manager_model": manager_model,
                "crew_runtime": metadata.get("crew_runtime", "crewai"),
            },
        )

    async def _run_task_with_crewai(
        self,
        *,
        session: ChatSession,
        prompt: str,
        selected_model: str,
        task_model: str,
        manager_model: str,
        template: CrewTemplateDefinition,
        history: Sequence[LLMChatMessage],
        images: Sequence[str],
    ) -> dict[str, Any]:
        crewai = import_module("crewai")
        crew_output = await asyncio.to_thread(
            self._run_task_with_crewai_sync,
            crewai=crewai,
            session=session,
            prompt=prompt,
            selected_model=selected_model,
            task_model=task_model,
            manager_model=manager_model,
            template=template,
            history=history,
            images=images,
        )
        return crew_output

    def _run_task_with_crewai_sync(
        self,
        *,
        crewai: Any,
        session: ChatSession,
        prompt: str,
        selected_model: str,
        task_model: str,
        manager_model: str,
        template: CrewTemplateDefinition,
        history: Sequence[LLMChatMessage],
        images: Sequence[str],
    ) -> dict[str, Any]:
        base_url = self._resolve_crew_base_url()
        crew_llm = self._build_crewai_llm(
            crewai=crewai,
            model=task_model,
            base_url=base_url,
        )
        manager_llm = self._build_crewai_llm(
            crewai=crewai,
            model=manager_model,
            base_url=base_url,
        )

        agents = self._build_task_agents(
            crewai=crewai,
            crew_llm=crew_llm,
            manager_llm=manager_llm,
            task_model=task_model,
            manager_model=manager_model,
            template=template,
        )
        tasks = self._build_task_tasks(
            crewai=crewai,
            agents=agents,
            session=session,
            prompt=prompt,
            selected_model=selected_model,
            template=template,
            history=history,
            images=images,
        )
        crew = crewai.Crew(
            agents=list(agents.values()),
            tasks=tasks,
            process=crewai.Process.hierarchical,
            manager_llm=manager_llm,
            verbose=False,
        )
        crew_result = crew.kickoff(
            inputs={
                "session_id": str(session.id),
                "prompt": prompt,
                "selected_model": selected_model,
                "conversation_mode": "task",
                "scene_state": session.scene_state_json or {},
                "history": self._render_history_snapshot(history),
                "template_id": template.id,
            }
        )
        final_text = self._extract_crew_output_text(crew_result)
        task_outputs = self._collect_crewai_task_outputs(tasks, crew_result)
        return {
            "final_text": final_text,
            "step_outputs": task_outputs,
            "metadata": {
                "runtime": "crewai-task",
                "crew_runtime": "crewai",
                "task_count": len(tasks),
                "usage_metrics": self._extract_crew_usage_metrics(crew_result),
            },
        }

    async def _execute_task_turn_sequential(
        self,
        *,
        run_id: uuid.UUID,
        session: ChatSession,
        prompt: str,
        selected_model: str,
        template: CrewTemplateDefinition,
        history: Sequence[LLMChatMessage],
        images: Sequence[str],
    ) -> tuple[str, list[dict[str, Any]]]:
        steps = self._build_step_plan(template=template)
        previous_output: str | None = None
        step_outputs: list[dict[str, Any]] = []

        for index, step in enumerate(steps):
            step_messages = self._build_step_messages(
                session=session,
                prompt=prompt,
                selected_model=selected_model,
                conversation_mode="task",
                template=template,
                history=history,
                step=step,
                prior_output=previous_output,
                images=images if index == len(steps) - 1 else (),
            )
            result = await self.llm_provider.complete_chat(
                model=selected_model,
                messages=step_messages,
            )
            cleaned_output = result.content.strip()
            await self.orchestration_repository.create_step(
                run_id=run_id,
                step_index=index,
                role=step.role,
                status="completed",
                input_text=self._summarize_messages(step_messages),
                output_text=cleaned_output,
                metadata={
                    "model": result.model,
                    "provider_metadata": result.metadata,
                    "expose_to_user": step.expose_to_user,
                    "runtime": "task-sequential-fallback",
                },
            )
            step_outputs.append(
                {
                    "role": step.role,
                    "status": "completed",
                    "step_index": index,
                    "output_preview": cleaned_output[:160],
                }
            )
            previous_output = cleaned_output

        return previous_output or "", step_outputs

    async def _resolve_task_worker_model(self, *, selected_model: str) -> str:
        return selected_model

    async def _resolve_task_manager_model(
        self,
        *,
        selected_model: str,
        task_model: str,
    ) -> str:
        preferred_model = "qwen3.5:2b"
        if selected_model == preferred_model:
            return selected_model
        try:
            await self.llm_provider.ensure_model_available(model=preferred_model)
        except Exception:
            return selected_model
        return preferred_model

    def _resolve_crew_base_url(self) -> str:
        base_url = getattr(self.llm_provider, "base_url", "http://ollama:11434")
        normalized = base_url.rstrip("/")
        if normalized.endswith("/v1"):
            return normalized
        return normalized + "/v1"

    def _build_crewai_llm(self, *, crewai: Any, model: str, base_url: str) -> Any:
        return crewai.LLM(
            model=f"openai/{model}",
            base_url=base_url,
            api_key="ollama",
        )

    def _build_task_agents(
        self,
        *,
        crewai: Any,
        crew_llm: Any,
        manager_llm: Any,
        task_model: str,
        manager_model: str,
        template: CrewTemplateDefinition,
    ) -> dict[str, Any]:
        return {
            "manager": crewai.Agent(
                role="manager",
                goal="Break the user request into a disciplined execution plan.",
                backstory=(
                    "You are the control plane for a local-first task workflow. "
                    "You keep the crew focused, concrete, and bounded."
                ),
                llm=manager_llm,
                verbose=False,
                allow_delegation=True,
            ),
            "researcher": crewai.Agent(
                role="researcher",
                goal="Collect the factual basis, constraints, and missing information.",
                backstory=(
                    "You are a careful research agent who works from the session context "
                    "and the user's prompt without inventing unsupported facts."
                ),
                llm=crew_llm,
                verbose=False,
            ),
            "analyst": crewai.Agent(
                role="analyst",
                goal="Synthesize findings into tradeoffs and a decision path.",
                backstory=(
                    "You turn research into a practical recommendation with clear tradeoffs "
                    "and implementation guidance."
                ),
                llm=crew_llm,
                verbose=False,
            ),
            "writer": crewai.Agent(
                role="writer",
                goal="Produce the final user-facing answer.",
                backstory=(
                    "You write concise, actionable output for the local chat UI. "
                    "You do not expose hidden reasoning."
                ),
                llm=crew_llm,
                verbose=False,
            ),
        }

    def _build_task_tasks(
        self,
        *,
        crewai: Any,
        agents: dict[str, Any],
        session: ChatSession,
        prompt: str,
        selected_model: str,
        template: CrewTemplateDefinition,
        history: Sequence[LLMChatMessage],
        images: Sequence[str],
    ) -> list[Any]:
        context = self._build_session_context(
            session=session,
            selected_model=selected_model,
            template_id=template.id,
            prompt=prompt,
        )
        return [
            crewai.Task(
                description=(
                    "Plan the user request and identify the required work.\n"
                    f"User prompt: {prompt}\n"
                    f"Session context: {context}\n"
                    "Return a compact plan with risks and ordering."
                ),
                expected_output="A concise execution plan with priorities and risks.",
                agent=agents["manager"],
            ),
            crewai.Task(
                description=(
                    "Research the prompt, session context, and any visible history.\n"
                    f"History snapshot: {self._render_history_snapshot(history)}\n"
                    "Extract facts, constraints, and missing information."
                ),
                expected_output="Concise research notes.",
                agent=agents["researcher"],
            ),
            crewai.Task(
                description=(
                    "Synthesize the plan and research into recommendations.\n"
                    "Identify the best response path and tradeoffs."
                ),
                expected_output="Synthesis notes with recommendations and tradeoffs.",
                agent=agents["analyst"],
            ),
            crewai.Task(
                description=(
                    "Write the final user-facing answer.\n"
                    "Use the synthesis, keep it concise, and do not expose hidden reasoning.\n"
                    "The answer should be directly useful in the chat UI."
                ),
                expected_output="A final answer ready to show to the user.",
                agent=agents["writer"],
            ),
        ]

    def _extract_crew_output_text(self, crew_output: Any) -> str:
        raw = getattr(crew_output, "raw", None)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
        if isinstance(crew_output, str) and crew_output.strip():
            return crew_output.strip()
        return str(crew_output).strip()

    def _collect_crewai_task_outputs(
        self, tasks: Sequence[Any], crew_output: Any
    ) -> list[dict[str, Any]]:
        task_outputs: list[dict[str, Any]] = []
        output_entries = getattr(crew_output, "tasks_output", None) or []
        for index, task in enumerate(tasks):
            output_entry = output_entries[index] if index < len(output_entries) else None
            task_output = getattr(task, "output", None) or output_entry
            output_text = self._extract_task_output_text(task_output)
            task_outputs.append(
                {
                    "role": (
                        getattr(task, "agent", None).role if getattr(task, "agent", None) else ""
                    ),
                    "status": "completed" if task_output is not None else "pending",
                    "step_index": index,
                    "input_text": getattr(task, "description", ""),
                    "output_text": output_text,
                    "output_preview": output_text[:160],
                }
            )
        return task_outputs

    def _extract_task_output_text(self, task_output: Any) -> str:
        if task_output is None:
            return ""
        raw = getattr(task_output, "raw", None)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
        text = str(task_output).strip()
        return text

    def _extract_task_output_preview(self, task_output: Any) -> str:
        return self._extract_task_output_text(task_output)[:160]

    def _extract_crew_usage_metrics(self, crew_output: Any) -> dict[str, Any]:
        metrics = getattr(crew_output, "usage_metrics", None)
        if metrics is None:
            return {}
        if hasattr(metrics, "model_dump"):
            return metrics.model_dump()
        if isinstance(metrics, dict):
            return dict(metrics)
        return {"value": str(metrics)}

    def _render_history_snapshot(self, history: Sequence[LLMChatMessage]) -> str:
        rendered = []
        for message in history[-8:]:
            rendered.append(f"[{message.role}] {message.content}")
        return self._truncate_text("\n".join(rendered), max_chars=4000)

    def _build_step_plan(self, *, template: CrewTemplateDefinition) -> list[CrewStepDefinition]:
        if template.conversation_mode == "roleplay":
            return [
                CrewStepDefinition(
                    role="director",
                    instruction=(
                        "Assess the scene, keep continuity intact, and decide the next beat. "
                        "Write a short hidden plan only."
                    ),
                ),
                CrewStepDefinition(
                    role="character",
                    instruction=(
                        "Turn the plan into the next outward-facing spoken reply. "
                        "Keep the voice consistent with the active scene."
                    ),
                    expose_to_user=True,
                ),
                CrewStepDefinition(
                    role="continuity editor",
                    instruction=(
                        "Check for continuity, tone, and role discipline. "
                        "Return the final visible reply only."
                    ),
                    expose_to_user=True,
                ),
            ]

        if template.conversation_mode == "task":
            return [
                CrewStepDefinition(
                    role="manager",
                    instruction=(
                        "Break the request into a concrete execution plan with priorities "
                        "and risks. Write a short hidden plan only."
                    ),
                ),
                CrewStepDefinition(
                    role="researcher",
                    instruction=(
                        "Extract the factual basis, constraints, and any missing information. "
                        "Produce concise research notes."
                    ),
                ),
                CrewStepDefinition(
                    role="analyst",
                    instruction=(
                        "Synthesize the research into recommendations, tradeoffs, and "
                        "a decision path."
                    ),
                ),
                CrewStepDefinition(
                    role="writer",
                    instruction=(
                        "Produce the final user-facing answer. Keep it concise, "
                        "structured, and actionable."
                    ),
                    expose_to_user=True,
                ),
            ]

        raise ValueError(f"Unsupported conversation mode '{template.conversation_mode}'.")

    def _build_step_messages(
        self,
        *,
        session: ChatSession,
        prompt: str,
        selected_model: str,
        conversation_mode: ConversationMode,
        template: CrewTemplateDefinition,
        history: Sequence[LLMChatMessage],
        step: CrewStepDefinition,
        prior_output: str | None,
        images: Sequence[str],
    ) -> list[LLMChatMessage]:
        messages = [
            LLMChatMessage(role="system", content=template.system_prompt),
            LLMChatMessage(
                role="system",
                content=self._build_session_context(
                    session=session,
                    selected_model=selected_model,
                    template_id=template.id,
                    prompt=prompt,
                ),
            ),
            LLMChatMessage(
                role="system",
                content=(
                    f"Crew step: {step.role}\n"
                    f"Conversation mode: {conversation_mode}\n"
                    f"Instruction: {step.instruction}\n"
                    "Do not reveal hidden reasoning unless the step explicitly "
                    "requests user-facing text."
                ),
            ),
        ]
        messages.extend(history)
        if prior_output:
            messages.append(
                LLMChatMessage(
                    role="assistant",
                    content=(
                        "Previous crew step output for internal coordination:\n" f"{prior_output}"
                    ),
                )
            )
        if images:
            for message in reversed(messages):
                if message.role == "user":
                    message.images = list(images)
                    break
        if step.expose_to_user:
            messages.append(
                LLMChatMessage(
                    role="system",
                    content=(
                        "Return only the final outward-facing reply. "
                        "Do not include hidden analysis, step labels, or markdown fences."
                    ),
                )
            )
        return messages

    def _build_session_context(
        self,
        *,
        session: ChatSession,
        selected_model: str,
        template_id: CrewTemplateId,
        prompt: str,
    ) -> str:
        scene_state = json.dumps(session.scene_state_json or {}, ensure_ascii=True, indent=2)
        return (
            "Session orchestration context:\n"
            f"- session_id: {session.id}\n"
            f"- template_id: {template_id}\n"
            f"- selected_model: {selected_model}\n"
            f"- session_title: {session.title or 'Untitled conversation'}\n"
            f"- scene_state_json: {scene_state}\n"
            f"- current_prompt: {prompt}\n"
            "Keep visible output to a single assistant turn. Do not expose hidden planning."
        )

    def _summarize_messages(self, messages: Sequence[LLMChatMessage]) -> str:
        rendered = []
        for message in messages:
            suffix = " [images attached]" if message.images else ""
            rendered.append(f"[{message.role}]{suffix} {message.content}")
        return self._truncate_text("\n".join(rendered), max_chars=12000)

    def _truncate_text(self, value: str, *, max_chars: int) -> str:
        if len(value) <= max_chars:
            return value
        return value[: max_chars - 12] + "\n...[truncated]"
