from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_embedding_service, get_vector_search_service
from app.schemas.embeddings import (
    EmbeddingIndexRequest,
    EmbeddingIndexResponse,
    EmbeddingSearchRequest,
    EmbeddingSearchResult,
)
from app.services.embeddings.embedding_service import EmbeddingService
from app.services.storage_guard import StorageLimitExceededError
from app.services.vector_search.vector_search_service import VectorSearchService

router = APIRouter()


@router.post("/index", response_model=EmbeddingIndexResponse, status_code=status.HTTP_201_CREATED)
async def index_embedding(
    payload: EmbeddingIndexRequest,
    embedding_service: EmbeddingService = Depends(get_embedding_service),
) -> EmbeddingIndexResponse:
    try:
        chunk, record = await embedding_service.index_content(
            content=payload.content,
            source_type=payload.source_type,
            source_uri=payload.source_uri,
            metadata=payload.metadata,
            embedding=payload.embedding,
            embedding_model=payload.embedding_model,
        )
    except NotImplementedError as error:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(error),
        ) from error
    except StorageLimitExceededError as error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(error),
        ) from error

    return EmbeddingIndexResponse(
        chunk_id=chunk.id,
        embedding_record_id=record.id,
        created_at=record.created_at,
    )


@router.post("/search", response_model=list[EmbeddingSearchResult])
async def search_embeddings(
    payload: EmbeddingSearchRequest,
    vector_search_service: VectorSearchService = Depends(get_vector_search_service),
) -> list[EmbeddingSearchResult]:
    results = await vector_search_service.search(
        query_embedding=payload.query_embedding,
        limit=payload.limit,
    )
    return [EmbeddingSearchResult.model_validate(result) for result in results]
