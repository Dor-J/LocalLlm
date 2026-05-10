from __future__ import annotations

import base64
import hashlib
import uuid
from collections.abc import Sequence

from app.repositories.image_assets import ImageAssetRepository
from app.services.storage.minio_storage import MinioStorageService
from app.services.storage_guard import StorageGuardService


class ImageAssetService:
    def __init__(
        self,
        *,
        image_asset_repository: ImageAssetRepository,
        storage_service: MinioStorageService,
        storage_guard_service: StorageGuardService,
        session_repository,
        db_session,
    ) -> None:
        self.image_asset_repository = image_asset_repository
        self.storage_service = storage_service
        self.storage_guard_service = storage_guard_service
        self.session_repository = session_repository
        self.db_session = db_session

    async def list_images(self, session_id: uuid.UUID):
        return await self.image_asset_repository.list_by_session(session_id)

    async def list_all_images(self):
        return await self.image_asset_repository.list_all()

    async def list_images_paginated(
        self,
        session_id: uuid.UUID,
        *,
        limit: int,
        offset: int,
    ) -> tuple[list, int]:
        return await self.image_asset_repository.list_by_session_paginated(
            session_id,
            limit=limit,
            offset=offset,
        )

    async def list_all_images_paginated(
        self,
        *,
        limit: int,
        offset: int,
    ) -> tuple[list, int]:
        return await self.image_asset_repository.list_all_paginated(
            limit=limit,
            offset=offset,
        )

    async def get_image(self, image_asset_id: uuid.UUID):
        image_asset = await self.image_asset_repository.get_image_asset(image_asset_id)
        if image_asset is None:
            raise ValueError("Image asset not found")
        return image_asset

    async def upload_image(
        self,
        *,
        session_id: uuid.UUID,
        file_name: str,
        content_type: str,
        content: bytes,
    ):
        session = await self.session_repository.get_session(session_id)
        if session is None:
            raise ValueError("Chat session not found")

        if not content_type.startswith("image/"):
            raise ValueError("Only image uploads are supported.")

        await self.storage_guard_service.guard_database_size()
        await self.storage_guard_service.guard_image_upload(size_bytes=len(content))
        await self.storage_guard_service.guard_image_creation(session_id=session_id)

        asset_id = uuid.uuid4()
        safe_file_name = file_name.replace("/", "_").replace("\\", "_").strip() or "image"
        object_key = f"image-assets/{session_id}/{asset_id}/{safe_file_name}"
        checksum = hashlib.sha256(content).hexdigest()

        try:
            await self.storage_service.put_bytes(
                object_name=object_key,
                content=content,
                content_type=content_type,
            )
            image_asset = await self.image_asset_repository.create_image_asset(
                id=asset_id,
                session_id=session_id,
                object_key=object_key,
                file_name=safe_file_name,
                content_type=content_type,
                byte_size=len(content),
                sha256=checksum,
            )
            await self.storage_guard_service.log_usage(context="upload_image", force=True)
            return image_asset
        except Exception:
            try:
                await self.storage_service.delete_object(object_name=object_key)
            except Exception:
                pass
            raise

    async def delete_image(self, image_asset_id: uuid.UUID) -> None:
        image_asset = await self.get_image(image_asset_id)
        await self.storage_service.delete_object(object_name=image_asset.object_key)
        await self.image_asset_repository.delete_image_asset(image_asset)
        await self.storage_guard_service.log_usage(context="delete_image", force=True)

    async def delete_images_for_session(self, session_id: uuid.UUID) -> None:
        image_assets = await self.image_asset_repository.list_by_session(session_id)
        for image_asset in image_assets:
            await self.storage_service.delete_object(object_name=image_asset.object_key)
        await self.image_asset_repository.delete_by_session(session_id)
        await self.storage_guard_service.log_usage(context="delete_session_images", force=True)

    async def load_images_for_completion(
        self,
        *,
        session_id: uuid.UUID,
        image_asset_ids: Sequence[uuid.UUID],
    ) -> list[str]:
        if not image_asset_ids:
            return []

        image_assets = await self.image_asset_repository.list_by_ids(image_asset_ids)
        if len(image_assets) != len(set(image_asset_ids)):
            raise ValueError("One or more image attachments were not found.")

        image_asset_map = {image_asset.id: image_asset for image_asset in image_assets}
        ordered_assets = []
        for image_asset_id in image_asset_ids:
            image_asset = image_asset_map.get(image_asset_id)
            if image_asset is None:
                raise ValueError("One or more image attachments were not found.")
            if image_asset.session_id != session_id:
                raise ValueError("One or more image attachments do not belong to this session.")
            ordered_assets.append(image_asset)

        encoded_images: list[str] = []
        for image_asset in ordered_assets:
            content = await self.storage_service.get_bytes(object_name=image_asset.object_key)
            encoded_images.append(base64.b64encode(content).decode("ascii"))
        return encoded_images

    async def ensure_images_allowed_for_model(
        self, *, selected_model: str, image_asset_ids: Sequence[uuid.UUID]
    ) -> None:
        if image_asset_ids and selected_model != "gemma4:e2b":
            raise ValueError("Image attachments are only supported with gemma4:e2b.")
