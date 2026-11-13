import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.core.config import settings
from app.core.errors import AppException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def check_uploads_enabled(db: AsyncSession) -> None:
    """Checks the global 'uploads_enabled' kill-switch (S17)."""
    res = await db.execute(
        text("SELECT value FROM app_settings WHERE key = 'uploads_enabled'")
    )
    row = res.scalar()
    # value is stored as JSONB, e.g. true or false
    if row is False or row == "false":
        raise AppException(
            status_code=503,
            code="uploads_disabled",
            message="Document uploads are currently disabled by administrator.",
        )


async def check_and_record_upload_quota(
    db: AsyncSession, user_id: UUID, workspace_id: UUID
) -> None:
    """Verifies workspace doc limit and user daily upload quota in the SAME transaction (S16, S18)."""
    # 1. Max documents per workspace
    ws_docs_res = await db.execute(
        text("SELECT COUNT(*) FROM documents WHERE workspace_id = :wid"),
        {"wid": workspace_id},
    )
    ws_docs_count = ws_docs_res.scalar() or 0
    if ws_docs_count >= settings.MAX_DOCS_PER_WORKSPACE:
        raise AppException(
            status_code=400,
            code="workspace_doc_limit_exceeded",
            message=f"Workspace has reached maximum allowed documents ({settings.MAX_DOCS_PER_WORKSPACE}).",
        )

    # 2. User daily upload quota
    today_utc = datetime.now(UTC).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    user_uploads_res = await db.execute(
        text(
            """
            SELECT COUNT(*) FROM usage_events
            WHERE user_id = :uid AND kind = 'upload' AND created_at >= :today;
            """
        ),
        {"uid": user_id, "today": today_utc},
    )
    user_uploads_today = user_uploads_res.scalar() or 0
    if user_uploads_today >= settings.DAILY_UPLOADS_PER_USER:
        raise AppException(
            status_code=429,
            code="daily_upload_quota_exceeded",
            message=f"Daily upload quota ({settings.DAILY_UPLOADS_PER_USER}) exceeded. Please try again tomorrow.",
        )

    # 3. Record upload usage event in the same transaction
    await db.execute(
        text(
            """
            INSERT INTO usage_events (user_id, workspace_id, kind, units)
            VALUES (:uid, :wid, 'upload', 1);
            """
        ),
        {"uid": user_id, "wid": workspace_id},
    )


async def create_document(
    db: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
    filename: str,
    storage_path: str,
    mime_type: str,
    size_bytes: int,
    sha256: str,
    page_count: int | None,
    document_id: UUID | None = None,
) -> dict[str, Any]:
    """Creates a document record with status 'pending' (S13, S15).
    
    Checks duplicate SHA-256 within workspace and writes audit log.
    """
    # Check SHA-256 duplicate within workspace
    dup_res = await db.execute(
        text(
            "SELECT id, filename FROM documents WHERE workspace_id = :wid AND sha256 = :sha256"
        ),
        {"wid": workspace_id, "sha256": sha256},
    )
    dup = dup_res.mappings().first()
    if dup:
        raise AppException(
            status_code=409,
            code="duplicate_document",
            message=f"A document with identical content already exists in this workspace ('{dup['filename']}').",
        )

    did = document_id or UUID(int=0)
    insert_query = text(
        """
        INSERT INTO documents (
            id, workspace_id, filename, storage_path, mime_type,
            size_bytes, sha256, page_count, status
        )
        VALUES (
            COALESCE(NULLIF(:did, '00000000-0000-0000-0000-000000000000'::uuid), gen_random_uuid()),
            :wid, :filename, :storage_path, :mime_type,
            :size_bytes, :sha256, :page_count, 'pending'
        )
        RETURNING id, workspace_id, filename, storage_path, mime_type,
                  size_bytes, sha256, page_count, chunk_count, status,
                  attempts, created_at, processed_at, error_message;
        """
    )
    res = await db.execute(
        insert_query,
        {
            "did": did,
            "wid": workspace_id,
            "filename": filename,
            "storage_path": storage_path,
            "mime_type": mime_type,
            "size_bytes": size_bytes,
            "sha256": sha256,
            "page_count": page_count,
        },
    )
    doc = dict(res.mappings().one())

    # Audit log entry for confidentiality ack & upload (S15)
    audit_query = text(
        """
        INSERT INTO audit_log (user_id, workspace_id, action, detail)
        VALUES (:uid, :wid, 'upload_ack', CAST(:detail AS jsonb));
        """
    )
    await db.execute(
        audit_query,
        {
            "uid": user_id,
            "wid": workspace_id,
            "detail": json.dumps(
                {
                    "document_id": str(doc["id"]),
                    "filename": filename,
                    "sha256": sha256,
                    "size_bytes": size_bytes,
                    "confidentiality_ack": True,
                }
            ),
        },
    )

    await db.commit()
    return doc


async def list_workspace_documents(
    db: AsyncSession, workspace_id: UUID
) -> list[dict[str, Any]]:
    """Lists all documents in the workspace. Always scoped by workspace_id."""
    query = text(
        """
        SELECT id, filename, mime_type, size_bytes, status, page_count,
               chunk_count, created_at, error_message
        FROM documents
        WHERE workspace_id = :wid
        ORDER BY created_at DESC;
        """
    )
    res = await db.execute(query, {"wid": workspace_id})
    return [dict(r) for r in res.mappings().all()]


async def get_workspace_document(
    db: AsyncSession, workspace_id: UUID, document_id: UUID
) -> dict[str, Any] | None:
    """Retrieves single document detail. Always scoped by workspace_id."""
    query = text(
        """
        SELECT id, workspace_id, filename, mime_type, size_bytes, status,
               page_count, chunk_count, storage_path, attempts,
               created_at, processed_at, error_message
        FROM documents
        WHERE workspace_id = :wid AND id = :did;
        """
    )
    res = await db.execute(query, {"wid": workspace_id, "did": document_id})
    row = res.mappings().first()
    return dict(row) if row else None


async def retry_workspace_document(
    db: AsyncSession, workspace_id: UUID, document_id: UUID
) -> dict[str, Any] | None:
    """Resets a failed document to 'pending' with attempts = 0. Always scoped by workspace_id."""
    query = text(
        """
        UPDATE documents
        SET status = 'pending', attempts = 0, error_message = NULL, locked_at = NULL
        WHERE workspace_id = :wid AND id = :did AND status = 'failed'
        RETURNING id, workspace_id, filename, mime_type, size_bytes, status,
                  page_count, chunk_count, storage_path, attempts,
                  created_at, processed_at, error_message;
        """
    )
    res = await db.execute(query, {"wid": workspace_id, "did": document_id})
    row = res.mappings().first()
    if row:
        await db.commit()
        return dict(row)
    return None


async def delete_workspace_document(
    db: AsyncSession, workspace_id: UUID, document_id: UUID, user_id: UUID
) -> tuple[bool, str | None]:
    """Deletes document row (chunks cascade on DB). Returns (success, storage_path). Always scoped by workspace_id."""
    find_query = text(
        """
        SELECT storage_path, filename FROM documents
        WHERE workspace_id = :wid AND id = :did;
        """
    )
    res = await db.execute(find_query, {"wid": workspace_id, "did": document_id})
    row = res.mappings().first()
    if not row:
        return False, None

    storage_path = row["storage_path"]
    filename = row["filename"]

    # Write audit log before deleting
    audit_query = text(
        """
        INSERT INTO audit_log (user_id, workspace_id, action, detail)
        VALUES (:uid, :wid, 'document_delete', CAST(:detail AS jsonb));
        """
    )
    await db.execute(
        audit_query,
        {
            "uid": user_id,
            "wid": workspace_id,
            "detail": json.dumps(
                {
                    "document_id": str(document_id),
                    "filename": filename,
                    "storage_path": storage_path,
                }
            ),
        },
    )

    del_query = text(
        "DELETE FROM documents WHERE workspace_id = :wid AND id = :did;"
    )
    await db.execute(del_query, {"wid": workspace_id, "did": document_id})
    await db.commit()
    return True, storage_path
