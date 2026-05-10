from __future__ import annotations

import logging
import uuid
from time import monotonic

from app.core.logging import set_request_id
from app.core.perf import get_db_cumulative_ms, reset_db_time

log = logging.getLogger("app.request")


class RequestContextMiddleware:
    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = None
        for key, value in scope.get("headers", []):
            if key.lower() == b"x-request-id":
                try:
                    request_id = value.decode("latin-1").strip()
                except UnicodeDecodeError:
                    request_id = None
                break

        if not request_id:
            request_id = uuid.uuid4().hex

        set_request_id(request_id)
        reset_db_time()
        start = monotonic()
        status_code: list[int] = [0]

        async def send_wrapper(message: dict) -> None:
            if message.get("type") == "http.response.start":
                raw = message.get("status", 0)
                try:
                    status_code[0] = int(raw)
                except (TypeError, ValueError):
                    status_code[0] = 0
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode("latin-1")))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration_ms = round((monotonic() - start) * 1000.0, 2)
            method = (scope.get("method") or "").upper()
            path = scope.get("path") or ""
            code = status_code[0] or 0
            log.info(
                "http_request",
                extra={
                    "http_method": method,
                    "http_path": path,
                    "http_status_code": code,
                    "duration_ms": duration_ms,
                    "db_cumulative_ms": get_db_cumulative_ms(),
                },
            )
            set_request_id(None)
