from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import AppException
from app.core.limits import limiter
from app.core.logging import get_logger
from app.core.security import (
    AuthenticatedUser,
    WorkspaceMemberContext,
    get_current_user,
    require_member,
)
from app.rag.pipeline import ask_question
from app.repositories import conversations as conv_repo
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConversationDetailResponse,
    ConversationListItem,
    FeedbackRequest,
    RenameConversationRequest,
    UnansweredQuestionResponse,
    UpdateUnansweredStatusRequest,
)

logger = get_logger("app.api.chat")

router = APIRouter(tags=["chat"])


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

@router.post(
    "/workspaces/{wid}/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("30/minute")
async def chat_endpoint(
    request: Request,
    wid: UUID,
    payload: ChatRequest,
    member_ctx: Annotated[WorkspaceMemberContext, Depends(require_member("member"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChatResponse:
    """Answers a question grounded in the workspace documents (Blueprint 5.3, 6.4)."""
    resp = await ask_question(
        db=db,
        workspace_id=wid,
        user_id=member_ctx.user.id,
        question=payload.question,
        conversation_id=payload.conversation_id,
        document_ids=payload.document_ids,
    )
    return ChatResponse(**resp)


# ---------------------------------------------------------------------------
# Conversations CRUD
# ---------------------------------------------------------------------------

@router.get(
    "/workspaces/{wid}/conversations",
    response_model=list[ConversationListItem],
    status_code=status.HTTP_200_OK,
)
async def list_conversations_endpoint(
    wid: UUID,
    member_ctx: Annotated[WorkspaceMemberContext, Depends(require_member("member"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ConversationListItem]:
    """Lists caller's conversations in the workspace ordered by updated_at desc (S6)."""
    convs = await conv_repo.list_workspace_conversations(
        db=db, workspace_id=wid, user_id=member_ctx.user.id
    )
    return [ConversationListItem(**c) for c in convs]


@router.get(
    "/workspaces/{wid}/conversations/{cid}",
    response_model=ConversationDetailResponse,
    status_code=status.HTTP_200_OK,
)
async def get_conversation_endpoint(
    wid: UUID,
    cid: UUID,
    member_ctx: Annotated[WorkspaceMemberContext, Depends(require_member("member"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ConversationDetailResponse:
    """Retrieves conversation with full message history and citations (S6)."""
    conv = await conv_repo.get_conversation_with_messages(
        db=db, workspace_id=wid, user_id=member_ctx.user.id, conversation_id=cid
    )
    if not conv:
        raise AppException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="conversation_not_found",
            message="Conversation not found",
        )
    return ConversationDetailResponse(**conv)


@router.patch(
    "/workspaces/{wid}/conversations/{cid}",
    response_model=ConversationListItem,
    status_code=status.HTTP_200_OK,
)
async def rename_conversation_endpoint(
    wid: UUID,
    cid: UUID,
    payload: RenameConversationRequest,
    member_ctx: Annotated[WorkspaceMemberContext, Depends(require_member("member"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ConversationListItem:
    """Renames a conversation (S6)."""
    updated = await conv_repo.rename_conversation(
        db=db,
        workspace_id=wid,
        user_id=member_ctx.user.id,
        conversation_id=cid,
        new_title=payload.title,
    )
    if not updated:
        raise AppException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="conversation_not_found",
            message="Conversation not found",
        )
    await db.commit()
    return ConversationListItem(**updated)


@router.delete(
    "/workspaces/{wid}/conversations/{cid}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_conversation_endpoint(
    wid: UUID,
    cid: UUID,
    member_ctx: Annotated[WorkspaceMemberContext, Depends(require_member("member"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Deletes a conversation and its messages (S6)."""
    deleted = await conv_repo.delete_conversation(
        db=db, workspace_id=wid, user_id=member_ctx.user.id, conversation_id=cid
    )
    if not deleted:
        raise AppException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="conversation_not_found",
            message="Conversation not found",
        )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Message Feedback
# ---------------------------------------------------------------------------

@router.post(
    "/messages/{mid}/feedback",
    status_code=status.HTTP_200_OK,
)
async def message_feedback_endpoint(
    mid: UUID,
    payload: FeedbackRequest,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    """Records user feedback for an assistant message (Blueprint 5.3).
    
    Verifies that the caller is a member of the workspace the message belongs to.
    """
    msg_res = await db.execute(
        text("SELECT workspace_id FROM messages WHERE id = :mid;"),
        {"mid": mid},
    )
    msg_row = msg_res.mappings().first()
    if not msg_row:
        raise AppException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="message_not_found",
            message="Message not found",
        )

    workspace_id = msg_row["workspace_id"]
    # Check caller is member of that workspace
    member_res = await db.execute(
        text(
            "SELECT role FROM workspace_members WHERE workspace_id = :wid AND user_id = :uid;"
        ),
        {"wid": workspace_id, "uid": user.id},
    )
    if not member_res.scalar():
        raise AppException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="message_not_found",
            message="Message not found",
        )

    feedback = await conv_repo.upsert_message_feedback(
        db=db,
        workspace_id=workspace_id,
        user_id=user.id,
        message_id=mid,
        rating=payload.rating,
        comment=payload.comment,
    )
    await db.commit()
    return {
        "status": "ok",
        "message_id": str(feedback["message_id"]),
        "rating": feedback["rating"],
        "comment": feedback["comment"],
    }


# ---------------------------------------------------------------------------
# Unanswered Questions
# ---------------------------------------------------------------------------

@router.get(
    "/workspaces/{wid}/unanswered",
    response_model=list[UnansweredQuestionResponse],
    status_code=status.HTTP_200_OK,
)
async def list_unanswered_endpoint(
    wid: UUID,
    member_ctx: Annotated[WorkspaceMemberContext, Depends(require_member("member"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[UnansweredQuestionResponse]:
    """Lists unanswered questions for the workspace (Blueprint 5.3)."""
    items = await conv_repo.list_unanswered_questions(db=db, workspace_id=wid)
    return [UnansweredQuestionResponse(**i) for i in items]


@router.patch(
    "/workspaces/{wid}/unanswered/{uid}",
    response_model=UnansweredQuestionResponse,
    status_code=status.HTTP_200_OK,
)
async def update_unanswered_status_endpoint(
    wid: UUID,
    uid: UUID,
    payload: UpdateUnansweredStatusRequest,
    member_ctx: Annotated[WorkspaceMemberContext, Depends(require_member("member"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UnansweredQuestionResponse:
    """Updates status ('open', 'resolved', 'ignored') of an unanswered item."""
    updated = await conv_repo.update_unanswered_status(
        db=db, workspace_id=wid, item_id=uid, new_status=payload.status
    )
    if not updated:
        raise AppException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="item_not_found",
            message="Unanswered question item not found",
        )
    await db.commit()
    return UnansweredQuestionResponse(**updated)
