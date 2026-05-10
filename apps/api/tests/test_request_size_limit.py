from __future__ import annotations

import httpx
import pytest
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Route

from app.middleware.request_size import RequestSizeLimitMiddleware


async def echo_body(request: Request) -> Response:
    body = await request.body()
    return Response(content=str(len(body)).encode(), status_code=200)


def _test_app(*, max_body_bytes: int = 100) -> RequestSizeLimitMiddleware:
    starlette_app = Starlette(routes=[Route("/echo", echo_body, methods=["POST"])])
    return RequestSizeLimitMiddleware(starlette_app, max_body_bytes=max_body_bytes)


@pytest.mark.asyncio
async def test_rejects_oversized_content_length_without_calling_app() -> None:
    app = _test_app(max_body_bytes=50)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/echo",
            content=b"x" * 10,
            headers={"Content-Length": "99999"},
        )
    assert response.status_code == 413
    assert "exceeds" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_accepts_small_json_body() -> None:
    app = _test_app(max_body_bytes=500)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/echo", json={"hello": "world"})
    assert response.status_code == 200
    assert int(response.text) > 0


@pytest.mark.asyncio
async def test_rejects_chunked_body_over_limit() -> None:
    app = _test_app(max_body_bytes=80)

    async def oversized_chunks():
        yield b"a" * 50
        yield b"b" * 50

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/echo", content=oversized_chunks())
    assert response.status_code == 413
