import json
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.core.security import AuthenticatedUser, require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminUsageResponse(BaseModel):
    db_size_bytes: int
    total_workspaces: int
    total_documents: int
    total_chunks: int
    active_users_7d: int
    gemini_calls_today: dict[str, int]
    settings: dict[str, Any]


class AdminSettingsUpdate(BaseModel):
    uploads_enabled: bool | None = None
    chat_enabled: bool | None = None
    global_max_chunks: int | None = Field(default=None, ge=100, le=1000000)


@router.get("/usage", response_model=AdminUsageResponse)
async def get_admin_usage(
    admin: Annotated[AuthenticatedUser, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminUsageResponse:
    """Returns platform usage metrics, storage estimates, and Gemini API consumption (Blueprint 5.5)."""
    # 1. Total counts
    counts_res = await db.execute(
        text(
            """
            SELECT
                (SELECT COUNT(*) FROM workspaces) AS total_workspaces,
                (SELECT COUNT(*) FROM documents) AS total_documents,
                (SELECT COUNT(*) FROM document_chunks) AS total_chunks,
                (SELECT COUNT(DISTINCT user_id) FROM usage_events WHERE created_at >= now() - interval '7 days') AS active_users_7d;
            """
        )
    )
    counts = counts_res.mappings().first() or {}

    # 2. Today's Gemini calls
    calls_res = await db.execute(
        text(
            """
            SELECT
                COUNT(*) FILTER (WHERE kind = 'embed_call') AS embed_calls,
                COUNT(*) FILTER (WHERE kind = 'llm_call') AS llm_calls,
                COUNT(*) FILTER (WHERE kind = 'question') AS questions,
                COUNT(*) FILTER (WHERE kind = 'demo_question') AS demo_questions
            FROM usage_events
            WHERE created_at >= date_trunc('day', now() at time zone 'utc');
            """
        )
    )
    calls = calls_res.mappings().first() or {}
    embed_calls = int(calls.get("embed_calls") or 0)
    llm_calls = int(calls.get("llm_calls") or 0)
    total_gemini = embed_calls + llm_calls

    # 3. Database size estimate
    db_size = 0
    try:
        size_res = await db.execute(text("SELECT pg_database_size(current_database()) AS size;"))
        db_size = int(size_res.scalar_one() or 0)
    except Exception:  # noqa: BLE001
        db_size = int(counts.get("total_chunks", 0)) * 4096  # fallback heuristic

    # 4. App settings
    settings_res = await db.execute(text("SELECT key, value FROM app_settings;"))
    app_settings_dict = {
        row["key"]: row["value"]
        for row in settings_res.mappings().all()
    }

    return AdminUsageResponse(
        db_size_bytes=db_size,
        total_workspaces=int(counts.get("total_workspaces", 0)),
        total_documents=int(counts.get("total_documents", 0)),
        total_chunks=int(counts.get("total_chunks", 0)),
        active_users_7d=int(counts.get("active_users_7d", 0)),
        gemini_calls_today={
            "embed_calls": embed_calls,
            "llm_calls": llm_calls,
            "total": total_gemini,
            "daily_budget": settings.GEMINI_DAILY_CALL_BUDGET,
            "questions": int(calls.get("questions") or 0),
            "demo_questions": int(calls.get("demo_questions") or 0),
        },
        settings=app_settings_dict,
    )


@router.patch("/settings", response_model=dict[str, Any])
async def update_admin_settings(
    payload: AdminSettingsUpdate,
    admin: Annotated[AuthenticatedUser, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    """Updates global kill-switches and limits in app_settings (Blueprint 5.5)."""
    updates = {}
    if payload.uploads_enabled is not None:
        updates["uploads_enabled"] = payload.uploads_enabled
    if payload.chat_enabled is not None:
        updates["chat_enabled"] = payload.chat_enabled
    if payload.global_max_chunks is not None:
        updates["global_max_chunks"] = payload.global_max_chunks

    for k, v in updates.items():
        val_json = json.dumps(v)
        await db.execute(
            text(
                """
                INSERT INTO app_settings (key, value)
                VALUES (:k, CAST(:v AS jsonb))
                ON CONFLICT (key) DO UPDATE SET value = CAST(:v AS jsonb);
                """
            ),
            {"k": k, "v": val_json},
        )

    await db.commit()

    settings_res = await db.execute(text("SELECT key, value FROM app_settings;"))
    return {
        row["key"]: row["value"]
        for row in settings_res.mappings().all()
    }
