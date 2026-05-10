from fastapi import APIRouter

from app.api.routes import (
    agent,
    chats,
    device_control,
    embeddings,
    health,
    images,
    messages,
    orchestration,
    roleplays,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(chats.router, prefix="/chats", tags=["chats"])
api_router.include_router(messages.router, prefix="/chats", tags=["messages"])
api_router.include_router(device_control.router)
api_router.include_router(embeddings.router, prefix="/embeddings", tags=["embeddings"])
api_router.include_router(images.router, prefix="/images", tags=["images"])
api_router.include_router(agent.router, prefix="/agent", tags=["agent"])
api_router.include_router(orchestration.router, tags=["orchestration"])
api_router.include_router(roleplays.router)
