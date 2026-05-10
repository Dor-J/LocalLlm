from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_chat_service
from app.schemas.orchestration import OrchestrationRunDetail, OrchestrationRunRead
from app.services.chat_service import ChatService

router = APIRouter()


@router.get("/chats/{session_id}/runs", response_model=list[OrchestrationRunRead])
async def list_session_runs(
    session_id: UUID,
    chat_service: ChatService = Depends(get_chat_service),
) -> list[OrchestrationRunRead]:
    runs = await chat_service.list_orchestration_runs(session_id)
    payload: list[OrchestrationRunRead] = []
    for run in runs:
        read = OrchestrationRunRead.model_validate(run)
        payload.append(read.model_copy(update={"step_count": len(getattr(run, "steps", []))}))
    return payload


@router.get("/runs/{run_id}", response_model=OrchestrationRunDetail)
async def get_run_trace(
    run_id: UUID,
    chat_service: ChatService = Depends(get_chat_service),
) -> OrchestrationRunDetail:
    run = await chat_service.get_orchestration_run(run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    detail = OrchestrationRunDetail.model_validate(run)
    return detail.model_copy(
        update={
            "step_count": len(getattr(run, "steps", [])),
            "steps": [step for step in detail.steps],
        }
    )
