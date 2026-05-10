from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import Response

from app.core.config import get_settings
from app.dependencies import get_image_asset_service
from app.schemas.media import ImageAssetListPage, ImageAssetRead
from app.services.image_assets.image_asset_service import ImageAssetService
from app.services.storage_guard import StorageLimitExceededError

router = APIRouter()


@router.get("", response_model=ImageAssetListPage)
async def list_images(
    request: Request,
    session_id: UUID | None = None,
    limit: int = Query(100, ge=1, description="Page size (server-capped)."),
    offset: int = Query(0, ge=0),
    image_service: ImageAssetService = Depends(get_image_asset_service),
) -> ImageAssetListPage:
    settings = get_settings()
    page_limit = min(limit, settings.max_image_list_per_page)
    if session_id is not None:
        page_limit = min(page_limit, settings.max_images_per_session)
    if session_id is None:
        images, total = await image_service.list_all_images_paginated(
            limit=page_limit,
            offset=offset,
        )
    else:
        images, total = await image_service.list_images_paginated(
            session_id,
            limit=page_limit,
            offset=offset,
        )
    return ImageAssetListPage(
        items=[_serialize_image_asset(request, image) for image in images],
        total=total,
        limit=page_limit,
        offset=offset,
    )


@router.post("", response_model=ImageAssetRead, status_code=status.HTTP_201_CREATED)
async def upload_image(
    request: Request,
    session_id: UUID = Form(...),
    file: UploadFile = File(...),
    image_service: ImageAssetService = Depends(get_image_asset_service),
) -> ImageAssetRead:
    try:
        content = await file.read()
        image_asset = await image_service.upload_image(
            session_id=session_id,
            file_name=file.filename or "image",
            content_type=file.content_type or "application/octet-stream",
            content=content,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except StorageLimitExceededError as error:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(error)
        ) from error

    return _serialize_image_asset(request, image_asset)


@router.get("/{image_asset_id}", response_model=ImageAssetRead)
async def get_image(
    request: Request,
    image_asset_id: UUID,
    image_service: ImageAssetService = Depends(get_image_asset_service),
) -> ImageAssetRead:
    try:
        image_asset = await image_service.get_image(image_asset_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return _serialize_image_asset(request, image_asset)


@router.get("/{image_asset_id}/content")
async def get_image_content(
    image_asset_id: UUID,
    image_service: ImageAssetService = Depends(get_image_asset_service),
):
    try:
        image_asset = await image_service.get_image(image_asset_id)
        content = await image_service.storage_service.get_bytes(object_name=image_asset.object_key)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

    return Response(content=content, media_type=image_asset.content_type)


@router.delete("/{image_asset_id}")
async def delete_image(
    image_asset_id: UUID,
    image_service: ImageAssetService = Depends(get_image_asset_service),
) -> dict[str, bool]:
    try:
        await image_service.delete_image(image_asset_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return {"deleted": True}


def _serialize_image_asset(request: Request, image_asset) -> ImageAssetRead:
    return ImageAssetRead(
        id=image_asset.id,
        session_id=image_asset.session_id,
        file_name=image_asset.file_name,
        content_type=image_asset.content_type,
        byte_size=image_asset.byte_size,
        sha256=image_asset.sha256,
        content_url=str(request.url_for("get_image_content", image_asset_id=image_asset.id)),
        metadata=image_asset.image_metadata,
        created_at=image_asset.created_at,
    )
