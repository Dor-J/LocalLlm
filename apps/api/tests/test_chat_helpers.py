"""Unit tests for the small helpers extracted from ``ChatService`` (P1-API-01)."""

from __future__ import annotations

from uuid import uuid4

from app.services.chat import (
    build_provider_history,
    normalize_session_preferences,
    resolve_turn_preferences,
    select_completion_history,
)
from tests.fakes import FakeMessage, FakeSession


def test_resolve_turn_preferences_upgrades_regular_on_agent_mode() -> None:
    session = FakeSession(id=uuid4(), conversation_mode="regular", crew_template_id=None)

    mode, template_id = resolve_turn_preferences(
        session=session,
        conversation_mode=None,
        crew_template_id=None,
        agent_mode=True,
        roleplay_enabled=False,
    )

    assert mode == "roleplay"
    assert template_id is not None


def test_resolve_turn_preferences_regular_clears_template() -> None:
    session = FakeSession(
        id=uuid4(), conversation_mode="roleplay", crew_template_id="roleplay-fantasy"
    )

    mode, template_id = resolve_turn_preferences(
        session=session,
        conversation_mode="regular",
        crew_template_id=None,
        agent_mode=False,
        roleplay_enabled=False,
    )

    assert mode == "regular"
    assert template_id is None


def test_normalize_session_preferences_regular_clears_template() -> None:
    mode, template_id = normalize_session_preferences(
        conversation_mode="regular",
        crew_template_id="roleplay-fantasy",
    )

    assert mode == "regular"
    assert template_id is None


def test_select_completion_history_trims_on_model_switch() -> None:
    session_id = uuid4()
    history = [
        FakeMessage(id=uuid4(), session_id=session_id, role="user",
                    content="old", selected_model="qwen3.5:2b"),
        FakeMessage(id=uuid4(), session_id=session_id, role="assistant",
                    content="old-a", selected_model="qwen3.5:2b"),
        FakeMessage(id=uuid4(), session_id=session_id, role="user",
                    content="new", selected_model="gemma4:e2b"),
    ]

    selected = select_completion_history(history=history, selected_model="gemma4:e2b")
    assert [m.content for m in selected] == ["new"]


def test_build_provider_history_attaches_images_only_to_trigger() -> None:
    session_id = uuid4()
    trigger_id = uuid4()
    other_id = uuid4()
    messages = [
        FakeMessage(id=other_id, session_id=session_id, role="user",
                    content="hi", selected_model="qwen3.5:2b"),
        FakeMessage(id=trigger_id, session_id=session_id, role="user",
                    content="look", selected_model="gemma4:e2b"),
    ]

    provider_messages = build_provider_history(
        completion_history=messages,
        images=["<b64>"] ,
        user_message_id=trigger_id,
    )

    assert provider_messages[0].images is None
    assert provider_messages[1].images == ["<b64>"]


