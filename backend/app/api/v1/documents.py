import uuid
from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import AppException, NotFoundException
from app.core.security import WorkspaceMemberContext, require_member
from app.core.storage import storage_service
from app.repositories import documents as doc_repo
from app.schemas.document import (
    DocumentDetail,
    DocumentDownloadResponse,
    DocumentSummary,
    DocumentUploadResponse,
)
from app.services.ingestion.validators import validate_and_stream_upload

router = APIRouter(prefix="/workspaces/{wid}/documents", tags=["documents"])


@router.post(
    "",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_document_endpoint(
    wid: UUID,
    file: Annotated[UploadFile, File(...)],
    confidentiality_ack: Annotated[bool, Form()] = False,
    member_ctx: Annotated[
        WorkspaceMemberContext,
        Depends(require_member(min_role="member")),
    ] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> DocumentUploadResponse:
    """Uploads, validates, and stores a document in the workspace (S11-S15).
    
    Returns 202 Accepted with pending document id.
    """
    if not confidentiality_ack:
        raise AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="confidentiality_ack_required",
            message="You must acknowledge the confidentiality notice before uploading.",
        )

    # 1. Global killswitch check
    await doc_repo.check_uploads_enabled(db)

    # 2. Stream, calculate SHA-256, and validate format & magic bytes
    content_bytes, sanitized_name, sha256, mime_type, page_count = (
        await validate_and_stream_upload(file)
    )

    # 3. Check doc limits and daily user upload quota in one transaction
    await doc_repo.check_and_record_upload_quota(db, member_ctx.user.id, wid)

    # 4. Upload to secure storage path: {workspace_id}/{document_id}/original (S13)
    document_id = uuid.uuid4()
    storage_path = f"{wid}/{document_id}/original"
    await storage_service.upload_file(storage_path, content_bytes, mime_type)

    # 5. Insert document row with status 'pending'
    doc = await doc_repo.create_document(
        db=db,
        document_id=document_id,
        workspace_id=wid,
        user_id=member_ctx.user.id,
        filename=sanitized_name,
        storage_path=storage_path,
        mime_type=mime_type,
        size_bytes=len(content_bytes),
        sha256=sha256,
        page_count=page_count,
    )

    return DocumentUploadResponse(id=doc["id"], status=doc["status"])


@router.get("", response_model=list[DocumentSummary])
async def list_documents_endpoint(
    wid: UUID,
    member_ctx: Annotated[
        WorkspaceMemberContext,
        Depends(require_member(min_role="member")),
    ],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[DocumentSummary]:
    """Lists all documents in the workspace. Scoped by workspace_id."""
    docs = await doc_repo.list_workspace_documents(db, wid)
    return [DocumentSummary.model_validate(d) for d in docs]


@router.get("/{did}", response_model=DocumentDetail)
async def get_document_endpoint(
    wid: UUID,
    did: UUID,
    member_ctx: Annotated[
        WorkspaceMemberContext,
        Depends(require_member(min_role="member")),
    ],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DocumentDetail:
    """Gets document detail and error_message. Scoped by workspace_id."""
    doc = await doc_repo.get_workspace_document(db, wid, did)
    if not doc:
        raise NotFoundException(code="not_found", message="Document not found")
    return DocumentDetail.model_validate(doc)


@router.post("/{did}/retry", response_model=DocumentSummary)
async def retry_document_endpoint(
    wid: UUID,
    did: UUID,
    member_ctx: Annotated[
        WorkspaceMemberContext,
        Depends(require_member(min_role="member")),
    ],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DocumentSummary:
    """Resets a failed document to pending status for re-ingestion."""
    existing = await doc_repo.get_workspace_document(db, wid, did)
    if not existing:
        raise NotFoundException(code="not_found", message="Document not found")

    if existing["status"] != "failed":
        raise AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="invalid_document_state",
            message=f"Only failed documents can be retried (current status: '{existing['status']}').",
        )

    updated = await doc_repo.retry_workspace_document(db, wid, did)
    return DocumentSummary.model_validate(updated)


@router.get("/{did}/download", response_model=DocumentDownloadResponse)
async def download_document_endpoint(
    wid: UUID,
    did: UUID,
    member_ctx: Annotated[
        WorkspaceMemberContext,
        Depends(require_member(min_role="member")),
    ],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DocumentDownloadResponse:
    """Generates a temporary signed URL (5 minutes) for document download."""
    doc = await doc_repo.get_workspace_document(db, wid, did)
    if not doc:
        raise NotFoundException(code="not_found", message="Document not found")

    if not doc.get("storage_path"):
        raise NotFoundException(
            code="not_found", message="Storage file not found for document"
        )

    signed_url = await storage_service.create_signed_url(
        doc["storage_path"], expires_in=300
    )
    return DocumentDownloadResponse(download_url=signed_url, expires_in=300)


@router.delete("/{did}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document_endpoint(
    wid: UUID,
    did: UUID,
    member_ctx: Annotated[
        WorkspaceMemberContext,
        Depends(require_member(min_role="member")),
    ],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Deletes the storage object and document record (chunks cascade)."""
    success, storage_path = await doc_repo.delete_workspace_document(
        db, wid, did, member_ctx.user.id
    )
    if not success:
        raise NotFoundException(code="not_found", message="Document not found")

    if storage_path:
        await storage_service.delete_file(storage_path)
