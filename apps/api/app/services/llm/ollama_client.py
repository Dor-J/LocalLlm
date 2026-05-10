from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from time import monotonic

import httpx

from app.services.llm.base import (
    ChatProvider,
    LLMChatMessage,
    LLMChatResult,
    LLMProviderUnavailableError,
)

log = logging.getLogger("app.ollama")


def _log_ollama_http(start: float, operation: str) -> None:
    """Log wall-clock time for an Ollama HTTP round trip (per plan: measure Ollama vs DB)."""
    ms = round((monotonic() - start) * 1000.0, 2)
    log.info(
        "ollama_request",
        extra={"ollama_operation": operation, "ollama_http_ms": ms},
    )


@dataclass(slots=True)
class OllamaStatus:
    ready: bool
    base_url: str
    available_models: tuple[str, ...]
    missing_allowed_models: tuple[str, ...]
    error: str | None


class OllamaClient(ChatProvider):
    def __init__(
        self,
        *,
        base_url: str,
        timeout_seconds: float,
        model_cache_ttl_seconds: float,
        http_client: httpx.AsyncClient,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.model_cache_ttl_seconds = model_cache_ttl_seconds
        self._http_client = http_client
        self._cached_models: tuple[str, ...] = ()
        self._cache_expires_at = 0.0

    async def ensure_model_available(self, *, model: str) -> None:
        available_models = await self.list_models()
        normalized_model = normalize_model_name(model)
        if normalized_model not in available_models:
            raise ValueError(
                "Model "
                f"'{model}' is not currently available in Ollama. "
                f"Pull it first with `ollama pull {model}`."
            )

    async def list_models(self) -> tuple[str, ...]:
        if self._cached_models and monotonic() < self._cache_expires_at:
            return self._cached_models

        models = await self._fetch_models(timeout_seconds=self.timeout_seconds)
        self._cached_models = models
        self._cache_expires_at = monotonic() + self.model_cache_ttl_seconds
        return models

    async def get_status(self, *, allowed_models: Sequence[str]) -> OllamaStatus:
        if self._cached_models and monotonic() < self._cache_expires_at:
            available_models = self._cached_models
        else:
            try:
                available_models = await self._fetch_models(
                    timeout_seconds=min(self.timeout_seconds, 2.0)
                )
            except LLMProviderUnavailableError as error:
                return OllamaStatus(
                    ready=False,
                    base_url=self.base_url,
                    available_models=(),
                    missing_allowed_models=tuple(allowed_models),
                    error=str(error),
                )

            self._cached_models = available_models
            self._cache_expires_at = monotonic() + self.model_cache_ttl_seconds

        missing_allowed_models = tuple(
            model for model in allowed_models if normalize_model_name(model) not in available_models
        )
        return OllamaStatus(
            ready=True,
            base_url=self.base_url,
            available_models=available_models,
            missing_allowed_models=missing_allowed_models,
            error=None,
        )

    async def _fetch_models(self, *, timeout_seconds: float) -> tuple[str, ...]:
        start = monotonic()
        try:
            response = await self._http_client.get(
                f"{self.base_url}/api/tags",
                timeout=build_http_timeout(timeout_seconds),
            )
            response.raise_for_status()
            body = response.json()
        except httpx.ReadTimeout as error:
            raise LLMProviderUnavailableError(
                "Ollama did not respond in time while listing models."
            ) from error
        except httpx.HTTPError as error:
            raise LLMProviderUnavailableError(
                "Ollama is unreachable or returned an invalid response while listing models."
            ) from error
        finally:
            _log_ollama_http(start, "list_models")

        return tuple(
            normalize_model_name(model["name"])
            for model in body.get("models", [])
            if model.get("name")
        )

    async def complete_chat(
        self,
        *,
        model: str,
        messages: Sequence[LLMChatMessage],
    ) -> LLMChatResult:
        await self.ensure_model_available(model=model)
        payload = build_chat_payload(model=model, messages=messages, stream=False)
        start = monotonic()
        try:
            response = await self._http_client.post(
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=build_http_timeout(self.timeout_seconds),
            )
            response.raise_for_status()
            body = response.json()
        except httpx.ReadTimeout as error:
            _log_ollama_http(start, "chat")
            raise LLMProviderUnavailableError(
                "Ollama did not finish the chat completion before the configured timeout. "
                "Increase OLLAMA_TIMEOUT_SECONDS for slower local models."
            ) from error
        except httpx.HTTPError as error:
            _log_ollama_http(start, "chat")
            raise LLMProviderUnavailableError(
                "Ollama is unreachable or returned an invalid response during chat completion."
            ) from error
        _log_ollama_http(start, "chat")

        content = body.get("message", {}).get("content", "")
        return LLMChatResult(
            content=content,
            model=normalize_model_name(body.get("model", model)),
            metadata={
                "created_at": body.get("created_at"),
                "done_reason": body.get("done_reason"),
                "done": body.get("done"),
            },
        )

    async def stream_chat(
        self,
        *,
        model: str,
        messages: Sequence[LLMChatMessage],
    ) -> AsyncIterator[str]:
        await self.ensure_model_available(model=model)
        payload = build_chat_payload(model=model, messages=messages, stream=True)
        start = monotonic()
        try:
            async with self._http_client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=build_http_timeout(self.timeout_seconds),
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        yield line
        except httpx.ReadTimeout as error:
            raise LLMProviderUnavailableError(
                "Ollama did not produce streamed output before the configured timeout. "
                "Increase OLLAMA_TIMEOUT_SECONDS for slower local models."
            ) from error
        except httpx.HTTPError as error:
            raise LLMProviderUnavailableError(
                "Ollama is unreachable or returned an invalid response during streaming."
            ) from error
        finally:
            _log_ollama_http(start, "chat_stream")

    async def stream_chat_tokens(
        self,
        *,
        model: str,
        messages: Sequence[LLMChatMessage],
    ) -> AsyncIterator[str]:
        """Yield incremental ``message.content`` deltas from Ollama's NDJSON stream.

        Malformed lines are skipped rather than raised so a single bad chunk
        does not tear down an otherwise valid stream.
        """

        async for line in self.stream_chat(model=model, messages=messages):
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            content = data.get("message", {}).get("content") if isinstance(data, dict) else None
            if content:
                yield content
            if isinstance(data, dict) and data.get("done"):
                return


def normalize_model_name(model_name: str) -> str:
    if model_name.endswith(":latest"):
        return model_name[: -len(":latest")]
    return model_name


def build_chat_payload(
    *,
    model: str,
    messages: Sequence[LLMChatMessage],
    stream: bool,
) -> dict[str, object]:
    normalized_model = normalize_model_name(model)
    payload: dict[str, object] = {
        "model": model,
        "stream": stream,
        "messages": [
            {
                "role": message.role,
                "content": message.content,
                **({"images": list(message.images)} if message.images else {}),
            }
            for message in messages
        ],
        # Keep the selected model warm briefly, but do not pin multiple runners in memory.
        "keep_alive": "30s",
    }
    options = build_model_options(normalized_model)
    if options:
        payload["options"] = options
    return payload


def build_model_options(model_name: str) -> dict[str, int]:
    if model_name == "gemma4-e2b-uncensored-q5_k_p":
        return {
            "num_ctx": 4096,
            "num_predict": 512,
        }
    return {}


def build_http_timeout(timeout_seconds: float) -> httpx.Timeout:
    return httpx.Timeout(timeout_seconds, connect=5.0)
