from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class QuotaUsage(BaseModel):
    used: int
    limit: int
    remaining: int


class UserQuotas(BaseModel):
    questions: QuotaUsage
    uploads: QuotaUsage
    workspaces: QuotaUsage


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str | None = None
    display_name: str | None = None
    is_admin: bool = False
    created_at: datetime | None = None


class UserMeResponse(BaseModel):
    profile: UserProfileResponse
    quotas: UserQuotas
