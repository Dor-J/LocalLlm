"""History-shaping helpers for chat completions.

``select_completion_history`` trims stored history so a model switch starts a
fresh context (preserving only messages tagged with the current model).

``build_provider_history`` converts that trimmed slice into the
``LLMChatMessage`` shape the provider expects, attaching image payloads only
to the triggering user message.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence

from app.services.llm.base import LLMChatMessage


def select_completion_history(
    *,
    history: Sequence,
    selected_model: str,
) -> Sequence:
    """Return the longest suffix of ``history`` that matches ``selected_model``.

    Messages with no ``selected_model`` (e.g. system messages) are treated as
    "model-agnostic" and therefore preserved.
    """

    for index in range(len(history) - 1, -1, -1):
        message_model = history[index].selected_model
        if message_model is not None and message_model != selected_model:
            return history[index + 1 :]
    return history


def build_provider_history(
    *,
    completion_history: Iterable,
    images: Sequence[str] | None,
    user_message_id,
) -> list[LLMChatMessage]:
    """Convert persisted chat rows into the provider-facing message list."""

    return [
        LLMChatMessage(
            role=message.role,
            content=message.content,
            images=images if message.id == user_message_id else None,
        )
        for message in completion_history
    ]
