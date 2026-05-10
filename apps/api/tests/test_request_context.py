import logging

import httpx
import pytest
from fastapi import FastAPI

from app.core.logging import RequestIdFilter, set_request_id
from app.middleware.request_context import RequestContextMiddleware


@pytest.mark.anyio
async def test_request_id_is_echoed_in_response_header() -> None:
    test_app = FastAPI()
    test_app.add_middleware(RequestContextMiddleware)

    @test_app.get("/ok")
    async def ok() -> dict[str, str]:
        return {"ok": "true"}

    transport = httpx.ASGITransport(app=test_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/ok", headers={"X-Request-Id": "req-123"})
    assert response.status_code == 200
    assert response.headers["x-request-id"] == "req-123"


def test_request_id_filter_injects_request_id() -> None:
    logger = logging.getLogger("test.request_id")
    filter_ = RequestIdFilter()

    set_request_id("req-abc")
    try:
        record = logger.makeRecord(
            name=logger.name,
            level=logging.INFO,
            fn="x.py",
            lno=1,
            msg="hello",
            args=(),
            exc_info=None,
        )
        assert filter_.filter(record) is True
        assert record.request_id == "req-abc"
    finally:
        set_request_id(None)

