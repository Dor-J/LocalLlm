import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.core.config import get_settings
from app.dependencies import get_chat_service
from app.schemas.chat import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatSessionCreate,
    ChatSessionDetail,
    ChatSessionListPage,
    ChatSessionRead,
    CreateChatSessionResponse,
    OrchestrationStatus,
)
from app.services.chat_service import ChatService
from app.services.llm.base import LLMProviderUnavailableError
from app.services.storage_guard import StorageLimitExceededError

router = APIRouter()


@router.get("", response_model=ChatSessionListPage)
async def list_chats(
    limit: int = Query(100, ge=1, description="Page size (capped by server max sessions)."),
    offset: int = Query(0, ge=0, description="Number of rows to skip (newest sessions first)."),
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatSessionListPage:
    settings = get_settings()
    page_limit = min(limit, settings.max_sessions)
    sessions, total = await chat_service.list_sessions(
        limit=page_limit,
        offset=offset,
    )
    return ChatSessionListPage(
        items=[ChatSessionRead.model_validate(s) for s in sessions],
        total=total,
        limit=page_limit,
        offset=offset,
    )


@router.post("", response_model=CreateChatSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_chat(
    payload: ChatSessionCreate,
    chat_service: ChatService = Depends(get_chat_service),
) -> CreateChatSessionResponse:
    try:
        session = await chat_service.create_session(
            title=payload.title,
            conversation_mode=payload.conversation_mode,
            crew_template_id=payload.crew_template_id,
        )
    except StorageLimitExceededError as error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(error),
        ) from error
    return CreateChatSessionResponse(session=session)


@router.get("/{session_id}", response_model=ChatSessionDetail)
async def get_chat(
    session_id: UUID,
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatSessionDetail:
    try:
        session, messages = await chat_service.get_session_detail(session_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

    return ChatSessionDetail(session=session, messages=messages)


@router.delete("/{session_id}")
async def delete_chat(
    session_id: UUID,
    chat_service: ChatService = Depends(get_chat_service),
) -> dict[str, bool]:
    try:
        await chat_service.delete_session(session_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return {"deleted": True}


@router.post("/{session_id}/completions", response_model=ChatCompletionResponse)
async def complete_chat(
    session_id: UUID,
    payload: ChatCompletionRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatCompletionResponse:
    try:
        session, user_message, assistant_message, orchestration = (
            await chat_service.generate_response(
                session_id=session_id,
                content=payload.content,
                selected_model=payload.selected_model,
                agent_mode=payload.agent_mode,
                roleplay_enabled=payload.roleplay_enabled,
                device_control_enabled=payload.device_control_enabled,
                image_asset_ids=payload.image_asset_ids,
                conversation_mode=payload.conversation_mode,
                crew_template_id=payload.crew_template_id,
            )
        )
    except LLMProviderUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error
    except StorageLimitExceededError as error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(error),
        ) from error
    except ValueError as error:
        detail = str(error)
        status_code = status.HTTP_400_BAD_REQUEST
        if "not found" in detail.lower():
            status_code = status.HTTP_404_NOT_FOUND
        raise HTTPException(status_code=status_code, detail=detail) from error

    return ChatCompletionResponse(
        session=session,
        user_message=user_message,
        assistant_message=assistant_message,
        orchestration=OrchestrationStatus(
            enabled=orchestration.enabled,
            mode=orchestration.mode,
            run_id=orchestration.metadata.get("run_id"),
            status=orchestration.metadata.get("status"),
            step_count=orchestration.metadata.get("step_count", 0),
            summary=orchestration.metadata.get("summary"),
        ),
    )


@router.post("/{session_id}/completions/stream")
async def stream_chat(
    session_id: UUID,
    payload: ChatCompletionRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> StreamingResponse:
    """Stream a chat turn as Server-Sent Events.

    Emits ``meta`` once, then either ``token`` deltas followed by ``done`` for
    regular LLM turns or a single ``done`` for device-control routes. Upstream
    failures close the stream with an ``error`` event.
    """

    async def body():
        try:
            async for event in chat_service.stream_response(
                session_id=session_id,
                content=payload.content,
                selected_model=payload.selected_model,
                agent_mode=payload.agent_mode,
                roleplay_enabled=payload.roleplay_enabled,
                device_control_enabled=payload.device_control_enabled,
                image_asset_ids=payload.image_asset_ids,
                conversation_mode=payload.conversation_mode,
                crew_template_id=payload.crew_template_id,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except StorageLimitExceededError as error:
            yield (
                "data: "
                + json.dumps({"type": "error", "code": "storage_limit", "detail": str(error)})
                + "\n\n"
            )
        except ValueError as error:
            yield (
                "data: "
                + json.dumps({"type": "error", "code": "invalid_request", "detail": str(error)})
                + "\n\n"
            )

    return StreamingResponse(
        body(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
