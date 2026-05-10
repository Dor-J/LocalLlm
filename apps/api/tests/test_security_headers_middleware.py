"""Tests for security header middleware."""

from __future__ import annotations

import httpx
import pytest
from fastapi import FastAPI

from app.middleware.security_headers import SecurityHeadersMiddleware


@pytest.mark.anyio
async def test_security_headers_on_json_response() -> None:
    test_app = FastAPI()
    test_app.add_middleware(SecurityHeadersMiddleware)

    @test_app.get("/ok")
    async def ok() -> dict[str, str]:
        return {"ok": "true"}

    transport = httpx.ASGITransport(app=test_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/ok")

    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "camera=()" in response.headers["permissions-policy"]
