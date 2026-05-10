from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import get_settings
from app.dependencies import get_chat_service
from app.schemas.chat import ChatMessageListPage, ChatMessageRead
from app.services.chat_service import ChatService

router = APIRouter()


@router.get("/{session_id}/messages", response_model=ChatMessageListPage)
async def list_messages(
    session_id: UUID,
    limit: int = Query(
        200,
        ge=1,
        description="Page size (capped by max messages per session on the server).",
    ),
    offset: int = Query(0, ge=0),
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatMessageListPage:
    try:
        settings = get_settings()
        page_limit = min(limit, settings.max_messages_per_session)
        messages, total = await chat_service.list_session_messages_paginated(
            session_id,
            limit=page_limit,
            offset=offset,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return ChatMessageListPage(
        items=[ChatMessageRead.model_validate(m) for m in messages],
        total=total,
        limit=page_limit,
        offset=offset,
    )
