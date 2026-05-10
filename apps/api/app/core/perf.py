"""Request-scoped performance context (cumulative async DB time)."""

from contextvars import ContextVar

_db_cumulative_s: ContextVar[float] = ContextVar("db_cumulative_s", default=0.0)


def reset_db_time() -> None:
    _db_cumulative_s.set(0.0)


def add_db_time_seconds(elapsed: float) -> None:
    _db_cumulative_s.set(_db_cumulative_s.get() + elapsed)


def get_db_cumulative_ms() -> float:
    return round(_db_cumulative_s.get() * 1000.0, 3)
