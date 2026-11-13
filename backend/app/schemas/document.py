from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DocumentSummary(BaseModel):
    id: UUID
    filename: str
    mime_type: str
    size_bytes: int
    status: str
    page_count: int | None = None
    chunk_count: int = 0
    created_at: datetime
    error_message: str | None = None


class DocumentDetail(DocumentSummary):
    workspace_id: UUID
    storage_path: str | None = None
    attempts: int = 0
    processed_at: datetime | None = None


class DocumentUploadResponse(BaseModel):
    id: UUID
    status: str = "pending"


class DocumentDownloadResponse(BaseModel):
    download_url: str
    expires_in: int = 300
