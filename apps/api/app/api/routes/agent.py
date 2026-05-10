from fastapi import APIRouter, Depends

from app.dependencies import get_agent_orchestration_service
from app.schemas.agent import AgentDispatchDemoRequest, AgentDispatchDemoResponse
from app.services.agent_orchestration.base import AgentOrchestrationService

router = APIRouter()


@router.post("/dispatch-demo", response_model=AgentDispatchDemoResponse)
async def dispatch_demo(
    payload: AgentDispatchDemoRequest,
    agent_service: AgentOrchestrationService = Depends(get_agent_orchestration_service),
) -> AgentDispatchDemoResponse:
    result = await agent_service.demo_dispatch(prompt=payload.prompt)
    return AgentDispatchDemoResponse.model_validate(result)
