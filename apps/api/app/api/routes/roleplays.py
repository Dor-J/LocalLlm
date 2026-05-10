from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_roleplay_template_service
from app.schemas.roleplay import (
    RoleplayTemplateCreate,
    RoleplayTemplateRead,
    RoleplayTemplateSummary,
    RoleplayTemplateUpdate,
)
from app.services.roleplay_templates import RoleplayTemplateService

router = APIRouter(prefix="/roleplays", tags=["roleplays"])


@router.get("/templates", response_model=list[RoleplayTemplateSummary])
async def list_roleplay_templates(
    roleplay_service: RoleplayTemplateService = Depends(get_roleplay_template_service),
) -> list[RoleplayTemplateSummary]:
    templates = await roleplay_service.list_templates()
    return [
        RoleplayTemplateSummary.model_validate(
            {
                **template.__dict__,
                "scene_state_json": template.scene_state_json,
                "role_count": len(template.roles),
            }
        )
        for template in templates
    ]


@router.post(
    "/templates",
    response_model=RoleplayTemplateRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_roleplay_template(
    payload: RoleplayTemplateCreate,
    roleplay_service: RoleplayTemplateService = Depends(get_roleplay_template_service),
) -> RoleplayTemplateRead:
    try:
        template = await roleplay_service.create_template(
            name=payload.name,
            description=payload.description,
            crew_template_id=payload.crew_template_id,
            scene_state_json=payload.scene_state,
            roles=[role.model_dump(by_alias=False) for role in payload.roles],
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return RoleplayTemplateRead.model_validate(template)


@router.get("/templates/{template_id}", response_model=RoleplayTemplateRead)
async def get_roleplay_template(
    template_id: UUID,
    roleplay_service: RoleplayTemplateService = Depends(get_roleplay_template_service),
) -> RoleplayTemplateRead:
    try:
        template = await roleplay_service.get_template(template_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return RoleplayTemplateRead.model_validate(template)


@router.put("/templates/{template_id}", response_model=RoleplayTemplateRead)
async def update_roleplay_template(
    template_id: UUID,
    payload: RoleplayTemplateUpdate,
    roleplay_service: RoleplayTemplateService = Depends(get_roleplay_template_service),
) -> RoleplayTemplateRead:
    try:
        template = await roleplay_service.update_template(
            template_id=template_id,
            name=payload.name,
            description=payload.description,
            crew_template_id=payload.crew_template_id,
            scene_state_json=payload.scene_state,
            roles=[role.model_dump(by_alias=False) for role in payload.roles],
        )
    except ValueError as error:
        detail = str(error)
        status_code = (
            status.HTTP_404_NOT_FOUND
            if "not found" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=detail) from error
    return RoleplayTemplateRead.model_validate(template)


@router.delete("/templates/{template_id}")
async def delete_roleplay_template(
    template_id: UUID,
    roleplay_service: RoleplayTemplateService = Depends(get_roleplay_template_service),
) -> dict[str, bool]:
    try:
        await roleplay_service.delete_template(template_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return {"deleted": True}
