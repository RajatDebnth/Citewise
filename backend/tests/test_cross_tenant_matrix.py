import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from app.core.config import settings
from app.core.db import engine
from app.main import app
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

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


@pytest.mark.asyncio
async def test_full_cross_tenant_matrix_zero_leakage(create_user):
    """Rigorous verification of cross-tenant matrix across EVERY endpoint.
    
    User B must NEVER be able to read, mutate, delete, or retrieve User A's data,
    and must receive 404 (zero existence leakage per S4, S5, S7, S8).
    """
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())
    ws_a = str(uuid.uuid4())
    ws_b = str(uuid.uuid4())
    doc_a = str(uuid.uuid4())
    conv_a = str(uuid.uuid4())
    msg_a = str(uuid.uuid4())
    unans_a = str(uuid.uuid4())

    email_a = f"tenant_a_{uuid.uuid4().hex[:8]}@example.com"
    email_b = f"tenant_b_{uuid.uuid4().hex[:8]}@example.com"
    await create_user(user_a, email_a)
    await create_user(user_b, email_b)

    token_b = make_jwt(user_b, email_b)
    headers_b = {"Authorization": f"Bearer {token_b}"}

    async with engine.begin() as conn:
        # 1. Setup Workspace A owned by User A
        await conn.execute(text("INSERT INTO workspaces (id, name, owner_id) VALUES (:w, 'WS A', :u)"), {"w": ws_a, "u": user_a})
        await conn.execute(text("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (:w, :u, 'owner')"), {"w": ws_a, "u": user_a})

        # 2. Setup Workspace B owned by User B
        await conn.execute(text("INSERT INTO workspaces (id, name, owner_id) VALUES (:w, 'WS B', :u)"), {"w": ws_b, "u": user_b})
        await conn.execute(text("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (:w, :u, 'owner')"), {"w": ws_b, "u": user_b})

        # 3. Document in Workspace A
        await conn.execute(
            text(
                """
                INSERT INTO documents (id, workspace_id, uploader_id, filename, storage_path, mime_type, size_bytes, sha256, status)
                VALUES (:d, :w, :u, 'doc_a.txt', 'p_a', 'text/plain', 100, :sha, 'ready')
                """
            ),
            {"d": doc_a, "w": ws_a, "u": user_a, "sha": uuid.uuid4().hex},
        )

        # 4. Conversation and message in Workspace A
        await conn.execute(
            text("INSERT INTO conversations (id, workspace_id, user_id, title) VALUES (:c, :w, :u, 'Secret Conv')"),
            {"c": conv_a, "w": ws_a, "u": user_a},
        )
        await conn.execute(
            text(
                """
                INSERT INTO messages (id, conversation_id, workspace_id, role, content)
                VALUES (:m, :c, :w, 'assistant', 'Top secret answer')
                """
            ),
            {"m": msg_a, "c": conv_a, "w": ws_a},
        )

        # 5. Unanswered question in Workspace A
        await conn.execute(
            text(
                """
                INSERT INTO unanswered_questions (id, workspace_id, question, status)
                VALUES (:u_id, :w, 'Confidential A Question', 'open')
                """
            ),
            {"u_id": unans_a, "w": ws_a},
        )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Workspace endpoints on Workspace A
        assert (await ac.get(f"/api/v1/workspaces/{ws_a}", headers=headers_b)).status_code == 404
        assert (await ac.patch(f"/api/v1/workspaces/{ws_a}", headers=headers_b, json={"name": "Hacked"})).status_code == 404
        assert (await ac.delete(f"/api/v1/workspaces/{ws_a}", headers=headers_b)).status_code == 404
        assert (await ac.get(f"/api/v1/workspaces/{ws_a}/members", headers=headers_b)).status_code == 404

        # Document endpoints on Workspace A
        assert (await ac.get(f"/api/v1/workspaces/{ws_a}/documents", headers=headers_b)).status_code == 404
        assert (await ac.get(f"/api/v1/workspaces/{ws_a}/documents/{doc_a}", headers=headers_b)).status_code == 404
        assert (await ac.post(f"/api/v1/workspaces/{ws_a}/documents/{doc_a}/retry", headers=headers_b)).status_code == 404
        assert (await ac.get(f"/api/v1/workspaces/{ws_a}/documents/{doc_a}/download", headers=headers_b)).status_code == 404
        assert (await ac.delete(f"/api/v1/workspaces/{ws_a}/documents/{doc_a}", headers=headers_b)).status_code == 404
        assert (
            await ac.post(
                f"/api/v1/workspaces/{ws_a}/documents",
                headers=headers_b,
                files={"file": ("hack.txt", b"hack", "text/plain")},
                data={"confidentiality_ack": "true"},
            )
        ).status_code == 404

        # Chat and Conversation endpoints on Workspace A
        assert (await ac.post(f"/api/v1/workspaces/{ws_a}/chat", headers=headers_b, json={"question": "Merger?"})).status_code == 404
        assert (await ac.get(f"/api/v1/workspaces/{ws_a}/conversations", headers=headers_b)).status_code == 404
        assert (await ac.get(f"/api/v1/workspaces/{ws_a}/conversations/{conv_a}", headers=headers_b)).status_code == 404
        assert (await ac.patch(f"/api/v1/workspaces/{ws_a}/conversations/{conv_a}", headers=headers_b, json={"title": "Hacked"})).status_code == 404
        assert (await ac.delete(f"/api/v1/workspaces/{ws_a}/conversations/{conv_a}", headers=headers_b)).status_code == 404

        # Feedback endpoint on Message in Workspace A
        assert (await ac.post(f"/api/v1/messages/{msg_a}/feedback", headers=headers_b, json={"rating": 1})).status_code == 404

        # Unanswered questions on Workspace A
        assert (await ac.get(f"/api/v1/workspaces/{ws_a}/unanswered", headers=headers_b)).status_code == 404
        assert (await ac.patch(f"/api/v1/workspaces/{ws_a}/unanswered/{unans_a}", headers=headers_b, json={"status": "resolved"})).status_code == 404
