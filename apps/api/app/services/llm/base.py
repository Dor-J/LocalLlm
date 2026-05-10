from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass


class LLMProviderUnavailableError(RuntimeError):
    pass


@dataclass(slots=True)
class LLMChatMessage:
    role: str
    content: str
    images: Sequence[str] | None = None


@dataclass(slots=True)
class LLMChatResult:
    content: str
    model: str
    metadata: dict


def validate_selected_model(selected_model: str, allowed_models: Sequence[str]) -> str:
    if selected_model not in allowed_models:
        raise ValueError(
            f"Unsupported model '{selected_model}'. Allowed models: {', '.join(allowed_models)}"
        )
    return selected_model


class ChatProvider(ABC):
    @abstractmethod
    async def ensure_model_available(self, *, model: str) -> None:
        raise NotImplementedError

    @abstractmethod
    async def complete_chat(
        self,
        *,
        model: str,
        messages: Sequence[LLMChatMessage],
    ) -> LLMChatResult:
        raise NotImplementedError

    @abstractmethod
    async def stream_chat(
        self,
        *,
        model: str,
        messages: Sequence[LLMChatMessage],
    ) -> AsyncIterator[str]:
        raise NotImplementedError
