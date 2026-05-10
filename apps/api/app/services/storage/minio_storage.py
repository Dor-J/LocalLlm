from __future__ import annotations

import asyncio
from io import BytesIO
from urllib.parse import urlparse

from minio import Minio


class MinioStorageService:
    def __init__(
        self,
        *,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket_name: str,
        secure: bool,
    ) -> None:
        self.endpoint = endpoint
        parsed_endpoint = urlparse(endpoint)
        if parsed_endpoint.scheme:
            host = parsed_endpoint.netloc
            secure = parsed_endpoint.scheme == "https"
        else:
            host = endpoint

        # Minio client is constructed per request via DI; pooling is handled by the SDK.
        # See P1 hardening plans if we consolidate to a shared app-scoped client.
        self.client = Minio(
            host,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
        )
        self.bucket_name = bucket_name
        self._bucket_ready = False
        self._bucket_lock = asyncio.Lock()

    async def ensure_bucket(self) -> None:
        if self._bucket_ready:
            return

        async with self._bucket_lock:
            if self._bucket_ready:
                return
            await asyncio.to_thread(self._ensure_bucket_sync)
            self._bucket_ready = True

    async def put_bytes(
        self,
        *,
        object_name: str,
        content: bytes,
        content_type: str,
    ) -> None:
        await self.ensure_bucket()
        await asyncio.to_thread(
            self._put_bytes_sync,
            object_name,
            content,
            content_type,
        )

    async def get_bytes(self, *, object_name: str) -> bytes:
        await self.ensure_bucket()
        return await asyncio.to_thread(self._get_bytes_sync, object_name)

    async def delete_object(self, *, object_name: str) -> None:
        await self.ensure_bucket()
        await asyncio.to_thread(self.client.remove_object, self.bucket_name, object_name)

    def _ensure_bucket_sync(self) -> None:
        if not self.client.bucket_exists(self.bucket_name):
            self.client.make_bucket(self.bucket_name)

    def _put_bytes_sync(self, object_name: str, content: bytes, content_type: str) -> None:
        self.client.put_object(
            self.bucket_name,
            object_name,
            BytesIO(content),
            length=len(content),
            content_type=content_type,
        )

    def _get_bytes_sync(self, object_name: str) -> bytes:
        response = self.client.get_object(self.bucket_name, object_name)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()
