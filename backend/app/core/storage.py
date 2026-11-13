from typing import Any

import httpx

from app.core.config import settings
from app.core.errors import AppException
from app.core.logging import get_logger

logger = get_logger("app.storage")


class SupabaseStorageService:
    """Manages storage interactions with the private Supabase Storage bucket.
    
    Uses SUPABASE_SERVICE_KEY so operations bypass RLS and direct public access.
    """

    def __init__(self):
        self.bucket = settings.STORAGE_BUCKET
        self.base_url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1"
        self.headers = {
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
            "apikey": settings.SUPABASE_SERVICE_KEY,
        }

    async def upload_file(
        self,
        storage_path: str,
        content: bytes,
        mime_type: str,
    ) -> dict[str, Any]:
        """Uploads a file object to the private storage bucket."""
        url = f"{self.base_url}/object/{self.bucket}/{storage_path}"
        headers = {
            **self.headers,
            "Content-Type": mime_type,
            "x-upsert": "true",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, content=content, headers=headers)
            if resp.status_code not in (200, 201):
                logger.error(
                    f"Storage upload failed ({resp.status_code}): {resp.text}"
                )
                raise AppException(
                    status_code=500,
                    code="storage_error",
                    message="Failed to store document in secure storage",
                )
            return resp.json() if resp.content else {}

    async def delete_file(self, storage_path: str) -> bool:
        """Deletes a file object from the storage bucket."""
        url = f"{self.base_url}/object/{self.bucket}/{storage_path}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.delete(url, headers=self.headers)
            if resp.status_code not in (200, 204, 404):
                logger.warning(
                    f"Storage delete returned {resp.status_code}: {resp.text}"
                )
                return False
            return True

    async def create_signed_url(
        self,
        storage_path: str,
        expires_in: int = 300,
    ) -> str:
        """Generates a temporary signed URL (default 5 min = 300 s) for reading."""
        url = f"{self.base_url}/object/sign/{self.bucket}/{storage_path}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                url,
                json={"expiresIn": expires_in},
                headers={**self.headers, "Content-Type": "application/json"},
            )
            if resp.status_code != 200:
                logger.error(
                    f"Storage sign URL failed ({resp.status_code}): {resp.text}"
                )
                raise AppException(
                    status_code=500,
                    code="storage_error",
                    message="Failed to generate secure document download link",
                )
            data = resp.json()
            signed_url_path = data.get("signedURL") or data.get("signedUrl")
            if signed_url_path and signed_url_path.startswith("http"):
                return signed_url_path
            return f"{self.base_url}{signed_url_path}"


storage_service = SupabaseStorageService()
