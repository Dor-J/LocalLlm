"""Chat-service helpers extracted from ``ChatService`` for focused testing.

Each module holds one small concern: turn preferences, routing, history
selection, or persistence. ``ChatService`` composes them in
``generate_response`` to keep the coordinator thin and testable.
"""

from .history import build_provider_history, select_completion_history
from .preferences import normalize_session_preferences, resolve_turn_preferences

__all__ = [
    "build_provider_history",
    "normalize_session_preferences",
    "resolve_turn_preferences",
    "select_completion_history",
]
