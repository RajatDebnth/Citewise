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


def make_jwt(
    sub: str | None = None,
    email: str = "alice@example.com",
    expires_in_seconds: int = 3600,
    secret: str = TEST_JWT_SECRET,
    aud: str = "authenticated",
) -> str:
    user_id = sub or str(uuid.uuid4())
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "email": email,
        "aud": aud,
        "role": "authenticated",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in_seconds)).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture(autouse=True)
def setup_test_jwt_secret(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_JWT_SECRET)


@pytest.mark.asyncio
async def test_auth_token_validation():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        # 1. Anonymous (missing header)
        res = await ac.get("/api/v1/me")
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "unauthorized"

        # 2. Malformed token
        res = await ac.get(
            "/api/v1/me", headers={"Authorization": "Basic 12345"}
        )
        assert res.status_code == 401

        # 3. Forged token (wrong secret)
        forged_token = make_jwt(secret="wrong-secret-signature-key-12345678")
        res = await ac.get(
            "/api/v1/me", headers={"Authorization": f"Bearer {forged_token}"}
        )
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "invalid_token"

        # 4. Expired token
        expired_token = make_jwt(expires_in_seconds=-60)
        res = await ac.get(
            "/api/v1/me", headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert res.status_code == 401

        # 5. Invalid UUID in sub
        invalid_sub_token = jwt.encode(
            {
                "sub": "not-a-valid-uuid",
                "exp": int((datetime.now(UTC) + timedelta(hours=1)).timestamp()),
                "aud": "authenticated",
            },
            TEST_JWT_SECRET,
            algorithm="HS256",
        )
        res = await ac.get(
            "/api/v1/me",
            headers={"Authorization": f"Bearer {invalid_sub_token}"},
        )
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_me_endpoint_profile_and_quotas(create_user):
    uid = str(uuid.uuid4())
    email = f"me_{uuid.uuid4().hex[:8]}@example.com"
    await create_user(uid, email)
    token = make_jwt(sub=uid, email=email)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        res = await ac.get(
            "/api/v1/me", headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["profile"]["id"] == uid
        assert data["profile"]["email"] == email
        assert "questions" in data["quotas"]
        assert "uploads" in data["quotas"]
        assert "workspaces" in data["quotas"]


@pytest.mark.asyncio
async def test_workspace_crud_lifecycle(create_user):
    user_a_id = str(uuid.uuid4())
    email_a = f"usera_{uuid.uuid4().hex[:8]}@example.com"
    await create_user(user_a_id, email_a)
    token_a = make_jwt(sub=user_a_id, email=email_a)
    headers_a = {"Authorization": f"Bearer {token_a}"}

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        # 1. Create Workspace
        create_res = await ac.post(
            "/api/v1/workspaces",
            json={"name": "Engineering Knowledge"},
            headers=headers_a,
        )
        assert create_res.status_code == 201
        ws = create_res.json()
        wid = ws["id"]
        assert ws["name"] == "Engineering Knowledge"
        assert ws["role"] == "owner"

        # 2. List Workspaces
        list_res = await ac.get("/api/v1/workspaces", headers=headers_a)
        assert list_res.status_code == 200
        ws_ids = [w["id"] for w in list_res.json()]
        assert wid in ws_ids

        # 3. Get Workspace Detail
        detail_res = await ac.get(f"/api/v1/workspaces/{wid}", headers=headers_a)
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert detail["id"] == wid
        assert detail["name"] == "Engineering Knowledge"
        assert detail["role"] == "owner"
        assert detail["stats"]["member_count"] == 1

        # 4. Patch Workspace (Rename)
        patch_res = await ac.patch(
            f"/api/v1/workspaces/{wid}",
            json={"name": "Engineering Knowledge Base"},
            headers=headers_a,
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["name"] == "Engineering Knowledge Base"

        # 5. List Members
        members_res = await ac.get(
            f"/api/v1/workspaces/{wid}/members", headers=headers_a
        )
        assert members_res.status_code == 200
        members = members_res.json()
        assert len(members) == 1
        assert members[0]["user_id"] == user_a_id
        assert members[0]["role"] == "owner"

        # 6. Delete Workspace
        del_res = await ac.delete(f"/api/v1/workspaces/{wid}", headers=headers_a)
        assert del_res.status_code == 204

        # 7. Confirm Deleted
        after_del = await ac.get(f"/api/v1/workspaces/{wid}", headers=headers_a)
        assert after_del.status_code == 404


@pytest.mark.asyncio
async def test_cross_tenant_isolation_returns_404(create_user):
    """Acceptance criterion: A second user can't see or delete the first user's workspace (returns 404)."""
    user_a_id = str(uuid.uuid4())
    email_a = f"alice_{uuid.uuid4().hex[:8]}@corp.com"
    await create_user(user_a_id, email_a)
    token_a = make_jwt(sub=user_a_id, email=email_a)
    headers_a = {"Authorization": f"Bearer {token_a}"}

    user_b_id = str(uuid.uuid4())
    email_b = f"bob_{uuid.uuid4().hex[:8]}@other.com"
    await create_user(user_b_id, email_b)
    token_b = make_jwt(sub=user_b_id, email=email_b)
    headers_b = {"Authorization": f"Bearer {token_b}"}

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        # Alice creates a workspace
        create_res = await ac.post(
            "/api/v1/workspaces",
            json={"name": "Alice Confidential Space"},
            headers=headers_a,
        )
        assert create_res.status_code == 201
        wid = create_res.json()["id"]

        # Bob attempts to GET Alice's workspace -> MUST return 404 Not Found
        bob_get = await ac.get(f"/api/v1/workspaces/{wid}", headers=headers_b)
        assert bob_get.status_code == 404
        assert bob_get.json()["error"]["code"] == "not_found"

        # Bob attempts to PATCH Alice's workspace -> MUST return 404 Not Found
        bob_patch = await ac.patch(
            f"/api/v1/workspaces/{wid}",
            json={"name": "Hacked Name"},
            headers=headers_b,
        )
        assert bob_patch.status_code == 404

        # Bob attempts to DELETE Alice's workspace -> MUST return 404 Not Found
        bob_delete = await ac.delete(
            f"/api/v1/workspaces/{wid}", headers=headers_b
        )
        assert bob_delete.status_code == 404

        # Bob attempts to list members -> MUST return 404 Not Found
        bob_members = await ac.get(
            f"/api/v1/workspaces/{wid}/members", headers=headers_b
        )
        assert bob_members.status_code == 404

        # Bob listing his workspaces does NOT include Alice's workspace
        bob_list = await ac.get("/api/v1/workspaces", headers=headers_b)
        assert bob_list.status_code == 200
        assert wid not in [w["id"] for w in bob_list.json()]

        # Clean up
        await ac.delete(f"/api/v1/workspaces/{wid}", headers=headers_a)


@pytest.mark.asyncio
async def test_member_vs_owner_role_permissions(create_user):
    """Member can read workspace, but cannot rename or delete it (403)."""
    owner_id = str(uuid.uuid4())
    member_id = str(uuid.uuid4())
    owner_email = f"owner_{uuid.uuid4().hex[:8]}@test.com"
    member_email = f"member_{uuid.uuid4().hex[:8]}@test.com"
    await create_user(owner_id, owner_email)
    await create_user(member_id, member_email)

    token_owner = make_jwt(sub=owner_id, email=owner_email)
    headers_owner = {"Authorization": f"Bearer {token_owner}"}

    token_member = make_jwt(sub=member_id, email=member_email)
    headers_member = {"Authorization": f"Bearer {token_member}"}

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        # Owner creates workspace
        create_res = await ac.post(
            "/api/v1/workspaces",
            json={"name": "Team Workspace"},
            headers=headers_owner,
        )
        assert create_res.status_code == 201
        wid = create_res.json()["id"]

        # Add member to workspace_members directly in DB
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (:wid, :uid, 'member');"
                ),
                {"wid": wid, "uid": member_id},
            )

        # Member reads workspace -> 200 OK
        read_res = await ac.get(
            f"/api/v1/workspaces/{wid}", headers=headers_member
        )
        assert read_res.status_code == 200
        assert read_res.json()["role"] == "member"

        # Member tries to rename workspace -> 403 Forbidden (requires owner)
        patch_res = await ac.patch(
            f"/api/v1/workspaces/{wid}",
            json={"name": "Renamed By Member"},
            headers=headers_member,
        )
        assert patch_res.status_code == 403
        assert patch_res.json()["error"]["code"] == "forbidden"

        # Member tries to delete workspace -> 403 Forbidden (requires owner)
        del_res = await ac.delete(
            f"/api/v1/workspaces/{wid}", headers=headers_member
        )
        assert del_res.status_code == 403
        assert del_res.json()["error"]["code"] == "forbidden"

        # Owner deletes successfully
        clean_res = await ac.delete(
            f"/api/v1/workspaces/{wid}", headers=headers_owner
        )
        assert clean_res.status_code == 204


@pytest.mark.asyncio
async def test_max_workspaces_per_user_limit(monkeypatch, create_user):
    monkeypatch.setattr(settings, "MAX_WORKSPACES_PER_USER", 2)
    user_id = str(uuid.uuid4())
    email = f"limit_{uuid.uuid4().hex[:8]}@test.com"
    await create_user(user_id, email)
    token = make_jwt(sub=user_id, email=email)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        created_wids = []
        try:
            # Workspace 1 -> OK
            r1 = await ac.post(
                "/api/v1/workspaces", json={"name": "WS 1"}, headers=headers
            )
            assert r1.status_code == 201
            created_wids.append(r1.json()["id"])

            # Workspace 2 -> OK
            r2 = await ac.post(
                "/api/v1/workspaces", json={"name": "WS 2"}, headers=headers
            )
            assert r2.status_code == 201
            created_wids.append(r2.json()["id"])

            # Workspace 3 -> Fails (limit is 2)
            r3 = await ac.post(
                "/api/v1/workspaces", json={"name": "WS 3"}, headers=headers
            )
            assert r3.status_code == 400
            assert r3.json()["error"]["code"] == "workspace_limit_exceeded"
        finally:
            for wid in created_wids:
                await ac.delete(f"/api/v1/workspaces/{wid}", headers=headers)
