from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ConversationMode = Literal["regular", "roleplay", "task"]
CrewTemplateId = Literal[
    "roleplay-fantasy",
    "roleplay-debate",
    "research-assistant",
]

ROLEPLAY_DEFAULT_TEMPLATE_ID: CrewTemplateId = "roleplay-fantasy"
TASK_DEFAULT_TEMPLATE_ID: CrewTemplateId = "research-assistant"


@dataclass(frozen=True, slots=True)
class CrewTemplateDefinition:
    id: CrewTemplateId
    label: str
    description: str
    conversation_mode: ConversationMode
    process: Literal["sequential", "hierarchical"]
    participants: tuple[str, ...]
    system_prompt: str


CREW_TEMPLATES: tuple[CrewTemplateDefinition, ...] = (
    CrewTemplateDefinition(
        id="roleplay-fantasy",
        label="Fantasy Roleplay",
        description="Narrated scene with a strict single-turn output contract.",
        conversation_mode="roleplay",
        process="sequential",
        participants=("director", "character", "continuity editor"),
        system_prompt=(
            "You are coordinating a roleplay scene. Keep the cast consistent, preserve "
            "continuity, and produce only the next outward-facing assistant reply."
        ),
    ),
    CrewTemplateDefinition(
        id="roleplay-debate",
        label="Debate Roleplay",
        description="Structured back-and-forth dialogue with clear speaker discipline.",
        conversation_mode="roleplay",
        process="sequential",
        participants=("moderator", "speaker", "continuity editor"),
        system_prompt=(
            "You are coordinating a debate-style roleplay. Keep the exchange disciplined "
            "and return only the next assistant utterance."
        ),
    ),
    CrewTemplateDefinition(
        id="research-assistant",
        label="Research Assistant",
        description="Manager-led task workflow for research, planning, and synthesis.",
        conversation_mode="task",
        process="hierarchical",
        participants=("manager", "researcher", "analyst", "writer"),
        system_prompt=(
            "You are coordinating a task-oriented agent workflow. Plan clearly, keep the "
            "result grounded, and return a concise final answer with supporting structure."
        ),
    ),
)


def get_template(template_id: CrewTemplateId) -> CrewTemplateDefinition:
    for template in CREW_TEMPLATES:
        if template.id == template_id:
            return template
    raise ValueError(f"Unknown crew template '{template_id}'")


def default_template_for_mode(mode: ConversationMode) -> CrewTemplateDefinition | None:
    if mode == "roleplay":
        return get_template(ROLEPLAY_DEFAULT_TEMPLATE_ID)
    if mode == "task":
        return get_template(TASK_DEFAULT_TEMPLATE_ID)
    return None
