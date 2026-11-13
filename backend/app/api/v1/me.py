from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.core.security import AuthenticatedUser, get_current_user
from app.repositories import workspaces as ws_repo
from app.schemas.user import QuotaUsage, UserMeResponse, UserProfileResponse, UserQuotas

router = APIRouter(tags=["me"])


@router.get("/me", response_model=UserMeResponse)
async def get_me_endpoint(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserMeResponse:
    """Returns the caller's profile and active daily quotas."""
    # 1. Fetch user profile
    res = await db.execute(
        text("SELECT id, email, display_name, is_admin, created_at FROM profiles WHERE id = :uid"),
        {"uid": user.id},
    )
    profile_row = res.mappings().one()
    profile = UserProfileResponse.model_validate(profile_row)

    # 2. Count usage events today (UTC midnight)
    today_utc = datetime.now(UTC).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    usage_res = await db.execute(
        text(
            """
            SELECT kind, COUNT(*) as count
            FROM usage_events
            WHERE user_id = :uid AND created_at >= :today
            GROUP BY kind;
            """
        ),
        {"uid": user.id, "today": today_utc},
    )
    usage_map = {r["kind"]: r["count"] for r in usage_res.mappings().all()}

    questions_used = usage_map.get("question", 0)
    uploads_used = usage_map.get("upload", 0)
    workspaces_owned = await ws_repo.count_user_owned_workspaces(db, user.id)

    quotas = UserQuotas(
        questions=QuotaUsage(
            used=questions_used,
            limit=settings.DAILY_QUESTIONS_PER_USER,
            remaining=max(0, settings.DAILY_QUESTIONS_PER_USER - questions_used),
        ),
        uploads=QuotaUsage(
            used=uploads_used,
            limit=settings.DAILY_UPLOADS_PER_USER,
            remaining=max(0, settings.DAILY_UPLOADS_PER_USER - uploads_used),
        ),
        workspaces=QuotaUsage(
            used=workspaces_owned,
            limit=settings.MAX_WORKSPACES_PER_USER,
            remaining=max(0, settings.MAX_WORKSPACES_PER_USER - workspaces_owned),
        ),
    )

    return UserMeResponse(profile=profile, quotas=quotas)
