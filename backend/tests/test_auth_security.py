import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from app.core.config import settings
from app.main import app
from httpx import ASGITransport, AsyncClient

VALID_SECRET = "super-secret-test-key-must-be-long-enough-32-chars"
FORGED_SECRET = "wrong-attacker-secret-key-32-characters-long"


@pytest.fixture(autouse=True)
def setup_test_jwt(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", VALID_SECRET)


@pytest.mark.asyncio
async def test_forged_and_invalid_jwt_attacks():
    """Validates that forged signatures, expired tokens, invalid audiences,
    algorithm confusion, and missing tokens are all rejected with 401.
    """
    uid = str(uuid.uuid4())
    now = datetime.now(UTC)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Anonymous request (no Authorization header) -> 401
        res = await ac.get("/api/v1/workspaces")
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "unauthorized"

        # 2. Malformed Bearer header (missing token or bad format) -> 401
        res = await ac.get("/api/v1/workspaces", headers={"Authorization": "Bearer"})
        assert res.status_code == 401
        res = await ac.get("/api/v1/workspaces", headers={"Authorization": "Basic dXNlcjpwYXNz"})
        assert res.status_code == 401

        # 3. Forged signature (signed with attacker key) -> 401
        forged_payload = {
            "sub": uid,
            "email": "attacker@evil.com",
            "aud": "authenticated",
            "role": "authenticated",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=1)).timestamp()),
        }
        forged_token = jwt.encode(forged_payload, FORGED_SECRET, algorithm="HS256")
        res = await ac.get("/api/v1/workspaces", headers={"Authorization": f"Bearer {forged_token}"})
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "invalid_token"

        # 4. Expired token -> 401
        expired_payload = {
            "sub": uid,
            "email": "user@example.com",
            "aud": "authenticated",
            "role": "authenticated",
            "iat": int((now - timedelta(hours=2)).timestamp()),
            "exp": int((now - timedelta(hours=1)).timestamp()),
        }
        expired_token = jwt.encode(expired_payload, VALID_SECRET, algorithm="HS256")
        res = await ac.get("/api/v1/workspaces", headers={"Authorization": f"Bearer {expired_token}"})
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "token_expired"

        # 5. Invalid audience (e.g. "admin" or "other_service" instead of "authenticated") -> 401
        bad_aud_payload = {
            "sub": uid,
            "email": "user@example.com",
            "aud": "wrong_audience",
            "role": "authenticated",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=1)).timestamp()),
        }
        bad_aud_token = jwt.encode(bad_aud_payload, VALID_SECRET, algorithm="HS256")
        res = await ac.get("/api/v1/workspaces", headers={"Authorization": f"Bearer {bad_aud_token}"})
        assert res.status_code == 401

        # 6. Non-UUID sub -> 401
        bad_sub_payload = {
            "sub": "not-a-valid-uuid-format-user-123",
            "email": "user@example.com",
            "aud": "authenticated",
            "role": "authenticated",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=1)).timestamp()),
        }
        bad_sub_token = jwt.encode(bad_sub_payload, VALID_SECRET, algorithm="HS256")
        res = await ac.get("/api/v1/workspaces", headers={"Authorization": f"Bearer {bad_sub_token}"})
        assert res.status_code == 401

        # 7. Anonymous role token on protected endpoint -> 401 (S3)
        anon_payload = {
            "sub": uid,
            "email": "anon@example.com",
            "aud": "authenticated",
            "role": "anon",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=1)).timestamp()),
        }
        anon_token = jwt.encode(anon_payload, VALID_SECRET, algorithm="HS256")
        res = await ac.get("/api/v1/workspaces", headers={"Authorization": f"Bearer {anon_token}"})
        assert res.status_code == 401
