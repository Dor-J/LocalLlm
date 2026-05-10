import httpx
import pytest

from app.main import app


@pytest.mark.anyio
async def test_cors_preflight_allows_request_id_header() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.options(
            "/api/v1/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "X-Request-Id",
            },
        )

    assert response.status_code in (200, 204)
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "x-request-id" in response.headers.get("access-control-allow-headers", "").lower()

