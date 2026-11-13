import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from app.core.config import settings
from app.core.storage import storage_service
from app.main import app
from app.services.ingestion.validators import sanitize_filename
from httpx import ASGITransport, AsyncClient

TEST_JWT_SECRET = "super-secret-test-key-must-be-long-enough-32-chars"


def make_jwt(sub: str, email: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": sub,
        "email": email,
        "aud": "authenticated",
        "role": "authenticated",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=1)).timestamp()),
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")


@pytest.fixture(autouse=True)
def setup_test_jwt(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_JWT_SECRET)

    async def mock_upload(path, content, mime):
        return {"path": path}

    monkeypatch.setattr(storage_service, "upload_file", mock_upload)


def test_filename_sanitization_prevents_traversal():
    """Verifies that path traversal characters, null bytes, and control characters are stripped (S13)."""
    assert sanitize_filename("../../../../etc/passwd.pdf") == "passwd.pdf"
    assert sanitize_filename("..\\..\\windows\\system32\\cmd.exe.docx") == "cmd.exe.docx"
    assert sanitize_filename("safe_file\x00_name.txt") == "safe_file_name.txt"
    # Max length 200 chars
    long_name = ("a" * 300) + ".pdf"
    sanitized = sanitize_filename(long_name)
    assert len(sanitized) <= 200
    assert sanitized.endswith(".pdf")


@pytest.mark.asyncio
async def test_security_headers_present_on_all_responses():
    """Verifies that security headers (S25) are attached to responses."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/health")
        assert res.status_code == 200
        assert res.headers.get("X-Content-Type-Options") == "nosniff"
        assert res.headers.get("X-Frame-Options") == "DENY"
        assert res.headers.get("Referrer-Policy") == "no-referrer"
        assert "geolocation=()" in res.headers.get("Permissions-Policy", "")


@pytest.mark.asyncio
async def test_oversized_body_rejected_with_413(create_user):
    """Verifies that requests claiming Content-Length > 11 MB are rejected with 413 (S26)."""
    uid = str(uuid.uuid4())
    wid = str(uuid.uuid4())
    email = f"body_{uuid.uuid4().hex[:8]}@example.com"
    await create_user(uid, email)
    token = make_jwt(uid, email)

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Length": str(12 * 1024 * 1024),  # 12 MB
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            f"/api/v1/workspaces/{wid}/documents",
            headers=headers,
            content=b"test",
        )
        assert res.status_code == 413
        assert res.json()["error"]["code"] == "payload_too_large"
