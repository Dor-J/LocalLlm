from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import Field, StringConstraints

from app.schemas.base import APIModel


class EmbeddingIndexRequest(APIModel):
    content: Annotated[str, StringConstraints(min_length=1, max_length=20000)]
    source_type: Annotated[str, StringConstraints(min_length=1, max_length=100)]
    source_uri: Annotated[str | None, StringConstraints(max_length=500)] = None
    embedding: list[float] | None = None
    embedding_model: Annotated[str | None, StringConstraints(max_length=128)] = None
    metadata: dict = Field(default_factory=dict)


class EmbeddingIndexResponse(APIModel):
    chunk_id: UUID
    embedding_record_id: UUID
    created_at: datetime


class EmbeddingSearchRequest(APIModel):
    query_embedding: list[float]
    limit: int = Field(default=5, ge=1, le=50)


class EmbeddingSearchResult(APIModel):
    embedding_record_id: UUID
    chunk_id: UUID
    content: str
    source_type: str
    source_uri: str | None
    distance: float
