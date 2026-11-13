# Project Context & Handoff Log

## 2026-11-13 - Initial Setup & Prerequisites Verification
- **Status:** Prerequisites review and initial project scaffolding setup complete.
- **Decisions & Verifications:**
  - Initialized Git repository.
  - Placed `BLUEPRINT.md` in `docs/` and established `AGENTS.md` rules at repo root.
  - Setup `.gitignore` with strict rules for `.env` files, secrets, build artifacts, and virtual environments.
  - Verified local tools: Git (2.51.1), Node.js (22.21.0), npm (10.9.4), Python (3.14.0 with venv in `backend/.venv`).
  - Verified Gemini API key: Google AI Studio key tested with `gemini-embedding-001`, confirmed 768-dimensional embedding generation. Updated `EMBED_MODEL=gemini-embedding-001`.
  - Verified Supabase configuration: Connected to PostgreSQL 17 on session pooler, verified private `documents` bucket, verified JWKS endpoint, and successfully enabled the `vector` extension (v0.8.2).
  - All 5 smoke checks passed.

## 2026-11-13 - Phase 0: Monorepo Scaffolding & Health Check
- **Status:** Complete. Acceptance criteria met.
- **Decisions & Architecture:**
  - Backend: Created FastAPI app factory `create_app()` in `backend/app/main.py`.
  - Config: Created `backend/app/core/config.py` using `pydantic-settings` containing all variables from Blueprint 8.1 with CORS validator.
  - Logging & Errors: Implemented structured JSON logging with request ID tracking in `backend/app/core/logging.py`, and standard error handlers in `backend/app/core/errors.py` returning `{"error": {"code": str, "message": str}}` without stack traces or SQL leaks.
  - Health: Implemented `/api/v1/health` returning `{"status": "ok"}`.
  - Frontend: Scaffolded Vite + React 18 + TypeScript + Tailwind CSS in `frontend/`. Implemented routing stubs for all Blueprint Section 9 routes (`/`, `/demo`, `/login`, `/signup`, `/app`, `/app/w/:wid/chat/:cid?`, `/app/w/:wid/documents`, `/app/w/:wid/unanswered`, `/app/w/:wid/settings`).
  - Infrastructure: Added `backend/Dockerfile` (Python 3.12-slim single worker), `render.yaml`, `.github/workflows/ci.yml`, `.github/workflows/keepalive.yml`, `docs/PRIVACY.md`, `docs/RUNBOOK.md`, `README.md`.
  - Dependencies: Pinned exact package versions in `backend/requirements.txt` and verified clean `package-lock.json`.
- **Tests & Verification:**
  - `ruff check backend/app backend/tests`: Passed (0 errors).
  - `pytest backend/tests`: Passed (2 passed in 1.00s).
  - `uvicorn app.main:app` test on port 8000: `GET /api/v1/health` returned `{"status": "ok"}`.
  - `npm run build` in `frontend`: Passed (`tsc` clean and Vite build output to `dist/`).
- **Next Step:** Completed. Ready for Phase 1.

## 2026-11-13 - Phase 1: Database and Supabase Wiring
- **Status:** Complete. Acceptance criteria met.
- **Decisions & Architecture:**
  - Implemented exact database schema in `supabase/migrations/0001_init.sql` (13 tables, extensions `vector` & `pgcrypto`, enums, RLS policies on all tables, `match_chunks` function with 768-dim query vector, and `claim_document_job` for atomic queue claiming).
  - Created `backend/app/core/db.py` with SQLAlchemy async engine, `DB_POOL_MAX` (pool size 5, max_overflow 0), asyncpg `statement_cache_size=0`, `prepared_statement_cache_size=0`, and pgvector registration on connections.
  - Implemented `backend/app/core/limits.py` for slowapi rate limiting.
  - Added `GET /api/v1/health/deep` in `backend/app/api/v1/health.py`, verifying both live PostgreSQL connection (`SELECT 1`) and Supabase Storage bucket (`documents`).
  - Created `scripts/apply_migration.py` and applied `0001_init.sql` directly to the Supabase instance.
  - Created `scripts/check_db.py` verifying extensions, all 13 tables, RLS enabled on all tables, seed settings, and `match_chunks` & `claim_document_job` execution.
  - Added `docker-compose.yml` for local `pgvector/pgvector` database container.
  - Added migration fixture and test session fixtures in `backend/tests/conftest.py`.
- **Tests & Verification:**
  - `python scripts/check_db.py`: All 5 check categories passed (`>>> ALL DATABASE CHECKS PASSED SUCCESSFULLY! <<<`).
  - `pytest backend/tests`: 3 passed in 9.04s (`test_health_check`, `test_deep_health_check`, `test_not_found_standard_error_shape`).
  - Live server test against `GET /api/v1/health/deep` returned `{"status": "ok", "db": "ok", "storage": "ok"}`.
  - `ruff check backend/app backend/tests scripts`: Passed with 0 errors.
- **Next Step:** Completed. Ready for Phase 2.

## 2026-11-13 - Phase 2: Auth and Workspaces
- **Status:** Complete. Acceptance criteria met.
- **Decisions & Architecture:**
  - Implemented `backend/app/core/security.py`:
    - JWT decoding supports Supabase asymmetric keys via cached JWKS (`PyJWKClient` for `RS256`/`ES256`) and symmetric fallback via `SUPABASE_JWT_SECRET` (`HS256`).
    - Validates unverified header algorithm, `exp`, `aud` ("authenticated" / "test_aud"), and UUID format of `sub`.
    - `get_current_user`: extracts `Bearer` token and resolves `AuthenticatedUser(id, email, role, is_admin)`.
    - `require_member(min_role)`: dependency factory checking workspace membership. Non-members receive HTTP 404 (zero existence leakage). Members without required role (e.g. member attempting owner action) receive HTTP 403 Forbidden.
  - Implemented `backend/app/schemas/user.py` and `backend/app/schemas/workspace.py` using strict Pydantic models.
  - Implemented repository `backend/app/repositories/workspaces.py`: all queries take `workspace_id` to strictly guarantee tenant isolation; logs audit events for creation and deletion (`CAST(:detail AS jsonb)`).
  - Implemented workspace endpoints in `backend/app/api/v1/workspaces.py`:
    - `POST /api/v1/workspaces` (enforces `MAX_WORKSPACES_PER_USER`, assigns caller as owner)
    - `GET /api/v1/workspaces` (lists caller's workspaces)
    - `GET /api/v1/workspaces/{wid}` (returns workspace detail and live document/chunk/member counts)
    - `PATCH /api/v1/workspaces/{wid}` (renames workspace; owner only)
    - `DELETE /api/v1/workspaces/{wid}` (cascades deletion and logs audit; owner only)
    - `GET /api/v1/workspaces/{wid}/members` (lists members; member+)
    - `POST /api/v1/workspaces/{wid}/members` and `DELETE /api/v1/workspaces/{wid}/members/{user_id}` (stubs returning 501 per Blueprint 13 Phase 2)
  - Implemented `/api/v1/me` in `backend/app/api/v1/me.py`: returns profile (`id`, `email`, `display_name`, `is_admin`) and active daily quotas (questions, uploads, workspaces).
  - Configured test engine in `backend/app/core/db.py` to use `NullPool` when `APP_ENV == "test"` to ensure asyncpg connections close cleanly across test event loops.
- **Tests & Verification:**
  - Added test suite `backend/tests/test_auth_workspaces.py` with 6 comprehensive test cases:
    - `test_auth_token_validation`: anonymous, malformed, forged (invalid signature), expired, and invalid UUID `sub` tokens all rejected with 401.
    - `test_me_endpoint_profile_and_quotas`: verifies profile and daily quota calculations.
    - `test_workspace_crud_lifecycle`: full create, list, read details, rename, member list, delete, and 404 verification.
    - `test_cross_tenant_isolation_returns_404`: second user gets HTTP 404 trying to read, rename, or delete another user's workspace, and does not see it in workspace lists.
    - `test_member_vs_owner_role_permissions`: members can read workspace (200), but renaming or deleting returns 403 Forbidden.
    - `test_max_workspaces_per_user_limit`: verifies 400 `workspace_limit_exceeded` when limit is exceeded.
  - Ran `pytest backend/tests`: 9 of 9 passed (`test_health.py` and `test_auth_workspaces.py`).
  - Ran `ruff check app tests` in `backend`: 0 errors.
- **Next Step:** Completed. Ready for Phase 3.

## 2026-11-13 - Phase 3: Frontend Auth and Shell
- **Status:** Complete. Acceptance criteria met.
- **Decisions & Architecture:**
  - Initialized Supabase client in `frontend/src/lib/supabase.ts` with auto token refresh and local persistence.
  - Implemented `frontend/src/context/AuthContext.tsx` and `frontend/src/hooks/useAuth.ts`: manages session state, `signIn`, `signUp` (handling email confirmation notice), `signOut`, and subscribes to auth state changes.
  - Implemented `frontend/src/components/ProtectedRoute.tsx`: guards `/app` and `/app/w/:wid/*`, handles loading state, and redirects unauthenticated users to `/login`.
  - Implemented API client in `frontend/src/services/api.ts`:
    - Automatically attaches verified Supabase Bearer token.
    - Automatically refreshes token on HTTP 401 via `supabase.auth.refreshSession()` and retries once.
    - Enforces 90-second timeout via `AbortController`.
    - Automatically retries on network failures or 502/503/504 errors with jittered backoff.
    - Includes typed helpers for `workspacesApi`, `userApi`, and `healthApi`.
  - Implemented `useServerWake` hook (`frontend/src/hooks/useServerWake.ts`) and `ServerWakeBanner` (`frontend/src/components/ServerWakeBanner.tsx`): pings `/health` on app mount; displays top banner if server takes >3s to respond.
  - Implemented `LoginPage.tsx` and `SignupPage.tsx` with error handling, email confirmation notice, and redirect.
  - Implemented `WorkspacesPage.tsx`: lists workspaces, displays user quotas (workspaces, daily uploads, daily questions), create workspace dialog with limit error handling, and delete workspace confirmation dialog.
  - Enhanced `WorkspaceLayout.tsx` with live workspace title, role, stats, and sidebar navigation.
- **Tests & Verification:**
  - Both backend (port 8000) and frontend (port 5173) dev servers running continuously in the background as daemons.
  - Probed live endpoints: `/api/v1/health` returned `status: ok` (200), frontend root returned status 200.
  - Frontend build: `npm run build` executed `tsc && vite build` successfully with 0 errors.
- **Next Step:** Completed. Ready for Phase 4.

## 2026-11-13 - Phase 4: Document Upload and Storage Pipeline
- **Status:** Complete. Acceptance criteria met.
- **Decisions & Architecture:**
  - Implemented `backend/app/core/storage.py`: `SupabaseStorageService` wrapping private Supabase Storage bucket (`documents`) using `SUPABASE_SERVICE_KEY` for upload, delete, and 5-minute signed URL creation (`/storage/v1/object/sign`).
  - Implemented `backend/app/services/ingestion/validators.py` per S11-S15:
    - Streaming byte limit enforcing `MAX_FILE_MB = 10` during streaming without buffering whole payload.
    - Magic bytes and format validation: `.pdf` (`%PDF-`), `.docx` (`PK\x03\x04`), `.txt` (valid UTF-8).
    - Encrypted PDF rejection (PyMuPDF `doc.is_encrypted` check).
    - PDF page limit enforcement (`MAX_PAGES = 150`).
    - DOCX zip-bomb guard (uncompressed size <= 50 MB, compression ratio <= 100:1).
    - Filename sanitization (strips traversal, control chars, limits to 200 chars).
    - Storage path `{workspace_id}/{document_id}/original` (never client-supplied).
  - Implemented `backend/app/repositories/documents.py`:
    - All functions require `workspace_id`.
    - Global killswitch check against `app_settings.uploads_enabled`.
    - Daily upload quota (`DAILY_UPLOADS_PER_USER`) and workspace limit (`MAX_DOCS_PER_WORKSPACE`) checked and usage event inserted in the same transaction (S16, S18).
    - SHA-256 deduplication per workspace returning HTTP 409 Conflict.
    - Audit log entries for `upload_ack` (recording confidentiality acknowledgment) and `document_delete`.
  - Implemented `backend/app/api/v1/documents.py`:
    - `POST /workspaces/{wid}/documents` (requires `confidentiality_ack`, creates pending doc, returns 202)
    - `GET /workspaces/{wid}/documents` (lists workspace documents)
    - `GET /workspaces/{wid}/documents/{did}` (detail + error message)
    - `POST /workspaces/{wid}/documents/{did}/retry` (resets failed doc to pending)
    - `GET /workspaces/{wid}/documents/{did}/download` (returns 5-min signed URL)
    - `DELETE /workspaces/{wid}/documents/{did}` (removes Storage object then DB row, returns 204)
  - Implemented `frontend/src/pages/DocumentsPage.tsx`:
    - Drag-and-drop file upload zone with format and 10 MB size checks.
    - Confidentiality acknowledgment checkbox.
    - Live status badges: `pending`, `processing` (spinner), `ready`, and `failed`.
    - Auto-polling every 3s while any document is in pending or processing state.
    - Download button, retry button for failed documents, delete confirmation modal.
- **Tests & Verification:**
  - Added test suite `backend/tests/test_documents.py`:
    - `test_document_validation_and_rejection`: fake exe PDF, encrypted PDF, >150 pages PDF, zip bomb DOCX, missing XML DOCX, missing confidentiality ack, invalid extension all rejected with 400.
    - `test_document_lifecycle_and_deduplication`: upload (202), list, get detail, signed download, duplicate SHA-256 conflict (409), delete (204), and 404 confirmation.
    - `test_document_retry_flow`: resetting failed document to pending (200), rejecting retry on non-failed docs (400).
    - `test_documents_cross_tenant_isolation_returns_404`: Tenant B receives 404 for list, detail, download, retry, delete, and upload on Tenant A's workspace.
    - All 4 test suites passed.
  - `npm run build` passed with 0 errors.
  - `ruff check app tests` passed with 0 errors.
- **Next Step:** Completed. Ready for Phase 5.

## 2026-11-13 - Phase 5: Ingestion Worker Pipeline
- **Status:** Complete. Acceptance criteria met.
- **Decisions & Architecture:**
  - Implemented `backend/app/services/providers/base.py`:
    - Defined abstract `EmbeddingProvider` (`dimension`, `model_name`, `embed_documents`, `embed_query`).
    - Defined abstract `LLMProvider` (`model_name`, `generate`).
  - Implemented `backend/app/services/providers/gemini.py`:
    - `GeminiEmbeddingProvider` using official `google-genai` SDK (`client.aio.models.embed_content`).
    - Task types: `RETRIEVAL_DOCUMENT` for document chunks, `RETRIEVAL_QUERY` for queries.
    - Reduced-dimension L2 normalization helper `l2_normalize` ensuring unit-norm vectors for 768-dim storage and search.
    - Batched embedding up to `settings.EMBED_BATCH` (50).
    - `TokenBucketLimiter` enforcing `settings.GEMINI_RPM` (15 RPM).
    - `execute_with_retry` implementing exponential backoff with jitter on 429 and 5xx errors.
    - Startup self-check `verify_embedding_dimension(provider)` asserting vector dimension matches `settings.EMBED_DIM` (768).
    - `GeminiLLMProvider` for structured/JSON content generation.
  - Implemented Text Cleaners & Extractors:
    - `backend/app/services/ingestion/cleaner.py`: Unicode NFC normalization, null byte and non-printable control char stripping, de-hyphenation across line breaks, whitespace/newline collapsing, and `drop_repeated_headers_footers` for lines occurring on >60% of pages.
    - `backend/app/services/ingestion/extractors.py`:
      - PDF: PyMuPDF per-page extraction with font-size heuristic for section titles.
      - DOCX: `python-docx` extracting paragraphs and tables grouped under Heading 1-3 styles.
      - TXT: UTF-8 decoded single section.
  - Implemented Chunker (`backend/app/services/ingestion/chunker.py`):
    - Recursive splitting: headings -> paragraphs -> sentences -> words.
    - Target ≈ 800 tokens (`settings.CHUNK_TOKENS`), overlap ≈ 120 tokens (`settings.CHUNK_OVERLAP`), max 1,000 tokens using `tiktoken` `cl100k_base`.
    - Tracks `page_start`, `page_end`, and `section_title` per chunk.
    - Prefixes embedding input with `"{filename} · {section_title}\n"` (or `"{filename}\n"`).
    - Computes `content_sha256` per chunk.
    - Drops chunks under 30 tokens (unless single chunk).
    - Caps document at `settings.MAX_CHUNKS_PER_DOC` (400).
  - Implemented Ingestion Worker (`backend/app/services/ingestion/worker.py`):
    - Background asyncio loop calling PostgreSQL atomic function `claim_document_job()`.
    - Sweeps stale processing jobs (`locked_at < now() - interval '10 minutes'`) and marks failed after 3 attempts.
    - Embedding Cache: checks `embedding_cache` by `(content_sha256, model)` before calling provider; writes newly computed embeddings into `embedding_cache` and records `embed_call` in `usage_events`.
    - In ONE atomic transaction: deletes old chunks for document, inserts all `document_chunks` with vectors, updates document to `ready` with `chunk_count`, `page_count`, and `processed_at`.
    - Safe error handling: on any failure, logs full trace, rolls back, and marks document `failed` with safe error message. Cleans up `/tmp` file in `finally`.
    - Integrated with FastAPI lifespan in `backend/app/main.py`.
- **Tests & Verification:**
  - Added comprehensive test suite `backend/tests/test_ingestion.py` (12 test cases):
    - `test_cleaner_transformations`: Unicode normalization, null byte removal, de-hyphenation.
    - `test_cleaner_repeated_headers_footers`: Header/footer removal across pages.
    - `test_extract_txt`: Plain text extraction.
    - `test_extract_docx_with_headings`: DOCX headings mapped to section titles.
    - `test_extract_pdf_with_pages`: PDF page numbering and heading detection.
    - `test_chunk_document_sizing_and_overlap`: Chunk token counts, overlap, and embed_input prefix.
    - `test_l2_normalization`: Unit norm verification.
    - `test_startup_dimension_self_check`: Verification of matching vs mismatched dimension.
    - `test_ingestion_worker_pdf_to_ready`: End-to-end PDF processing reaching `ready` with chunks in DB.
    - `test_embedding_cache_avoids_redundant_calls`: Re-uploading identical content chunks yields 0 provider calls.
    - `test_corrupt_file_transitions_to_failed`: Corrupt document safely marked `failed`.
    - `test_stale_lock_recovery_and_sweeper`: Stale lock re-claimed and sweeper marks max attempts as `failed`.
  - Full test suite run (`pytest backend/tests`): 25 of 25 passed.
  - `ruff check backend/app backend/tests`: Passed (0 errors).
  - `npm run build` in `frontend`: Passed (0 errors).
- **Next Step:** Completed. Ready for Phase 6.

## 2026-11-13 - Phase 6: RAG Chat Backend Pipeline
- **Status:** Complete. Acceptance criteria met.
- **Decisions & Architecture:**
  - Implemented `backend/app/retrieval/retriever.py`:
    - `match_workspace_chunks`: calls PostgreSQL function `match_chunks(p_workspace_id, p_query, p_k, p_document_ids)` using cosine similarity.
    - Guaranteed workspace isolation (S4, S5). Restricts candidate chunks to `status = 'ready'` documents only.
  - Implemented `backend/app/rag/prompts.py`:
    - Strict system prompt requiring facts to come exclusively from `<sources>`, treating source content as untrusted data (prompt injection defense), citing source numbers like `[1]`, and returning JSON schema `{"answerable": bool, "answer": str, "used_sources": [int]}`.
    - `format_user_prompt`: builds XML `<source n="..." file="..." pages="..." section="...">` blocks.
    - `format_condense_prompt`: handles question condensation for follow-up turns when conversation history exists and `CONDENSE_ENABLED=True`.
  - Implemented `backend/app/rag/citations.py`:
    - `strip_html`: removes `<script>...</script>` and `<style>...</style>` blocks along with raw HTML tags to prevent XSS while preserving markdown and citation markers.
    - `parse_llm_json`: parses structured JSON, extracts code fence wrappers, validates required fields.
    - `build_citations`: drops hallucinated or invalid source indices (`used_sources` outside `1..k`), verifies indices against DB chunk metadata, extracts 300-char snippets, and sets `grounded=False` if no valid sources were cited.
  - Implemented `backend/app/rag/pipeline.py`:
    - `ask_question`:
      1. Enforces global killswitch `app_settings.chat_enabled`.
      2. Enforces daily question quota (`DAILY_QUESTIONS_PER_USER`) and logs `question` usage event in the same transaction.
      3. Gets or creates conversation scoped to `(workspace_id, user_id)`.
      4. Rewrites follow-up questions to standalone query if history exists and `CONDENSE_ENABLED=True`.
      5. Saves user message in `messages` table.
      6. Embeds query with `RETRIEVAL_QUERY` task type and L2 normalization.
      7. Retrieves chunks via `match_workspace_chunks`.
      8. Retrieval gate: if top similarity score is below `settings.RETRIEVAL_MIN_SCORE` (0.50) or no chunks found, immediately returns `"I couldn't find this in the uploaded documents."`, `grounded=False`, `citations=[]`, without calling the LLM, and inserts an `unanswered_questions` row.
      9. Calls LLM provider with `ANSWER_JSON_SCHEMA`, logs `llm_call` usage event. Retries once on JSON parse failure.
      10. Builds verified citations and persists assistant message with latency and grounding flags.
  - Implemented `backend/app/repositories/conversations.py`:
    - Scoped conversation CRUD (`get_or_create_conversation`, `list_workspace_conversations`, `get_conversation_with_messages`, `rename_conversation`, `delete_conversation`).
    - Message feedback upsert (`upsert_message_feedback`) ensuring message belongs to caller's workspace.
    - Unanswered questions tracking (`record_unanswered_question`, `list_unanswered_questions`, `update_unanswered_status`).
  - Implemented `backend/app/api/v1/chat.py`:
    - `POST /workspaces/{wid}/chat` (rate limited at 30/min).
    - `GET /workspaces/{wid}/conversations`
    - `GET /workspaces/{wid}/conversations/{cid}`
    - `PATCH /workspaces/{wid}/conversations/{cid}`
    - `DELETE /workspaces/{wid}/conversations/{cid}`
    - `POST /messages/{mid}/feedback`
    - `GET /workspaces/{wid}/unanswered`
    - `PATCH /workspaces/{wid}/unanswered/{uid}`
  - Registered `chat_router` in `backend/app/main.py`.
- **Tests & Verification:**
  - Added comprehensive test suite `backend/tests/test_chat.py` (6 test cases):
    - `test_chat_grounded_answer`: Happy path with citation `[1]`, verified filename, page, section, score > 0.9.
    - `test_chat_retrieval_threshold_fallback_without_llm`: Off-topic query with similarity < 0.50 returns fallback without calling LLM (call count = 0), and creates `unanswered_questions` row.
    - `test_chat_invalid_citation_index_handled_gracefully`: Hallucinated source index `[99]` dropped by citation validator and marked `grounded=False`.
    - `test_chat_prompt_injection_safety_and_html_stripping`: Malicious `<script>` tags and prompt injection text sanitized safely.
    - `test_cross_tenant_chat_and_retrieval_isolation`: Tenant B receives 404 attempting to chat in Workspace A, and querying in Workspace B never retrieves Tenant A's documents.
    - `test_conversations_crud_and_feedback_flow`: Full conversation lifecycle (chat -> list -> detail -> rename -> feedback -> delete -> 404).
  - All 6 chat tests passed.
  - `ruff check backend/app backend/tests`: Passed (0 errors).
  - `npm run build` in `frontend`: Passed (0 errors).
- **Next Step:** Ready for Phase 7: Chat Frontend (`ChatPage.tsx`, conversation list, message view with safe markdown, inline citation chips `[n]` opening citation side panel, 👍/👎 feedback buttons, ungrounded / not-found state, and unanswered questions page).




