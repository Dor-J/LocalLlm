from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Sequence


class EmbeddingProvider(ABC):
    @property
    @abstractmethod
    def available(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def embed_text(self, *, content: str) -> Sequence[float]:
        raise NotImplementedError


class NoOpEmbeddingProvider(EmbeddingProvider):
    @property
    def available(self) -> bool:
        return False

    async def embed_text(self, *, content: str) -> Sequence[float]:
        raise NotImplementedError(
            "No embedding provider is configured. Supply an embedding vector explicitly or "
            "wire a local embedding model later."
        )
