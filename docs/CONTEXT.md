# Project Context & Handoff Log

## 2026-11-13 - Initial Setup & Prerequisites Verification
- **Status:** Prerequisites review and initial project scaffolding setup complete. No code/building started yet.
- **Decisions:**
  - Initialized Git repository.
  - Placed `BLUEPRINT.md` in `docs/` and established `AGENTS.md` rules at repo root.
  - Setup `.gitignore` with strict rules for `.env` files, secrets, build artifacts, and virtual environments.
  - Prepared `.env.example` templates for `backend/` and `frontend/`.
- **Known Issues / Pending User Actions:**
  - Need external account setups and secrets (Supabase, Google AI Studio, Cloudflare, Render) before running live smoke tests and beginning Phase 0 scaffolding.
  - Docker Desktop is not currently detected in local environment; required for local pgvector testing.
- **Next Step:** Complete user accounts/secrets registration in local `.env` files, run smoke checks, then begin Phase 0.
