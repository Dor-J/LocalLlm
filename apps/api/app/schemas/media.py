from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import APIModel


class ImageAssetRead(APIModel):
    id: UUID
    session_id: UUID
    file_name: str
    content_type: str
    byte_size: int
    sha256: str
    content_url: str
    metadata: dict = Field(default_factory=dict, validation_alias="image_metadata")
    created_at: datetime


class ImageAssetListPage(APIModel):
    items: list[ImageAssetRead]
    total: int
    limit: int
    offset: int
