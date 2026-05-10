"""Pure helpers that resolve conversation-mode and crew-template preferences.

These used to live as private methods on ``ChatService``. Extracting them
makes them trivially testable and keeps ``ChatService.generate_response``
under the ~80-line target.
"""

from __future__ import annotations

from app.services.agent_orchestration.templates import (
    ConversationMode,
    CrewTemplateId,
    default_template_for_mode,
    get_template,
)


def resolve_turn_preferences(
    *,
    session,
    conversation_mode: ConversationMode | None,
    crew_template_id: CrewTemplateId | None,
    agent_mode: bool,
    roleplay_enabled: bool,
) -> tuple[ConversationMode, CrewTemplateId | None]:
    """Return the ``(mode, template)`` to use for the current turn.

    Precedence:
    1. Explicit ``conversation_mode`` from the request payload.
    2. Otherwise, upgrade ``regular`` -> ``roleplay`` when the client asked
       for agent/roleplay.
    3. Template resolution falls back to the default template for the mode
       when none is provided or when the provided one is inconsistent.
    """

    effective_mode: ConversationMode = session.conversation_mode or "regular"
    effective_template_id: CrewTemplateId | None = session.crew_template_id

    if conversation_mode is not None:
        effective_mode = conversation_mode
    elif (agent_mode or roleplay_enabled) and effective_mode == "regular":
        effective_mode = "roleplay"

    if crew_template_id is not None:
        effective_template_id = crew_template_id
    elif effective_template_id is None:
        default_template = default_template_for_mode(effective_mode)
        if default_template is not None:
            effective_template_id = default_template.id
    else:
        template = get_template(effective_template_id)
        if template.conversation_mode != effective_mode:
            default_template = default_template_for_mode(effective_mode)
            effective_template_id = default_template.id if default_template else None

    if effective_mode == "regular":
        effective_template_id = None

    return effective_mode, effective_template_id


def normalize_session_preferences(
    *,
    conversation_mode: ConversationMode,
    crew_template_id: CrewTemplateId | None,
) -> tuple[ConversationMode, CrewTemplateId | None]:
    """Pick a consistent ``(mode, template)`` pair for ``create_session``."""

    if conversation_mode == "regular":
        return "regular", None

    if crew_template_id is not None:
        template = get_template(crew_template_id)
        if template.conversation_mode != conversation_mode:
            default_template = default_template_for_mode(conversation_mode)
            return (
                conversation_mode,
                default_template.id if default_template is not None else None,
            )
        return conversation_mode, crew_template_id

    default_template = default_template_for_mode(conversation_mode)
    return (
        conversation_mode,
        default_template.id if default_template is not None else None,
    )
