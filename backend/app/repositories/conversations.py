import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.core.config import settings
from app.core.errors import AppException
from app.core.logging import get_logger
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = get_logger("app.repositories.conversations")


async def check_chat_enabled(db: AsyncSession) -> None:
    """Checks the global 'chat_enabled' kill-switch (S17)."""
    res = await db.execute(
        text("SELECT value FROM app_settings WHERE key = 'chat_enabled'")
    )
    row = res.scalar()
    if row is False or row == "false":
        raise AppException(
            status_code=503,
            code="chat_disabled",
            message="Chat functionality is currently disabled by administrator.",
        )


async def check_and_record_question_quota(
    db: AsyncSession, user_id: UUID, workspace_id: UUID
) -> None:
    """Verifies user daily question quota and records the usage event in the same transaction."""
    today_utc = datetime.now(UTC).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    user_questions_res = await db.execute(
        text(
            """
            SELECT COUNT(*) FROM usage_events
            WHERE user_id = :uid AND kind = 'question' AND created_at >= :today;
            """
        ),
        {"uid": user_id, "today": today_utc},
    )
    user_questions_today = user_questions_res.scalar() or 0
    if user_questions_today >= settings.DAILY_QUESTIONS_PER_USER:
        raise AppException(
            status_code=429,
            code="daily_question_quota_exceeded",
            message=f"Daily question quota ({settings.DAILY_QUESTIONS_PER_USER}) exceeded. Please try again tomorrow.",
        )

    # Record question usage event
    await db.execute(
        text(
            """
            INSERT INTO usage_events (user_id, workspace_id, kind, units)
            VALUES (:uid, :wid, 'question', 1);
            """
        ),
        {"uid": user_id, "wid": workspace_id},
    )


async def get_or_create_conversation(
    db: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
    conversation_id: UUID | None,
    initial_question: str,
) -> dict[str, Any]:
    """Retrieves existing conversation or creates a new one scoped to workspace_id and user_id (S6)."""
    if conversation_id:
        query = text(
            """
            SELECT id, workspace_id, user_id, title, created_at, updated_at
            FROM conversations
            WHERE id = :cid AND workspace_id = :wid AND user_id = :uid;
            """
        )
        res = await db.execute(
            query, {"cid": conversation_id, "wid": workspace_id, "uid": user_id}
        )
        row = res.mappings().first()
        if not row:
            raise AppException(
                status_code=404,
                code="conversation_not_found",
                message="Conversation not found",
            )
        return dict(row)

    # Create new conversation with title derived from question
    clean_q = initial_question.strip().replace("\n", " ")
    title = clean_q[:40] + ("..." if len(clean_q) > 40 else "")

    insert_query = text(
        """
        INSERT INTO conversations (workspace_id, user_id, title)
        VALUES (:wid, :uid, :title)
        RETURNING id, workspace_id, user_id, title, created_at, updated_at;
        """
    )
    res = await db.execute(
        insert_query, {"wid": workspace_id, "uid": user_id, "title": title}
    )
    row = res.mappings().one()
    return dict(row)


async def save_message(
    db: AsyncSession,
    conversation_id: UUID,
    workspace_id: UUID,
    role: str,
    content: str,
    citations: list[dict[str, Any]] | None = None,
    grounded: bool | None = None,
    model: str | None = None,
    latency_ms: int | None = None,
) -> dict[str, Any]:
    """Persists a chat message and updates conversation updated_at."""
    citations_json = json.dumps(citations or [])

    insert_query = text(
        """
        INSERT INTO messages (
            conversation_id, workspace_id, role, content,
            citations, grounded, model, latency_ms
        )
        VALUES (
            :cid, :wid, CAST(:role AS message_role), :content,
            CAST(:citations AS jsonb), :grounded, :model, :latency_ms
        )
        RETURNING id, conversation_id, workspace_id, role, content,
                  citations, grounded, model, latency_ms, created_at;
        """
    )
    res = await db.execute(
        insert_query,
        {
            "cid": conversation_id,
            "wid": workspace_id,
            "role": role,
            "content": content,
            "citations": citations_json,
            "grounded": grounded,
            "model": model,
            "latency_ms": latency_ms,
        },
    )
    row = dict(res.mappings().one())

    # Update conversation's updated_at timestamp
    await db.execute(
        text(
            "UPDATE conversations SET updated_at = now() WHERE id = :cid AND workspace_id = :wid;"
        ),
        {"cid": conversation_id, "wid": workspace_id},
    )

    return row


async def list_workspace_conversations(
    db: AsyncSession, workspace_id: UUID, user_id: UUID
) -> list[dict[str, Any]]:
    """Lists caller's conversations in the workspace ordered by updated_at desc (S6)."""
    query = text(
        """
        SELECT id, title, created_at, updated_at
        FROM conversations
        WHERE workspace_id = :wid AND user_id = :uid
        ORDER BY updated_at DESC;
        """
    )
    res = await db.execute(query, {"wid": workspace_id, "uid": user_id})
    return [dict(r) for r in res.mappings().all()]


async def get_conversation_with_messages(
    db: AsyncSession, workspace_id: UUID, user_id: UUID, conversation_id: UUID
) -> dict[str, Any] | None:
    """Returns conversation and its message history (S6)."""
    conv_query = text(
        """
        SELECT id, title, created_at, updated_at
        FROM conversations
        WHERE id = :cid AND workspace_id = :wid AND user_id = :uid;
        """
    )
    conv_res = await db.execute(
        conv_query, {"cid": conversation_id, "wid": workspace_id, "uid": user_id}
    )
    conv = conv_res.mappings().first()
    if not conv:
        return None

    msg_query = text(
        """
        SELECT id, role, content, citations, grounded, created_at
        FROM messages
        WHERE conversation_id = :cid AND workspace_id = :wid
        ORDER BY created_at ASC;
        """
    )
    msg_res = await db.execute(
        msg_query, {"cid": conversation_id, "wid": workspace_id}
    )
    messages = [dict(r) for r in msg_res.mappings().all()]

    return {
        "id": conv["id"],
        "title": conv["title"],
        "created_at": conv["created_at"],
        "updated_at": conv["updated_at"],
        "messages": messages,
    }


async def get_conversation_turns(
    db: AsyncSession, workspace_id: UUID, conversation_id: UUID, limit: int = 4
) -> list[dict[str, str]]:
    """Fetches the last N turns for question condensation."""
    query = text(
        """
        SELECT role, content
        FROM messages
        WHERE conversation_id = :cid AND workspace_id = :wid
        ORDER BY created_at DESC
        LIMIT :limit;
        """
    )
    res = await db.execute(
        query, {"cid": conversation_id, "wid": workspace_id, "limit": limit}
    )
    rows = [dict(r) for r in res.mappings().all()]
    rows.reverse()
    return [{"role": str(r["role"]), "content": str(r["content"])} for r in rows]


async def rename_conversation(
    db: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
    conversation_id: UUID,
    new_title: str,
) -> dict[str, Any] | None:
    """Renames a conversation (S6)."""
    query = text(
        """
        UPDATE conversations
        SET title = :title, updated_at = now()
        WHERE id = :cid AND workspace_id = :wid AND user_id = :uid
        RETURNING id, title, created_at, updated_at;
        """
    )
    res = await db.execute(
        query,
        {
            "cid": conversation_id,
            "wid": workspace_id,
            "uid": user_id,
            "title": new_title,
        },
    )
    row = res.mappings().first()
    return dict(row) if row else None


async def delete_conversation(
    db: AsyncSession, workspace_id: UUID, user_id: UUID, conversation_id: UUID
) -> bool:
    """Deletes conversation and cascades messages (S6)."""
    query = text(
        """
        DELETE FROM conversations
        WHERE id = :cid AND workspace_id = :wid AND user_id = :uid;
        """
    )
    res = await db.execute(
        query, {"cid": conversation_id, "wid": workspace_id, "uid": user_id}
    )
    return res.rowcount > 0


async def upsert_message_feedback(
    db: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
    message_id: UUID,
    rating: int,
    comment: str | None,
) -> dict[str, Any]:
    """Records user feedback for an assistant message in the workspace (Blueprint 5.3)."""
    # Verify message exists in this workspace
    check_query = text(
        "SELECT id FROM messages WHERE id = :mid AND workspace_id = :wid;"
    )
    res = await db.execute(check_query, {"mid": message_id, "wid": workspace_id})
    if not res.scalar():
        raise AppException(
            status_code=404,
            code="message_not_found",
            message="Message not found in this workspace",
        )

    upsert_query = text(
        """
        INSERT INTO message_feedback (message_id, user_id, rating, comment)
        VALUES (:mid, :uid, :rating, :comment)
        ON CONFLICT (message_id, user_id)
        DO UPDATE SET rating = :rating, comment = :comment, created_at = now()
        RETURNING id, message_id, user_id, rating, comment, created_at;
        """
    )
    upsert_res = await db.execute(
        upsert_query,
        {
            "mid": message_id,
            "uid": user_id,
            "rating": rating,
            "comment": comment,
        },
    )
    return dict(upsert_res.mappings().one())


async def record_unanswered_question(
    db: AsyncSession,
    workspace_id: UUID,
    message_id: UUID | None,
    question: str,
    top_score: float | None,
) -> None:
    """Logs an unanswered question when similarity is below threshold or unanswerable."""
    query = text(
        """
        INSERT INTO unanswered_questions (workspace_id, message_id, question, top_score, status)
        VALUES (:wid, :mid, :question, :score, 'open');
        """
    )
    await db.execute(
        query,
        {
            "wid": workspace_id,
            "mid": message_id,
            "question": question,
            "score": top_score,
        },
    )


async def list_unanswered_questions(
    db: AsyncSession, workspace_id: UUID
) -> list[dict[str, Any]]:
    """Lists open/unanswered questions for the workspace."""
    query = text(
        """
        SELECT id, question, top_score, status, message_id, created_at
        FROM unanswered_questions
        WHERE workspace_id = :wid
        ORDER BY created_at DESC;
        """
    )
    res = await db.execute(query, {"wid": workspace_id})
    return [dict(r) for r in res.mappings().all()]


async def update_unanswered_status(
    db: AsyncSession, workspace_id: UUID, item_id: UUID, new_status: str
) -> dict[str, Any] | None:
    """Updates status of an unanswered question item."""
    query = text(
        """
        UPDATE unanswered_questions
        SET status = :status
        WHERE id = :qid AND workspace_id = :wid
        RETURNING id, question, top_score, status, message_id, created_at;
        """
    )
    res = await db.execute(
        query, {"qid": item_id, "wid": workspace_id, "status": new_status}
    )
    row = res.mappings().first()
    return dict(row) if row else None
