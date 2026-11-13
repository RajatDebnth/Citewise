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
- **Next Step:** Phase 2: Auth and workspaces (`core/security.py`, verify Supabase JWTs via JWKS, `current_user`, `require_member`, workspace endpoints, and cross-tenant tests).


