import asyncio
import os
import tempfile
import traceback
from typing import Any

from app.core.config import settings
from app.core.db import AsyncSessionLocal
from app.core.errors import AppException
from app.core.logging import get_logger
from app.core.storage import storage_service
from app.services.ingestion.chunker import chunk_document
from app.services.ingestion.extractors import extract_document
from app.services.providers.base import EmbeddingProvider
from app.services.providers.gemini import GeminiEmbeddingProvider
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = get_logger("app.ingestion.worker")


async def sweep_stale_jobs(db: AsyncSession) -> None:
    """Marks processing jobs that exceeded 3 attempts and 10 minutes as failed."""
    query = text(
        """
        UPDATE documents
        SET status = 'failed',
            error_message = 'Document processing timed out after maximum retry attempts.',
            locked_at = NULL
        WHERE status = 'processing'
          AND locked_at < now() - interval '10 minutes'
          AND attempts >= 3;
        """
    )
    await db.execute(query)
    await db.commit()


async def process_document_job(
    doc: dict[str, Any],
    db: AsyncSession,
    embedding_provider: EmbeddingProvider,
) -> None:
    """Processes a single claimed document: download, validate, extract, clean, chunk, embed, persist."""
    doc_id = doc["id"]
    workspace_id = doc["workspace_id"]
    storage_path = doc["storage_path"]
    filename = doc["filename"]
    mime_type = doc["mime_type"]
    size_bytes = doc["size_bytes"]

    logger.info(
        f"Processing document {doc_id} ('{filename}') for workspace {workspace_id}"
    )

    temp_file_path: str | None = None
    try:
        # 1. Download file from storage to temporary location
        file_bytes = await storage_service.download_file(storage_path)

        # Write to temporary file in /tmp (or OS temp dir)
        with tempfile.NamedTemporaryFile(delete=False, prefix="doc_", suffix=os.path.splitext(filename)[1]) as tmp:
            tmp.write(file_bytes)
            temp_file_path = tmp.name

        # 2. Validate again
        max_bytes = settings.MAX_FILE_MB * 1024 * 1024
        if len(file_bytes) > max_bytes or size_bytes > max_bytes:
            raise AppException(
                status_code=400,
                code="file_too_large",
                message=f"File exceeds maximum allowed size ({settings.MAX_FILE_MB}MB)",
            )

        # 3. Extract text (PDF, DOCX, TXT)
        extracted = extract_document(file_bytes, mime_type, filename)

        if extracted.page_count > settings.MAX_PAGES:
            raise AppException(
                status_code=400,
                code="page_limit_exceeded",
                message=f"Document exceeds maximum page limit ({settings.MAX_PAGES} pages)",
            )

        # 4. Chunk document
        chunks = chunk_document(extracted, filename)
        if not chunks:
            raise AppException(
                status_code=400,
                code="empty_document",
                message="No extractable text found in document",
            )

        logger.info(
            f"Extracted {len(chunks)} chunks across {extracted.page_count} pages for document {doc_id}"
        )

        # 5. Check embedding cache
        model_name = embedding_provider.model_name
        chunk_hashes = [c.content_sha256 for c in chunks]

        cache_query = text(
            """
            SELECT content_sha256, embedding::text
            FROM embedding_cache
            WHERE model = :model AND content_sha256 = ANY(:hashes);
            """
        )
        cache_res = await db.execute(
            cache_query, {"model": model_name, "hashes": chunk_hashes}
        )
        cached_rows = cache_res.fetchall()

        cached_embeddings: dict[str, list[float]] = {}
        for row in cached_rows:
            sha = row[0]
            raw_vec = row[1]
            if raw_vec:
                vec = [float(x) for x in raw_vec.strip("[]").split(",") if x.strip()]
                cached_embeddings[sha] = vec

        # Identify chunks needing fresh embeddings
        uncached_chunks = [c for c in chunks if c.content_sha256 not in cached_embeddings]

        if uncached_chunks:
            logger.info(
                f"Generating embeddings for {len(uncached_chunks)} uncached chunks ({len(cached_embeddings)} hit cache)"
            )
            texts_to_embed = [c.embed_input for c in uncached_chunks]
            new_embeddings = await embedding_provider.embed_documents(texts_to_embed)

            # Record usage event
            await db.execute(
                text(
                    """
                    INSERT INTO usage_events (workspace_id, kind, units)
                    VALUES (:wid, 'embed_call', :units);
                    """
                ),
                {"wid": workspace_id, "units": len(uncached_chunks)},
            )

            # Cache the newly generated embeddings
            for chunk, vec in zip(uncached_chunks, new_embeddings, strict=False):
                cached_embeddings[chunk.content_sha256] = vec
                vec_str = f"[{','.join(str(x) for x in vec)}]"
                await db.execute(
                    text(
                        """
                        INSERT INTO embedding_cache (content_sha256, model, embedding)
                        VALUES (:sha, :model, CAST(:vec AS vector))
                        ON CONFLICT (content_sha256, model) DO NOTHING;
                        """
                    ),
                    {"sha": chunk.content_sha256, "model": model_name, "vec": vec_str},
                )
        else:
            logger.info(
                f"All {len(chunks)} chunks resolved from embedding cache! Zero Gemini calls required."
            )

        # 6. In ONE database transaction: delete old chunks, insert new chunks, update document status to ready
        await db.execute(
            text(
                "DELETE FROM document_chunks WHERE workspace_id = :wid AND document_id = :did;"
            ),
            {"wid": workspace_id, "did": doc_id},
        )

        for chunk in chunks:
            vec = cached_embeddings[chunk.content_sha256]
            vec_str = f"[{','.join(str(x) for x in vec)}]"
            await db.execute(
                text(
                    """
                    INSERT INTO document_chunks (
                        workspace_id, document_id, chunk_index, content,
                        content_sha256, token_count, page_start, page_end,
                        section_title, embedding, embedding_model
                    ) VALUES (
                        :wid, :did, :idx, :content,
                        :sha, :toks, :p_start, :p_end,
                        :sec_title, CAST(:vec AS vector), :model
                    );
                    """
                ),
                {
                    "wid": workspace_id,
                    "did": doc_id,
                    "idx": chunk.chunk_index,
                    "content": chunk.content,
                    "sha": chunk.content_sha256,
                    "toks": chunk.token_count,
                    "p_start": chunk.page_start,
                    "p_end": chunk.page_end,
                    "sec_title": chunk.section_title,
                    "vec": vec_str,
                    "model": model_name,
                },
            )

        await db.execute(
            text(
                """
                UPDATE documents
                SET status = 'ready',
                    chunk_count = :chunk_count,
                    page_count = :page_count,
                    processed_at = now(),
                    error_message = NULL,
                    locked_at = NULL
                WHERE workspace_id = :wid AND id = :did;
                """
            ),
            {
                "wid": workspace_id,
                "did": doc_id,
                "chunk_count": len(chunks),
                "page_count": extracted.page_count,
            },
        )

        await db.commit()
        logger.info(
            f"Successfully ingested document {doc_id} ('{filename}') -> ready with {len(chunks)} chunks"
        )

    except Exception as e:  # noqa: BLE001
        logger.error(
            f"Failed ingesting document {doc_id} ('{filename}'): {e}\n{traceback.format_exc()}"
        )
        await db.rollback()

        # Update document to failed with safe message
        safe_msg = (
            e.message
            if isinstance(e, AppException)
            else "Document processing failed. Please check file formatting and try again."
        )

        try:
            await db.execute(
                text(
                    """
                    UPDATE documents
                    SET status = 'failed',
                        error_message = :err,
                        locked_at = NULL
                    WHERE id = :did;
                    """
                ),
                {"did": doc_id, "err": safe_msg},
            )
            await db.commit()
        except Exception as update_err:  # noqa: BLE001
            logger.error(f"Failed to update document status to failed: {update_err}")
            await db.rollback()

    finally:
        # Delete /tmp file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except OSError as rm_err:
                logger.warning(f"Could not remove temp file {temp_file_path}: {rm_err}")


class IngestionWorker:
    """Async background worker running in FastAPI lifespan that claims and processes document jobs."""

    def __init__(self, provider: EmbeddingProvider | None = None):
        self._provider = provider or GeminiEmbeddingProvider()
        self._stop_event = asyncio.Event()
        self._task: asyncio.Task[None] | None = None

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._stop_event.clear()
            self._task = asyncio.create_task(self._run_loop())
            logger.info("IngestionWorker background task started")

    async def stop(self) -> None:
        if self._task and not self._task.done():
            logger.info("Stopping IngestionWorker...")
            self._stop_event.set()
            try:
                await asyncio.wait_for(self._task, timeout=5.0)
            except (TimeoutError, asyncio.CancelledError):
                self._task.cancel()
            logger.info("IngestionWorker stopped")

    async def _run_loop(self) -> None:
        """Main loop: claims job via claim_document_job(), processes, or sleeps."""
        stale_check_counter = 0

        while not self._stop_event.is_set():
            try:
                async with AsyncSessionLocal() as db:
                    # Periodically sweep stale jobs (every 30 iterations ~ 1 minute)
                    stale_check_counter += 1
                    if stale_check_counter >= 30:
                        stale_check_counter = 0
                        await sweep_stale_jobs(db)

                    # Claim 1 document job atomically
                    claim_query = text("SELECT * FROM claim_document_job();")
                    claim_res = await db.execute(claim_query)
                    claimed_row = claim_res.mappings().first()

                    if claimed_row:
                        await db.commit()
                        doc_dict = dict(claimed_row)
                        await process_document_job(doc_dict, db, self._provider)
                        continue

            except asyncio.CancelledError:
                break
            except Exception as e:  # noqa: BLE001
                logger.error(f"Error in ingestion worker loop: {e}")

            # Sleep 2 seconds before next poll
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=2.0)
            except TimeoutError:
                pass


worker = IngestionWorker()
