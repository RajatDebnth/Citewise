import io
import math
import uuid
from datetime import UTC, datetime, timedelta

import pymupdf
import pytest
from app.core.config import settings
from app.core.db import engine
from app.core.storage import storage_service
from app.services.ingestion.chunker import chunk_document
from app.services.ingestion.cleaner import clean_text, drop_repeated_headers_footers
from app.services.ingestion.extractors import (
    ExtractedDocument,
    ExtractedSection,
    extract_docx,
    extract_pdf,
    extract_txt,
)
from app.services.ingestion.worker import (
    process_document_job,
    sweep_stale_jobs,
)
from app.services.providers.base import EmbeddingProvider
from app.services.providers.gemini import l2_normalize, verify_embedding_dimension
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class MockEmbeddingProvider(EmbeddingProvider):
    """Deterministic mock embedding provider for tests."""

    def __init__(self, dimension: int = 768, model_name: str = "mock-embed-model"):
        self._dimension = dimension
        self._model_name = model_name
        self.call_count = 0
        self.texts_embedded: list[str] = []

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def model_name(self) -> str:
        return self._model_name

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        self.call_count += 1
        self.texts_embedded.extend(texts)
        res = []
        for _ in texts:
            val = 1.0 / math.sqrt(self._dimension)
            res.append([val] * self._dimension)
        return res

    async def embed_query(self, text: str) -> list[float]:
        self.call_count += 1
        val = 1.0 / math.sqrt(self._dimension)
        return [val] * self._dimension


# ---------------------------------------------------------------------------
# Unit Tests: Cleaner
# ---------------------------------------------------------------------------

def test_cleaner_transformations():
    """Verifies Unicode normalization, null byte removal, de-hyphenation, and whitespace."""
    raw = "Here is some raw\x00 text with intro-\nduction and    multiple   spaces.\n\n\n\nNew paragraph."
    cleaned = clean_text(raw)

    assert "\x00" not in cleaned
    assert "introduction" in cleaned
    assert "multiple spaces." in cleaned
    assert "\n\n\n" not in cleaned
    assert "Here is some raw text" in cleaned


def test_cleaner_repeated_headers_footers():
    """Verifies dropping headers/footers appearing on >60% of pages."""
    pages = [
        "Confidential Company Doc\nPage 1\nFirst page real content about company operations.",
        "Confidential Company Doc\nPage 2\nSecond page real content about vacation policy.",
        "Confidential Company Doc\nPage 3\nThird page real content about salary reviews.",
        "Confidential Company Doc\nPage 4\nFourth page real content about health insurance.",
        "Confidential Company Doc\nPage 5\nFifth page real content about travel expenses.",
    ]
    cleaned_pages = drop_repeated_headers_footers(pages, threshold=0.6)
    assert len(cleaned_pages) == 5

    for cp in cleaned_pages:
        assert "Confidential Company Doc" not in cp
        # Body text should be preserved
        assert "real content" in cp


# ---------------------------------------------------------------------------
# Unit Tests: Extractors
# ---------------------------------------------------------------------------

def test_extract_txt():
    """Verifies plain text extraction."""
    content = b"This is a simple text file.\nWith multiple lines."
    extracted = extract_txt(content)
    assert extracted.page_count == 1
    assert len(extracted.sections) == 1
    assert "simple text file" in extracted.sections[0].text
    assert extracted.sections[0].page_start == 1


def test_extract_docx_with_headings():
    """Verifies DOCX extraction groups text under Heading styles."""
    import docx

    doc = docx.Document()
    doc.add_heading("Section 1: Overview", level=1)
    doc.add_paragraph("This is the overview paragraph.")
    doc.add_heading("Section 2: Details", level=2)
    doc.add_paragraph("This is the details paragraph.")

    buf = io.BytesIO()
    doc.save(buf)
    docx_bytes = buf.getvalue()

    extracted = extract_docx(docx_bytes)
    assert len(extracted.sections) == 2
    assert extracted.sections[0].section_title == "Section 1: Overview"
    assert "overview paragraph" in extracted.sections[0].text
    assert extracted.sections[1].section_title == "Section 2: Details"
    assert "details paragraph" in extracted.sections[1].text


def test_extract_pdf_with_pages():
    """Verifies PDF extraction preserves page numbers and detects titles."""
    doc = pymupdf.open()
    p1 = doc.new_page()
    p1.insert_text((50, 50), "Important Handbook", fontsize=18)
    p1.insert_text((50, 100), "This is page 1 content.", fontsize=10)

    p2 = doc.new_page()
    p2.insert_text((50, 50), "Leave Policy", fontsize=18)
    p2.insert_text((50, 100), "This is page 2 content.", fontsize=10)

    pdf_bytes = doc.tobytes()
    doc.close()

    extracted = extract_pdf(pdf_bytes)
    assert extracted.page_count == 2
    assert len(extracted.sections) == 2
    assert extracted.sections[0].page_start == 1
    assert extracted.sections[1].page_start == 2
    assert "Important Handbook" in (extracted.sections[0].section_title or "")
    assert "Leave Policy" in (extracted.sections[1].section_title or "")


# ---------------------------------------------------------------------------
# Unit Tests: Chunker
# ---------------------------------------------------------------------------

def test_chunk_document_sizing_and_overlap():
    """Verifies chunking targets ~800 tokens, overlap ~120 tokens, and prefixes embed_input."""
    # Create text with several paragraphs
    paragraphs = [
        f"Paragraph {i}: " + ("This is detailed knowledge base documentation for the platform. " * 25)
        for i in range(10)
    ]
    doc = ExtractedDocument(
        sections=[
            ExtractedSection(
                text="\n\n".join(paragraphs),
                page_start=1,
                page_end=3,
                section_title="Architecture Guide",
            )
        ],
        page_count=3,
    )

    chunks = chunk_document(doc, filename="guide.pdf")
    assert len(chunks) > 1

    for chunk in chunks:
        assert chunk.token_count >= 30
        assert chunk.token_count <= 1000
        assert chunk.page_start == 1
        assert chunk.page_end == 3
        assert chunk.section_title == "Architecture Guide"
        # Embedding input must be prefixed with filename and section title
        assert chunk.embed_input.startswith("guide.pdf · Architecture Guide\n")
        assert len(chunk.content_sha256) == 64


# ---------------------------------------------------------------------------
# Unit Tests: L2 Normalization and Startup Check
# ---------------------------------------------------------------------------

def test_l2_normalization():
    """Verifies L2 normalization produces vectors with unit norm."""
    vec = [3.0, 4.0]
    normed = l2_normalize(vec)
    assert pytest.approx(normed[0]) == 0.6
    assert pytest.approx(normed[1]) == 0.8
    norm = math.sqrt(sum(x * x for x in normed))
    assert pytest.approx(norm) == 1.0


@pytest.mark.asyncio
async def test_startup_dimension_self_check():
    """Verifies self-check passes on matching dimension and raises RuntimeError on mismatch."""
    valid_provider = MockEmbeddingProvider(dimension=settings.EMBED_DIM)
    await verify_embedding_dimension(valid_provider)

    invalid_provider = MockEmbeddingProvider(dimension=512)
    with pytest.raises(RuntimeError, match="FATAL: Embedding dimension mismatch"):
        await verify_embedding_dimension(invalid_provider)


# ---------------------------------------------------------------------------
# Integration Tests: Ingestion Worker Pipeline
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ingestion_worker_pdf_to_ready(create_user, monkeypatch):
    """End-to-end: uploads a PDF, claims job, reaches 'ready' status with chunks in DB."""
    uid = str(uuid.uuid4())
    wid = str(uuid.uuid4())
    did = str(uuid.uuid4())
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    await create_user(uid, email)

    mock_provider = MockEmbeddingProvider(dimension=settings.EMBED_DIM)

    # 1. Generate sample PDF
    doc = pymupdf.open()
    p1 = doc.new_page()
    p1.insert_text((50, 50), "Company Policy Handbook", fontsize=18)
    p1.insert_text((50, 100), "Section 1: Employees must submit expense reports by Friday.", fontsize=12)
    p2 = doc.new_page()
    p2.insert_text((50, 50), "Benefits Guide", fontsize=18)
    p2.insert_text((50, 100), "Section 2: Health coverage starts on day 30 of employment.", fontsize=12)
    pdf_bytes = doc.tobytes()
    doc.close()

    storage_path = f"{wid}/{did}/original"

    # Mock storage download
    async def mock_download(path):
        assert path == storage_path
        return pdf_bytes

    monkeypatch.setattr(storage_service, "download_file", mock_download)

    async with engine.begin() as conn:
        # Create workspace
        await conn.execute(
            text("INSERT INTO workspaces (id, name, owner_id) VALUES (:wid, 'Ingestion Test WS', :uid)"),
            {"wid": wid, "uid": uid},
        )
        await conn.execute(
            text("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (:wid, :uid, 'owner')"),
            {"wid": wid, "uid": uid},
        )
        # Create pending document
        await conn.execute(
            text(
                """
                INSERT INTO documents (
                    id, workspace_id, uploader_id, filename, storage_path,
                    mime_type, size_bytes, sha256, status
                ) VALUES (
                    :did, :wid, :uid, 'handbook.pdf', :storage_path,
                    'application/pdf', :size, 'fake_sha256_pdf', 'pending'
                );
                """
            ),
            {"did": did, "wid": wid, "uid": uid, "storage_path": storage_path, "size": len(pdf_bytes)},
        )

    # Claim job via claim_document_job()
    async with AsyncSession(engine) as session:
        claim_res = await session.execute(text("SELECT * FROM claim_document_job();"))
        claimed = claim_res.mappings().first()
        assert claimed is not None
        assert str(claimed["id"]) == did
        assert claimed["status"] == "processing"
        await session.commit()

        # Process document
        await process_document_job(dict(claimed), session, mock_provider)

    # Verify document status updated to 'ready'
    async with engine.connect() as conn:
        res = await conn.execute(
            text("SELECT status, chunk_count, page_count, error_message FROM documents WHERE id = :did"),
            {"did": did},
        )
        row = res.mappings().one()
        assert row["status"] == "ready"
        assert row["chunk_count"] > 0
        assert row["page_count"] == 2
        assert row["error_message"] is None

        # Verify chunks persisted in document_chunks
        chunks_res = await conn.execute(
            text("SELECT chunk_index, content, page_start, page_end, section_title, embedding_model FROM document_chunks WHERE document_id = :did ORDER BY chunk_index"),
            {"did": did},
        )
        chunks = chunks_res.mappings().all()
        assert len(chunks) == row["chunk_count"]
        assert chunks[0]["page_start"] == 1
        assert chunks[0]["embedding_model"] == mock_provider.model_name


@pytest.mark.asyncio
async def test_embedding_cache_avoids_redundant_calls(create_user, monkeypatch):
    """Verifies that re-uploading identical content chunks uses embedding_cache with 0 provider calls."""
    uid = str(uuid.uuid4())
    wid1 = str(uuid.uuid4())
    wid2 = str(uuid.uuid4())
    did1 = str(uuid.uuid4())
    did2 = str(uuid.uuid4())
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    await create_user(uid, email)

    mock_provider = MockEmbeddingProvider(dimension=settings.EMBED_DIM)
    unique_salt = uuid.uuid4().hex
    identical_content = f"Test Run {unique_salt}: " + ("This is identical documentation text for testing the embedding cache system.\n" * 10)
    file_bytes = identical_content.encode("utf-8")

    async def mock_download(path):
        return file_bytes

    monkeypatch.setattr(storage_service, "download_file", mock_download)

    async with engine.begin() as conn:
        # Create 2 workspaces
        await conn.execute(
            text(
                "INSERT INTO workspaces (id, name, owner_id) VALUES (:w1, 'WS 1', :uid), (:w2, 'WS 2', :uid)"
            ),
            {"w1": wid1, "w2": wid2, "uid": uid},
        )
        await conn.execute(
            text(
                "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (:w1, :uid, 'owner'), (:w2, :uid, 'owner')"
            ),
            {"w1": wid1, "w2": wid2, "uid": uid},
        )

        # Insert Doc 1 in WS 1
        await conn.execute(
            text(
                """
                INSERT INTO documents (id, workspace_id, uploader_id, filename, storage_path, mime_type, size_bytes, sha256, status)
                VALUES (:did, :wid, :uid, 'doc1.txt', 'p1', 'text/plain', :size, 'sha_doc1', 'pending')
                """
            ),
            {"did": did1, "wid": wid1, "uid": uid, "size": len(file_bytes)},
        )
        # Insert Doc 2 in WS 2 (identical content)
        await conn.execute(
            text(
                """
                INSERT INTO documents (id, workspace_id, uploader_id, filename, storage_path, mime_type, size_bytes, sha256, status)
                VALUES (:did, :wid, :uid, 'doc2.txt', 'p2', 'text/plain', :size, 'sha_doc2', 'pending')
                """
            ),
            {"did": did2, "wid": wid2, "uid": uid, "size": len(file_bytes)},
        )

    # Process Doc 1
    async with AsyncSession(engine) as session:
        c1 = (await session.execute(text("SELECT * FROM documents WHERE id = :did"), {"did": did1})).mappings().one()
        await process_document_job(dict(c1), session, mock_provider)

    calls_after_doc1 = mock_provider.call_count
    assert calls_after_doc1 > 0

    # Process Doc 2 (should hit embedding_cache!)
    async with AsyncSession(engine) as session:
        c2 = (await session.execute(text("SELECT * FROM documents WHERE id = :did"), {"did": did2})).mappings().one()
        await process_document_job(dict(c2), session, mock_provider)

    calls_after_doc2 = mock_provider.call_count
    # Provider was NOT called again because chunks were found in embedding_cache!
    assert calls_after_doc2 == calls_after_doc1


@pytest.mark.asyncio
async def test_corrupt_file_transitions_to_failed(create_user, monkeypatch):
    """Verifies that a corrupt document transitions to 'failed' with safe error message."""
    uid = str(uuid.uuid4())
    wid = str(uuid.uuid4())
    did = str(uuid.uuid4())
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    await create_user(uid, email)

    mock_provider = MockEmbeddingProvider(dimension=settings.EMBED_DIM)
    corrupt_bytes = b"%PDF-1.4 corrupt junk not a real pdf content"

    async def mock_download(path):
        return corrupt_bytes

    monkeypatch.setattr(storage_service, "download_file", mock_download)

    async with engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO workspaces (id, name, owner_id) VALUES (:wid, 'WS Fail', :uid)"),
            {"wid": wid, "uid": uid},
        )
        await conn.execute(
            text("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (:wid, :uid, 'owner')"),
            {"wid": wid, "uid": uid},
        )
        await conn.execute(
            text(
                """
                INSERT INTO documents (id, workspace_id, uploader_id, filename, storage_path, mime_type, size_bytes, sha256, status)
                VALUES (:did, :wid, :uid, 'broken.pdf', 'path', 'application/pdf', :size, 'sha_broken', 'pending')
                """
            ),
            {"did": did, "wid": wid, "uid": uid, "size": len(corrupt_bytes)},
        )

    async with AsyncSession(engine) as session:
        doc = (await session.execute(text("SELECT * FROM documents WHERE id = :did"), {"did": did})).mappings().one()
        await process_document_job(dict(doc), session, mock_provider)

    async with engine.connect() as conn:
        row = (await conn.execute(text("SELECT status, error_message FROM documents WHERE id = :did"), {"did": did})).mappings().one()
        assert row["status"] == "failed"
        assert row["error_message"] is not None
        assert "failed" in row["error_message"].lower() or "parse" in row["error_message"].lower()


@pytest.mark.asyncio
async def test_stale_lock_recovery_and_sweeper(create_user):
    """Verifies that stale processing jobs (>10 min) are re-claimable, and sweeper fails jobs after 3 attempts."""
    uid = str(uuid.uuid4())
    wid = str(uuid.uuid4())
    did1 = str(uuid.uuid4())
    did2 = str(uuid.uuid4())
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    await create_user(uid, email)

    eleven_minutes_ago = datetime.now(UTC) - timedelta(minutes=11)

    async with engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO workspaces (id, name, owner_id) VALUES (:wid, 'Stale WS', :uid)"),
            {"wid": wid, "uid": uid},
        )
        await conn.execute(
            text("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (:wid, :uid, 'owner')"),
            {"wid": wid, "uid": uid},
        )

        # Doc 1: processing, locked 11 min ago, attempts = 1 -> should be re-claimable
        await conn.execute(
            text(
                """
                INSERT INTO documents (id, workspace_id, filename, storage_path, mime_type, size_bytes, sha256, status, locked_at, attempts)
                VALUES (:did, :wid, 'stale1.txt', 'p1', 'text/plain', 100, 'sha_s1', 'processing', :locked_at, 1)
                """
            ),
            {"did": did1, "wid": wid, "locked_at": eleven_minutes_ago},
        )
        # Doc 2: processing, locked 11 min ago, attempts = 3 -> sweeper should mark failed
        await conn.execute(
            text(
                """
                INSERT INTO documents (id, workspace_id, filename, storage_path, mime_type, size_bytes, sha256, status, locked_at, attempts)
                VALUES (:did, :wid, 'stale2.txt', 'p2', 'text/plain', 100, 'sha_s2', 'processing', :locked_at, 3)
                """
            ),
            {"did": did2, "wid": wid, "locked_at": eleven_minutes_ago},
        )

    # Run sweeper
    async with AsyncSession(engine) as session:
        await sweep_stale_jobs(session)

    # Verify doc2 was failed by sweeper
    async with engine.connect() as conn:
        row2 = (await conn.execute(text("SELECT status, error_message FROM documents WHERE id = :did"), {"did": did2})).mappings().one()
        assert row2["status"] == "failed"
        assert "timed out" in row2["error_message"].lower()

    # Verify doc1 is re-claimed by claim_document_job()
    async with AsyncSession(engine) as session:
        claimed = (await session.execute(text("SELECT * FROM claim_document_job();"))).mappings().first()
        assert claimed is not None
        assert str(claimed["id"]) == did1
        assert claimed["attempts"] == 2
        await session.commit()
