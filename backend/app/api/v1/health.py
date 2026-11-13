from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.core.errors import AppException
from app.core.limits import limiter
from app.core.logging import get_logger

logger = get_logger("app.api.health")

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str = "ok"


class DeepHealthResponse(BaseModel):
    status: str = "ok"
    db: str = "ok"
    storage: str = "ok"


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Lightweight health check for pingers and frontend wake check."""
    return HealthResponse(status="ok")


@router.get("/health/deep", response_model=DeepHealthResponse)
@limiter.limit("60/minute")
async def deep_health_check(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DeepHealthResponse:
    """Deep health check that verifies PostgreSQL connection and Supabase Storage."""
    # 1. Verify DB
    try:
        await db.execute(text("SELECT 1;"))
    except Exception as e:
        logger.error(f"Deep health DB check failed: {e}")
        raise AppException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="database_unavailable",
            message="Database connection failed",
        ) from e

    # 2. Verify Storage
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY:
        storage_url = f"{settings.SUPABASE_URL}/storage/v1/bucket/{settings.STORAGE_BUCKET}"
        headers = {
            "apikey": settings.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(storage_url, headers=headers)
                if resp.status_code >= 400:
                    logger.error(
                        f"Deep health Storage check returned {resp.status_code}: {resp.text}"
                    )
                    raise AppException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        code="storage_unavailable",
                        message="Storage service returned an error",
                    )
        except AppException:
            raise
        except Exception as e:
            logger.error(f"Deep health Storage check exception: {e}")
            raise AppException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                code="storage_unavailable",
                message="Storage service unreachable",
            ) from e

    return DeepHealthResponse(status="ok", db="ok", storage="ok")
