from typing import Annotated, Any
from uuid import UUID

import jwt
from fastapi import Depends, Header, Path
from jwt import PyJWKClient, PyJWKClientError
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.core.errors import ForbiddenException, NotFoundException, UnauthorizedException
from app.core.logging import get_logger

logger = get_logger("app.security")

# Lazy-loaded JWKS client singleton
_jwks_client: PyJWKClient | None = None


def get_jwks_client() -> PyJWKClient | None:
    global _jwks_client
    if _jwks_client is None and settings.SUPABASE_JWKS_URL:
        _jwks_client = PyJWKClient(
            settings.SUPABASE_JWKS_URL,
            cache_jwk_set=True,
            lifespan=3600,
        )
    return _jwks_client


class AuthenticatedUser(BaseModel):
    id: UUID
    email: str | None = None
    role: str = "authenticated"
    is_admin: bool = False


class WorkspaceMemberContext(BaseModel):
    workspace_id: UUID
    user: AuthenticatedUser
    role: str


def decode_supabase_jwt(token: str) -> dict[str, Any]:
    """Decodes and validates a Supabase JWT via JWKS (RS256/ES256) or HS256 secret."""
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as e:
        raise UnauthorizedException(
            code="invalid_token", message="Malformed authentication token"
        ) from e

    alg = header.get("alg")
    payload: dict[str, Any] | None = None

    if alg in ("RS256", "ES256"):
        # Asymmetric verification via JWKS
        jwks = get_jwks_client()
        if jwks:
            try:
                signing_key = jwks.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256", "ES256"],
                    options={"verify_aud": False, "verify_exp": True},
                )
            except (PyJWKClientError, jwt.InvalidTokenError) as e:
                logger.debug(f"JWKS verification failed: {e}")

    elif alg == "HS256" and settings.SUPABASE_JWT_SECRET:
        # Symmetric verification via secret
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False, "verify_exp": True},
            )
        except jwt.PyJWTError as e:
            logger.debug(f"HS256 verification failed: {e}")

    if payload is None:
        raise UnauthorizedException(
            code="invalid_token", message="Invalid, forged, or unverified authentication token"
        )

    # Validate exp claim
    if "exp" not in payload:
        raise UnauthorizedException(code="invalid_token", message="Token is missing expiration claim")

    # Validate aud claim if present
    aud = payload.get("aud")
    if aud and aud not in ["authenticated", "test_aud"]:
        raise UnauthorizedException(code="invalid_audience", message="Invalid token audience")

    # Validate subject as valid UUID
    sub_str = payload.get("sub")
    if not sub_str:
        raise UnauthorizedException(code="invalid_token", message="Token is missing subject claim")

    try:
        UUID(str(sub_str))
    except (ValueError, TypeError) as e:
        raise UnauthorizedException(
            code="invalid_token", message="Token subject must be a valid UUID"
        ) from e

    return payload


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> AuthenticatedUser:
    """Dependency that extracts, verifies token, and retrieves the authenticated user."""
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedException(
            code="unauthorized", message="Missing or malformed Authorization header"
        )

    token = authorization.split("Bearer ", 1)[1].strip()
    if not token:
        raise UnauthorizedException(code="unauthorized", message="Empty bearer token")

    payload = decode_supabase_jwt(token)
    user_id = UUID(payload["sub"])
    email = payload.get("email")

    is_admin = False
    if db is not None:
        try:
            res = await db.execute(
                text("SELECT is_admin, email FROM profiles WHERE id = :uid"),
                {"uid": user_id},
            )
            profile_row = res.mappings().first()
            if profile_row:
                is_admin = bool(profile_row["is_admin"])
                email = profile_row["email"] or email
        except (OSError, RuntimeError) as e:
            logger.debug(f"Could not load profile for {user_id}: {e}")

    return AuthenticatedUser(
        id=user_id,
        email=email,
        role=payload.get("role", "authenticated"),
        is_admin=is_admin,
    )


def require_member(min_role: str = "member"):
    """Dependency factory that checks workspace membership and role permissions.

    Returns 404 for non-members to prevent leaking workspace existence.
    Returns 403 if role is insufficient (e.g. member attempting owner action).
    """

    async def _require_member(
        wid: Annotated[UUID, Path(..., description="Workspace ID")],
        user: Annotated[AuthenticatedUser, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> WorkspaceMemberContext:
        res = await db.execute(
            text(
                "SELECT role FROM workspace_members WHERE workspace_id = :wid AND user_id = :uid"
            ),
            {"wid": wid, "uid": user.id},
        )
        row = res.mappings().first()

        # Non-members receive a 404 to avoid leaking workspace existence
        if not row:
            raise NotFoundException(code="not_found", message="Workspace not found")

        user_role = str(row["role"])
        if min_role == "owner" and user_role != "owner":
            raise ForbiddenException(
                code="forbidden",
                message="Owner permissions required for this workspace action",
            )

        return WorkspaceMemberContext(
            workspace_id=wid,
            user=user,
            role=user_role,
        )

    return _require_member


async def require_admin(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> AuthenticatedUser:
    """Dependency that ensures caller has is_admin=True."""
    if not user.is_admin:
        raise ForbiddenException(
            code="admin_required",
            message="Administrator privileges required for this action",
        )
    return user

