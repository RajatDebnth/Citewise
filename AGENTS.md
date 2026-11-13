# Project rules for AI coding agents

## Source of truth
- Read docs/BLUEPRINT.md sections relevant to the current phase, and docs/CONTEXT.md, before coding.
- Do not change the stack, schema or API contract without being asked. If something in the blueprint
  looks wrong, stop and say so instead of improvising.

## Scope discipline
- Implement ONLY the current phase. Do not start later phases or add features, services or dependencies
  not named in the blueprint. No Qdrant, Celery, Redis, microservices, or extra auth providers.
- Prefer small, boring, readable code. No premature abstractions beyond the provider interfaces.

## Security rules (never violate)
- Every workspace-scoped route uses require_member(). Every repository query takes workspace_id.
- Never put SUPABASE_SERVICE_KEY, DATABASE_URL or GEMINI_API_KEY in frontend code, logs, or git.
- Never use client-supplied filenames in storage paths. Validate uploads by magic bytes and size.
- Never render model output as raw HTML.
- All external calls need timeouts; Gemini calls need retry with backoff.

## Workflow
- Write or update tests with the code. Run them and fix failures before saying the phase is done.
- Use type hints (Python) and strict TypeScript. Run ruff / tsc / eslint.
- Make a short plan first. Keep diffs small. Do not reformat unrelated files.
- Never invent library APIs: read installed package docs or source when unsure.
- Gemini model IDs come from env vars, never hard-coded.

## Finishing a phase
- Report: what changed, how to run it, tests run + results, anything skipped.
- Append a dated entry to docs/CONTEXT.md: decisions, file map changes, known issues, next step.
