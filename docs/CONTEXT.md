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
- **Next Step:** Ready for Phase 4: Document upload, validation, and storage pipeline (Section 5.2.1, S11-S15 validators, Supabase storage upload, dedupe, confidentiality ack, documents UI).


