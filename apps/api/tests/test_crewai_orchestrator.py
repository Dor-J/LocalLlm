from __future__ import annotations

import sys
from dataclasses import dataclass, field
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.agent_orchestration.crewai import CrewAIOrchestrator


@dataclass
class FakeSession:
    id: object
    title: str | None = "Task session"
    conversation_mode: str = "task"
    crew_template_id: str | None = "research-assistant"
    scene_state_json: dict = field(default_factory=lambda: {"scene": "alpha"})


class FakeLLMProvider:
    async def ensure_model_available(self, *, model):
        return None

    async def complete_chat(self, *, model, messages):
        raise AssertionError("task mode should use the CrewAI runtime path")


@dataclass
class FakeRun:
    id: object


@dataclass
class FakeStep:
    run_id: object
    step_index: int
    role: str
    status: str
    input_text: str | None
    output_text: str | None
    metadata: dict


class FakeRepository:
    def __init__(self) -> None:
        self.run: FakeRun | None = None
        self.steps: list[FakeStep] = []
        self.completed_status: str | None = None
        self.completed_metadata: dict | None = None

    async def create_run(self, **kwargs):
        self.run = FakeRun(id=uuid4())
        return self.run

    async def mark_run_completed(
        self, run, *, status="completed", metadata=None, completed_at=None
    ):
        self.completed_status = status
        self.completed_metadata = metadata or {}
        return run

    async def create_step(self, **kwargs):
        step = FakeStep(**kwargs)
        self.steps.append(step)
        return step

    async def list_runs_for_session(self, session_id):
        return [self.run] if self.run else []

    async def get_run(self, run_id):
        return self.run

    async def list_steps_for_run(self, run_id):
        return self.steps


def install_fake_crewai(monkeypatch):
    class FakeLLM:
        def __init__(self, *, model, base_url, api_key):
            self.model = model
            self.base_url = base_url
            self.api_key = api_key

    class FakeAgent:
        def __init__(self, *, role, goal, backstory, llm, verbose, allow_delegation=False):
            self.role = role
            self.goal = goal
            self.backstory = backstory
            self.llm = llm
            self.verbose = verbose
            self.allow_delegation = allow_delegation

    class FakeTask:
        def __init__(self, *, description, expected_output, agent):
            self.description = description
            self.expected_output = expected_output
            self.agent = agent
            self.output = None

    class FakeCrew:
        def __init__(self, *, agents, tasks, process, manager_llm, verbose):
            self.agents = agents
            self.tasks = tasks
            self.process = process
            self.manager_llm = manager_llm
            self.verbose = verbose

        def kickoff(self, *, inputs):
            outputs = []
            for task in self.tasks:
                output = SimpleNamespace(raw=f"{task.agent.role}: {inputs['prompt']}")
                task.output = output
                outputs.append(output)
            return SimpleNamespace(
                raw="Crew final answer",
                tasks_output=outputs,
                usage_metrics={"prompt_tokens": 12, "completion_tokens": 24},
            )

    fake_module = SimpleNamespace(
        Agent=FakeAgent,
        Crew=FakeCrew,
        LLM=FakeLLM,
        Task=FakeTask,
        Process=SimpleNamespace(hierarchical="hierarchical"),
    )
    monkeypatch.setitem(sys.modules, "crewai", fake_module)
    return fake_module


@pytest.mark.asyncio
async def test_task_mode_uses_crewai_and_persists_steps(monkeypatch) -> None:
    install_fake_crewai(monkeypatch)

    session = FakeSession(id=uuid4())
    orchestrator = CrewAIOrchestrator(db_session=SimpleNamespace(), llm_provider=FakeLLMProvider())
    repo = FakeRepository()
    orchestrator.orchestration_repository = repo

    result = await orchestrator.execute_turn(
        session=session,
        prompt="Plan the release",
        selected_model="qwen3.5:2b",
        conversation_mode="task",
        crew_template_id="research-assistant",
        history=[],
        images=[],
        trigger_message_id=None,
    )

    assert result is not None
    assert result.response.content == "Crew final answer"
    assert result.metadata["runtime"] == "crewai-task"
    assert result.metadata["step_count"] == 4
    assert repo.completed_status == "completed"
    assert len(repo.steps) == 4
    assert repo.steps[0].role == "manager"
    assert repo.steps[-1].output_text == "writer: Plan the release"
