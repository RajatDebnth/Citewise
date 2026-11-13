from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.core.errors import AppException, NotFoundException
from app.core.security import (
    AuthenticatedUser,
    WorkspaceMemberContext,
    get_current_user,
    require_member,
)
from app.repositories import workspaces as ws_repo
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceDetail,
    WorkspaceMemberSummary,
    WorkspaceSummary,
    WorkspaceUpdate,
)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.post("", response_model=WorkspaceSummary, status_code=status.HTTP_201_CREATED)
async def create_workspace_endpoint(
    payload: WorkspaceCreate,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkspaceSummary:
    """Creates a workspace and assigns the user as owner.

    Enforces MAX_WORKSPACES_PER_USER.
    """
    owned_count = await ws_repo.count_user_owned_workspaces(db, user.id)
    if owned_count >= settings.MAX_WORKSPACES_PER_USER:
        raise AppException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="workspace_limit_exceeded",
            message=f"Maximum allowed workspaces ({settings.MAX_WORKSPACES_PER_USER}) reached.",
        )

    created = await ws_repo.create_workspace(db, user.id, payload.name)
    return WorkspaceSummary.model_validate(created)


@router.get("", response_model=list[WorkspaceSummary])
async def list_workspaces_endpoint(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[WorkspaceSummary]:
    """Lists all workspaces that the caller is a member of."""
    workspaces = await ws_repo.list_user_workspaces(db, user.id)
    return [WorkspaceSummary.model_validate(w) for w in workspaces]


@router.get("/{wid}", response_model=WorkspaceDetail)
async def get_workspace_endpoint(
    wid: UUID,
    member_ctx: Annotated[WorkspaceMemberContext, Depends(require_member(min_role="member"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkspaceDetail:
    """Gets workspace details and statistics.

    Returns 404 for non-members.
    """
    ws = await ws_repo.get_workspace_detail(db, wid)
    if not ws:
        raise NotFoundException(code="not_found", message="Workspace not found")
    ws["role"] = member_ctx.role
    return WorkspaceDetail.model_validate(ws)


@router.patch("/{wid}", response_model=WorkspaceSummary)
async def update_workspace_endpoint(
    wid: UUID,
    payload: WorkspaceUpdate,
    member_ctx: Annotated[WorkspaceMemberContext, Depends(require_member(min_role="owner"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkspaceSummary:
    """Renames a workspace. Requires owner role."""
    updated = await ws_repo.update_workspace_name(db, wid, payload.name)
    if not updated:
        raise NotFoundException(code="not_found", message="Workspace not found")
    updated["role"] = member_ctx.role
    return WorkspaceSummary.model_validate(updated)


@router.delete("/{wid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace_endpoint(
    wid: UUID,
    member_ctx: Annotated[WorkspaceMemberContext, Depends(require_member(min_role="owner"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Deletes a workspace. Requires owner role."""
    deleted = await ws_repo.delete_workspace(db, wid, member_ctx.user.id)
    if not deleted:
        raise NotFoundException(code="not_found", message="Workspace not found")


@router.get("/{wid}/members", response_model=list[WorkspaceMemberSummary])
async def list_members_endpoint(
    wid: UUID,
    member_ctx: Annotated[WorkspaceMemberContext, Depends(require_member(min_role="member"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[WorkspaceMemberSummary]:
    """Lists all members in the workspace. Requires member role."""
    members = await ws_repo.list_workspace_members(db, wid)
    return [WorkspaceMemberSummary.model_validate(m) for m in members]


@router.post("/{wid}/members", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def add_member_endpoint(
    wid: UUID,
    member_ctx: Annotated[WorkspaceMemberContext, Depends(require_member(min_role="owner"))],
) -> dict[str, str]:
    """Stub for member addition (P2 feature)."""
    raise AppException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        code="not_implemented",
        message="Member management is scheduled for post-MVP phase.",
    )


@router.delete("/{wid}/members/{uid}", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def remove_member_endpoint(
    wid: UUID,
    uid: UUID,
    member_ctx: Annotated[WorkspaceMemberContext, Depends(require_member(min_role="owner"))],
) -> dict[str, str]:
    """Stub for member removal (P2 feature)."""
    raise AppException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        code="not_implemented",
        message="Member removal is scheduled for post-MVP phase.",
    )
