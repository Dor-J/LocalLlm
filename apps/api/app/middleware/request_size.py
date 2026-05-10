from __future__ import annotations

import json


class RequestSizeLimitMiddleware:
    """ASGI middleware enforcing a maximum request body size (including chunked bodies)."""

    def __init__(self, app, *, max_body_bytes: int) -> None:
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "GET")
        if method in {"GET", "HEAD", "OPTIONS", "DELETE"}:
            await self.app(scope, receive, send)
            return

        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        content_length = headers.get(b"content-length")
        if content_length is not None:
            try:
                if int(content_length) > self.max_body_bytes:
                    await self._send_413(send)
                    return
            except ValueError:
                pass

        total = 0
        sent_413 = False

        async def send_wrapper(message: dict) -> None:
            if sent_413:
                return
            await send(message)

        async def receive_wrapper():
            nonlocal total, sent_413
            if sent_413:
                return {"type": "http.disconnect"}
            message = await receive()
            if message["type"] != "http.request":
                return message

            body = message.get("body") or b""
            if total + len(body) > self.max_body_bytes:
                if not sent_413:
                    sent_413 = True
                    await self._send_413(send)
                upstream = message
                while upstream.get("more_body", False):
                    upstream = await receive()
                return {"type": "http.request", "body": b"", "more_body": False}

            total += len(body)
            return message

        await self.app(scope, receive_wrapper, send_wrapper)

    async def _send_413(self, send) -> None:
        detail = {
            "detail": (
                f"Request body exceeds the limit of {self.max_body_bytes} bytes."
            )
        }
        body = json.dumps(detail).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [(b"content-type", b"application/json; charset=utf-8")],
            }
        )
        await send({"type": "http.response.body", "body": body})
