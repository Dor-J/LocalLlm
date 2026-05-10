from __future__ import annotations

import json
import logging
from contextvars import ContextVar
from datetime import UTC, datetime

from app.core.config import get_settings

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def set_request_id(value: str | None) -> None:
    _request_id.set(value)


def get_request_id() -> str | None:
    return _request_id.get()


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()  # type: ignore[attr-defined]
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
        }
        for key in (
            "duration_ms",
            "db_cumulative_ms",
            "ollama_http_ms",
            "http_method",
            "http_path",
            "http_status_code",
            "ollama_operation",
            "db_statement_ms",
            "statement_preview",
            "parameters_preview",
        ):
            if key in record.__dict__ and record.__dict__[key] is not None:
                payload[key] = record.__dict__[key]
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


class PerfExtrasFilter(logging.Filter):
    """Append duration / db / HTTP fields to the log message in text format."""

    def filter(self, record: logging.LogRecord) -> bool:
        parts: list[str] = []
        for key in (
            "duration_ms",
            "db_cumulative_ms",
            "http_method",
            "http_path",
            "http_status_code",
            "ollama_http_ms",
            "ollama_operation",
            "db_statement_ms",
        ):
            if key in record.__dict__ and record.__dict__[key] is not None:
                parts.append(f"{key}={record.__dict__[key]}")
        record.perf_extras = (" " + " ".join(parts)) if parts else ""  # type: ignore[attr-defined]
        return True


def configure_logging() -> None:
    settings = get_settings()
    root = logging.getLogger()
    root.setLevel(logging.INFO)

    handler = logging.StreamHandler()
    handler.addFilter(RequestIdFilter())
    handler.addFilter(PerfExtrasFilter())

    if settings.log_format.lower() == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s %(levelname)s [%(name)s] %(message)s "
                "request_id=%(request_id)s"
                "%(perf_extras)s"
            )
        )

    root.handlers.clear()
    root.addHandler(handler)
