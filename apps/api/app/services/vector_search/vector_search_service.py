from app.repositories.embeddings import EmbeddingRepository


class VectorSearchService:
    def __init__(self, *, embedding_repository: EmbeddingRepository) -> None:
        self.embedding_repository = embedding_repository

    async def search(self, *, query_embedding: list[float], limit: int) -> list[dict]:
        return await self.embedding_repository.search_similar(
            query_embedding=query_embedding,
            limit=limit,
        )
