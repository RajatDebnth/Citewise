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
- **Next Step:** Phase 1: Database and Supabase wiring (`supabase/migrations/0001_init.sql`, `core/db.py`, `/api/v1/health/deep`, and `scripts/check_db.py`).


