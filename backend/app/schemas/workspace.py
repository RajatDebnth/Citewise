from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80, description="Workspace name")


class WorkspaceUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80, description="New workspace name")


class WorkspaceSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    role: str
    is_demo: bool
    created_at: datetime


class WorkspaceStats(BaseModel):
    document_count: int = 0
    chunk_count: int = 0
    member_count: int = 1


class WorkspaceDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    owner_id: UUID
    role: str
    is_demo: bool
    created_at: datetime
    stats: WorkspaceStats


class WorkspaceMemberSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    email: str | None = None
    display_name: str | None = None
    role: str
    created_at: datetime
