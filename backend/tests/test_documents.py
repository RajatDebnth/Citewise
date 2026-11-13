import io
import uuid
import zipfile
from datetime import UTC, datetime, timedelta

import fitz
import jwt
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.config import settings
from app.core.db import engine
from app.core.storage import storage_service
from app.main import app

TEST_JWT_SECRET = "super-secret-test-key-must-be-long-enough-32-chars"


def make_jwt(sub: str, email: str = "alice@example.com") -> str:
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
    # Mock storage service async methods to avoid external network calls in unit tests
    async def mock_upload(path, content, mime):
        return {"path": path}

    async def mock_delete(path):
        return True

    async def mock_sign(path, expires_in=300):
        return f"https://mock-storage.supabase.co/sign/{path}?token=mock"

    monkeypatch.setattr(storage_service, "upload_file", mock_upload)
    monkeypatch.setattr(storage_service, "delete_file", mock_delete)
    monkeypatch.setattr(storage_service, "create_signed_url", mock_sign)


def create_sample_pdf(num_pages: int = 1, password: str | None = None) -> bytes:
    doc = fitz.open()
    for i in range(num_pages):
        page = doc.new_page()
        page.insert_text((50, 50), f"Sample content page {i+1}")
    if password:
        content = doc.tobytes(
            encryption=fitz.PDF_ENCRYPT_AES_256,
            owner_pw="owner_pass",
            user_pw=password,
        )
    else:
        content = doc.tobytes()
    doc.close()
    return content


def create_sample_docx(is_zip_bomb: bool = False, missing_xml: bool = False) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        if not missing_xml:
            if is_zip_bomb:
                # 1 MB of zeros compresses to a few hundred bytes (>100:1 ratio)
                zf.writestr("word/document.xml", "0" * (1024 * 1024))
            else:
                zf.writestr("word/document.xml", "<w:document><w:body><w:p/></w:body></w:document>")
        else:
            zf.writestr("other.txt", "nothing")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_document_validation_and_rejection(create_user):
    user_id = str(uuid.uuid4())
    email = f"val_{uuid.uuid4().hex[:8]}@example.com"
    await create_user(user_id, email)
    token = make_jwt(user_id, email)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create workspace
        ws_res = await ac.post("/api/v1/workspaces", json={"name": "Validation WS"}, headers=headers)
        assert ws_res.status_code == 201
        wid = ws_res.json()["id"]

        try:
            # 1. Missing confidentiality_ack -> 400
            res = await ac.post(
                f"/api/v1/workspaces/{wid}/documents",
                headers=headers,
                files={"file": ("test.txt", b"Valid text content", "text/plain")},
                data={"confidentiality_ack": "false"},
            )
            assert res.status_code == 400
            assert res.json()["error"]["code"] == "confidentiality_ack_required"

            # 2. Fake PDF (executable magic bytes MZ) -> 400
            fake_pdf = b"MZ\x90\x00\x03\x00\x00\x00Fake executable content"
            res = await ac.post(
                f"/api/v1/workspaces/{wid}/documents",
                headers=headers,
                files={"file": ("malware.pdf", fake_pdf, "application/pdf")},
                data={"confidentiality_ack": "true"},
            )
            assert res.status_code == 400
            assert res.json()["error"]["code"] == "invalid_document"

            # 3. Encrypted PDF -> 400
            encrypted_pdf = create_sample_pdf(num_pages=1, password="secretpassword")
            res = await ac.post(
                f"/api/v1/workspaces/{wid}/documents",
                headers=headers,
                files={"file": ("locked.pdf", encrypted_pdf, "application/pdf")},
                data={"confidentiality_ack": "true"},
            )
            assert res.status_code == 400
            assert res.json()["error"]["code"] == "encrypted_pdf_rejected"

            # 4. Oversized PDF pages (> 150 pages) -> 400
            large_pages_pdf = create_sample_pdf(num_pages=151)
            res = await ac.post(
                f"/api/v1/workspaces/{wid}/documents",
                headers=headers,
                files={"file": ("too_many_pages.pdf", large_pages_pdf, "application/pdf")},
                data={"confidentiality_ack": "true"},
            )
            assert res.status_code == 400
            assert res.json()["error"]["code"] == "page_limit_exceeded"

            # 5. Invalid file type (.exe) -> 400
            res = await ac.post(
                f"/api/v1/workspaces/{wid}/documents",
                headers=headers,
                files={"file": ("program.exe", b"binary", "application/octet-stream")},
                data={"confidentiality_ack": "true"},
            )
            assert res.status_code == 400
            assert res.json()["error"]["code"] == "invalid_file_type"

            # 6. Malformed DOCX (missing word/document.xml) -> 400
            bad_docx = create_sample_docx(missing_xml=True)
            res = await ac.post(
                f"/api/v1/workspaces/{wid}/documents",
                headers=headers,
                files={"file": ("corrupt.docx", bad_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
                data={"confidentiality_ack": "true"},
            )
            assert res.status_code == 400
            assert res.json()["error"]["code"] == "invalid_document"

            # 7. Zip-bomb DOCX -> 400
            bomb_docx = create_sample_docx(is_zip_bomb=True)
            res = await ac.post(
                f"/api/v1/workspaces/{wid}/documents",
                headers=headers,
                files={"file": ("bomb.docx", bomb_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
                data={"confidentiality_ack": "true"},
            )
            assert res.status_code == 400
            assert res.json()["error"]["code"] == "zip_bomb_detected"

        finally:
            await ac.delete(f"/api/v1/workspaces/{wid}", headers=headers)


@pytest.mark.asyncio
async def test_document_lifecycle_and_deduplication(create_user):
    user_id = str(uuid.uuid4())
    email = f"doc_{uuid.uuid4().hex[:8]}@example.com"
    await create_user(user_id, email)
    token = make_jwt(user_id, email)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create workspace
        ws_res = await ac.post("/api/v1/workspaces", json={"name": "Doc Lifecycle WS"}, headers=headers)
        assert ws_res.status_code == 201
        wid = ws_res.json()["id"]

        try:
            # 1. Upload valid document
            doc_content = b"Engineering Standard Operating Procedure: Version 1.0"
            upload_res = await ac.post(
                f"/api/v1/workspaces/{wid}/documents",
                headers=headers,
                files={"file": ("sop.txt", doc_content, "text/plain")},
                data={"confidentiality_ack": "true"},
            )
            assert upload_res.status_code == 202
            doc_data = upload_res.json()
            did = doc_data["id"]
            assert doc_data["status"] == "pending"

            # 2. List documents
            list_res = await ac.get(f"/api/v1/workspaces/{wid}/documents", headers=headers)
            assert list_res.status_code == 200
            docs = list_res.json()
            assert len(docs) == 1
            assert docs[0]["id"] == did
            assert docs[0]["filename"] == "sop.txt"
            assert docs[0]["status"] == "pending"

            # 3. Get detail
            detail_res = await ac.get(f"/api/v1/workspaces/{wid}/documents/{did}", headers=headers)
            assert detail_res.status_code == 200
            detail = detail_res.json()
            assert detail["id"] == did
            assert detail["storage_path"] == f"{wid}/{did}/original"

            # 4. Download document
            dl_res = await ac.get(f"/api/v1/workspaces/{wid}/documents/{did}/download", headers=headers)
            assert dl_res.status_code == 200
            assert "mock-storage" in dl_res.json()["download_url"]

            # 5. Duplicate upload (same SHA-256 in same workspace) -> 409 Conflict
            dup_res = await ac.post(
                f"/api/v1/workspaces/{wid}/documents",
                headers=headers,
                files={"file": ("sop_copy.txt", doc_content, "text/plain")},
                data={"confidentiality_ack": "true"},
            )
            assert dup_res.status_code == 409
            assert dup_res.json()["error"]["code"] == "duplicate_document"

            # 6. Delete document
            del_res = await ac.delete(f"/api/v1/workspaces/{wid}/documents/{did}", headers=headers)
            assert del_res.status_code == 204

            # 7. Confirm deleted
            after_del = await ac.get(f"/api/v1/workspaces/{wid}/documents/{did}", headers=headers)
            assert after_del.status_code == 404

        finally:
            await ac.delete(f"/api/v1/workspaces/{wid}", headers=headers)


@pytest.mark.asyncio
async def test_document_retry_flow(create_user):
    user_id = str(uuid.uuid4())
    email = f"retry_{uuid.uuid4().hex[:8]}@example.com"
    await create_user(user_id, email)
    token = make_jwt(user_id, email)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ws_res = await ac.post("/api/v1/workspaces", json={"name": "Retry WS"}, headers=headers)
        assert ws_res.status_code == 201
        wid = ws_res.json()["id"]

        try:
            # Upload valid doc
            upload_res = await ac.post(
                f"/api/v1/workspaces/{wid}/documents",
                headers=headers,
                files={"file": ("doc.txt", b"Some content", "text/plain")},
                data={"confidentiality_ack": "true"},
            )
            assert upload_res.status_code == 202
            did = upload_res.json()["id"]

            # Calling retry on 'pending' status should fail -> 400
            bad_retry = await ac.post(f"/api/v1/workspaces/{wid}/documents/{did}/retry", headers=headers)
            assert bad_retry.status_code == 400
            assert bad_retry.json()["error"]["code"] == "invalid_document_state"

            # Set status to 'failed' in DB
            async with engine.begin() as conn:
                await conn.execute(
                    text("UPDATE documents SET status = 'failed', error_message = 'Extraction failed', attempts = 3 WHERE id = :did"),
                    {"did": did},
                )

            # Calling retry now should succeed -> 200, status reset to 'pending'
            good_retry = await ac.post(f"/api/v1/workspaces/{wid}/documents/{did}/retry", headers=headers)
            assert good_retry.status_code == 200
            assert good_retry.json()["status"] == "pending"

        finally:
            await ac.delete(f"/api/v1/workspaces/{wid}", headers=headers)


@pytest.mark.asyncio
async def test_documents_cross_tenant_isolation_returns_404(create_user):
    # User A (Owner of Workspace A)
    user_a_id = str(uuid.uuid4())
    email_a = f"alice_{uuid.uuid4().hex[:8]}@example.com"
    await create_user(user_a_id, email_a)
    token_a = make_jwt(user_a_id, email_a)
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # User B (Attacker / Tenant B)
    user_b_id = str(uuid.uuid4())
    email_b = f"bob_{uuid.uuid4().hex[:8]}@example.com"
    await create_user(user_b_id, email_b)
    token_b = make_jwt(user_b_id, email_b)
    headers_b = {"Authorization": f"Bearer {token_b}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Alice creates workspace & uploads document
        ws_res = await ac.post("/api/v1/workspaces", json={"name": "Alice Private Docs"}, headers=headers_a)
        assert ws_res.status_code == 201
        wid = ws_res.json()["id"]

        try:
            upload_res = await ac.post(
                f"/api/v1/workspaces/{wid}/documents",
                headers=headers_a,
                files={"file": ("secret_roadmap.txt", b"Top secret plan", "text/plain")},
                data={"confidentiality_ack": "true"},
            )
            assert upload_res.status_code == 202
            did = upload_res.json()["id"]

            # Bob attempts to list Alice's documents -> MUST return 404
            bob_list = await ac.get(f"/api/v1/workspaces/{wid}/documents", headers=headers_b)
            assert bob_list.status_code == 404

            # Bob attempts to read Alice's document detail -> MUST return 404
            bob_detail = await ac.get(f"/api/v1/workspaces/{wid}/documents/{did}", headers=headers_b)
            assert bob_detail.status_code == 404

            # Bob attempts to download Alice's document -> MUST return 404
            bob_dl = await ac.get(f"/api/v1/workspaces/{wid}/documents/{did}/download", headers=headers_b)
            assert bob_dl.status_code == 404

            # Bob attempts to retry Alice's document -> MUST return 404
            bob_retry = await ac.post(f"/api/v1/workspaces/{wid}/documents/{did}/retry", headers=headers_b)
            assert bob_retry.status_code == 404

            # Bob attempts to delete Alice's document -> MUST return 404
            bob_del = await ac.delete(f"/api/v1/workspaces/{wid}/documents/{did}", headers=headers_b)
            assert bob_del.status_code == 404

            # Bob attempts to upload into Alice's workspace -> MUST return 404
            bob_upload = await ac.post(
                f"/api/v1/workspaces/{wid}/documents",
                headers=headers_b,
                files={"file": ("injected.txt", b"injected", "text/plain")},
                data={"confidentiality_ack": "true"},
            )
            assert bob_upload.status_code == 404

        finally:
            await ac.delete(f"/api/v1/workspaces/{wid}", headers=headers_a)
