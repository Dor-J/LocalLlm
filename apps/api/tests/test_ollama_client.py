import json

import httpx
import pytest

from app.services.llm.ollama_client import OllamaClient, build_chat_payload


def _models_transport(*, tag_call_counter: dict[str, int] | None = None) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/api/tags"):
            if tag_call_counter is not None:
                tag_call_counter["n"] = tag_call_counter.get("n", 0) + 1
            return httpx.Response(
                200,
                json={
                    "models": [
                        {"name": "qwen3.5:2b"},
                        {"name": "gemma4:e2b"},
                        {"name": "gemma4-e2b-uncensored-q5_k_p:latest"},
                    ]
                },
            )
        return httpx.Response(404, json={"error": "not found"})

    return httpx.MockTransport(handler)


def _chat_transport(*, last_chat_payload: dict | None = None) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/api/chat"):
            body = json.loads(request.content.decode())
            if last_chat_payload is not None:
                last_chat_payload.clear()
                last_chat_payload.update(body)
            return httpx.Response(
                200,
                json={
                    "model": body["model"],
                    "message": {"content": "ok"},
                    "done": True,
                    "done_reason": "stop",
                },
            )
        if request.url.path.endswith("/api/tags"):
            return httpx.Response(
                200,
                json={
                    "models": [
                        {"name": "qwen3.5:2b"},
                        {"name": "gemma4:e2b"},
                        {"name": "gemma4-e2b-uncensored-q5_k_p:latest"},
                    ]
                },
            )
        return httpx.Response(404)

    return httpx.MockTransport(handler)


@pytest.mark.asyncio
async def test_list_models_uses_ttl_cache() -> None:
    tag_calls: dict[str, int] = {}
    transport = _models_transport(tag_call_counter=tag_calls)
    http_client = httpx.AsyncClient(
        transport=transport,
        timeout=httpx.Timeout(5.0, connect=5.0),
    )
    try:
        client = OllamaClient(
            base_url="http://localhost:11434",
            timeout_seconds=5.0,
            model_cache_ttl_seconds=60.0,
            http_client=http_client,
        )

        first = await client.list_models()
        second = await client.list_models()
        await client.ensure_model_available(model="qwen3.5:2b")

        assert first == (
            "qwen3.5:2b",
            "gemma4:e2b",
            "gemma4-e2b-uncensored-q5_k_p",
        )
        assert second == first
        assert tag_calls.get("n", 0) == 1
    finally:
        await http_client.aclose()


@pytest.mark.asyncio
async def test_ensure_model_available_accepts_latest_tag() -> None:
    tag_calls: dict[str, int] = {}
    transport = _models_transport(tag_call_counter=tag_calls)
    http_client = httpx.AsyncClient(
        transport=transport,
        timeout=httpx.Timeout(5.0, connect=5.0),
    )
    try:
        client = OllamaClient(
            base_url="http://localhost:11434",
            timeout_seconds=5.0,
            model_cache_ttl_seconds=60.0,
            http_client=http_client,
        )

        await client.ensure_model_available(model="gemma4-e2b-uncensored-q5_k_p")

        assert tag_calls.get("n", 0) == 1
    finally:
        await http_client.aclose()


def test_build_chat_payload_uses_runtime_limits_for_uncensored_gemma() -> None:
    payload = build_chat_payload(
        model="gemma4-e2b-uncensored-q5_k_p",
        messages=[],
        stream=False,
    )

    assert payload["keep_alive"] == "30s"
    assert payload["options"] == {"num_ctx": 4096, "num_predict": 512}


def _stream_transport() -> httpx.MockTransport:
    """Emit three NDJSON chunks followed by a final ``done: true`` row."""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/api/chat"):
            chunks = [
                {"message": {"content": "Hel"}},
                {"message": {"content": "lo, "}},
                {"message": {"content": "world"}},
                {"message": {"content": ""}, "done": True, "done_reason": "stop"},
            ]
            body = "\n".join(json.dumps(chunk) for chunk in chunks) + "\n"
            return httpx.Response(
                200,
                content=body.encode("utf-8"),
                headers={"Content-Type": "application/x-ndjson"},
            )
        if request.url.path.endswith("/api/tags"):
            return httpx.Response(
                200,
                json={"models": [{"name": "qwen3.5:2b"}]},
            )
        return httpx.Response(404)

    return httpx.MockTransport(handler)


@pytest.mark.asyncio
async def test_stream_chat_tokens_yields_content_deltas() -> None:
    transport = _stream_transport()
    http_client = httpx.AsyncClient(
        transport=transport,
        timeout=httpx.Timeout(5.0, connect=5.0),
    )
    try:
        client = OllamaClient(
            base_url="http://localhost:11434",
            timeout_seconds=5.0,
            model_cache_ttl_seconds=60.0,
            http_client=http_client,
        )

        deltas: list[str] = []
        async for delta in client.stream_chat_tokens(model="qwen3.5:2b", messages=[]):
            deltas.append(delta)

        assert deltas == ["Hel", "lo, ", "world"]
    finally:
        await http_client.aclose()


@pytest.mark.asyncio
async def test_complete_chat_applies_runtime_limits_for_uncensored_gemma() -> None:
    last_payload: dict = {}
    transport = _chat_transport(last_chat_payload=last_payload)
    http_client = httpx.AsyncClient(
        transport=transport,
        timeout=httpx.Timeout(5.0, connect=5.0),
    )
    try:
        client = OllamaClient(
            base_url="http://localhost:11434",
            timeout_seconds=5.0,
            model_cache_ttl_seconds=60.0,
            http_client=http_client,
        )

        result = await client.complete_chat(model="gemma4-e2b-uncensored-q5_k_p", messages=[])

        assert result.content == "ok"
        assert last_payload.get("options") == {"num_ctx": 4096, "num_predict": 512}
    finally:
        await http_client.aclose()
