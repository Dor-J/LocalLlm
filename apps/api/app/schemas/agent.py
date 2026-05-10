from app.schemas.base import APIModel


class AgentDispatchDemoRequest(APIModel):
    prompt: str


class AgentDispatchDemoResponse(APIModel):
    enabled: bool
    backend: str
    message: str
    prompt: str
