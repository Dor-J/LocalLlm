import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ImageAsset


class ImageAssetRepository:
    def __init__(self, db_session: AsyncSession) -> None:
        self.db_session = db_session

    async def list_by_session(self, session_id: uuid.UUID) -> list[ImageAsset]:
        statement = (
            select(ImageAsset)
            .where(ImageAsset.session_id == session_id)
            .order_by(ImageAsset.created_at.asc())
        )
        result = await self.db_session.execute(statement)
        return list(result.scalars().all())

    async def list_all(self) -> list[ImageAsset]:
        statement = select(ImageAsset).order_by(ImageAsset.created_at.asc())
        result = await self.db_session.execute(statement)
        return list(result.scalars().all())

    async def list_by_session_paginated(
        self,
        session_id: uuid.UUID,
        *,
        limit: int,
        offset: int,
    ) -> tuple[list[ImageAsset], int]:
        count_stmt = (
            select(func.count())
            .select_from(ImageAsset)
            .where(ImageAsset.session_id == session_id)
        )
        total = int((await self.db_session.execute(count_stmt)).scalar_one())
        statement = (
            select(ImageAsset)
            .where(ImageAsset.session_id == session_id)
            .order_by(ImageAsset.created_at.asc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db_session.execute(statement)
        return list(result.scalars().all()), total

    async def list_all_paginated(
        self,
        *,
        limit: int,
        offset: int,
    ) -> tuple[list[ImageAsset], int]:
        count_stmt = select(func.count()).select_from(ImageAsset)
        total = int((await self.db_session.execute(count_stmt)).scalar_one())
        statement = (
            select(ImageAsset)
            .order_by(ImageAsset.created_at.asc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db_session.execute(statement)
        return list(result.scalars().all()), total

    async def list_by_ids(self, image_asset_ids: Sequence[uuid.UUID]) -> list[ImageAsset]:
        if not image_asset_ids:
            return []
        statement = select(ImageAsset).where(ImageAsset.id.in_(list(image_asset_ids)))
        result = await self.db_session.execute(statement)
        return list(result.scalars().all())

    async def create_image_asset(
        self,
        *,
        id: uuid.UUID,
        session_id: uuid.UUID,
        object_key: str,
        file_name: str,
        content_type: str,
        byte_size: int,
        sha256: str,
        metadata: dict | None = None,
    ) -> ImageAsset:
        asset = ImageAsset(
            id=id,
            session_id=session_id,
            object_key=object_key,
            file_name=file_name,
            content_type=content_type,
            byte_size=byte_size,
            sha256=sha256,
            image_metadata=metadata or {},
        )
        self.db_session.add(asset)
        await self.db_session.flush()
        await self.db_session.refresh(asset)
        return asset

    async def get_image_asset(self, image_asset_id: uuid.UUID) -> ImageAsset | None:
        return await self.db_session.get(ImageAsset, image_asset_id)

    async def delete_image_asset(self, image_asset: ImageAsset) -> None:
        await self.db_session.delete(image_asset)

    async def delete_by_session(self, session_id: uuid.UUID) -> list[ImageAsset]:
        assets = await self.list_by_session(session_id)
        for asset in assets:
            await self.db_session.delete(asset)
        return assets

    async def count_by_session(self, session_id: uuid.UUID) -> int:
        statement = (
            select(func.count()).select_from(ImageAsset).where(ImageAsset.session_id == session_id)
        )
        result = await self.db_session.execute(statement)
        return int(result.scalar_one())

    async def count_all_image_assets(self) -> int:
        statement = select(func.count()).select_from(ImageAsset)
        result = await self.db_session.execute(statement)
        return int(result.scalar_one())

    async def sum_all_image_bytes(self) -> int:
        statement = select(func.coalesce(func.sum(ImageAsset.byte_size), 0))
        result = await self.db_session.execute(statement)
        return int(result.scalar_one())
