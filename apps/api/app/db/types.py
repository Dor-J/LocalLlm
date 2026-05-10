from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy.types import UserDefinedType


def serialize_vector(vector: Iterable[float]) -> str:
    return "[" + ",".join(f"{float(value):.12g}" for value in vector) + "]"


def parse_vector(raw: str) -> list[float]:
    stripped = raw.strip()
    if stripped.startswith("[") and stripped.endswith("]"):
        payload = stripped[1:-1].strip()
        if not payload:
            return []
        return [float(item.strip()) for item in payload.split(",")]
    raise ValueError(f"Invalid vector payload: {raw}")


class PgVector(UserDefinedType):
    cache_ok = True

    def get_col_spec(self, **_: object) -> str:
        return "vector"

    def bind_processor(self, dialect: object):
        def process(value: Iterable[float] | None) -> str | None:
            if value is None:
                return None
            return serialize_vector(value)

        return process

    def result_processor(self, dialect: object, coltype: object):
        def process(value: str | None) -> list[float] | None:
            if value is None:
                return None
            return parse_vector(value)

        return process
