# Operations Runbook

This document details operational procedures and recovery steps for the Company Knowledge Assistant.

## 1. Supabase Inactivity & Paused Database
- **Symptom:** API logs show connection timeouts to Postgres, or `/health/deep` fails.
- **Action:**
  1. Open the Supabase Dashboard.
  2. Click **Restore project** and wait 1–2 minutes for the database cluster to resume.
  3. Verify connection by curling the deep health endpoint:
     ```bash
     curl -fsS https://<your-service>.onrender.com/api/v1/health/deep
     ```
  4. The GitHub Actions keep-alive workflow (`.github/workflows/keepalive.yml`) runs every 2 days to prevent auto-pausing.

## 2. Database Space & Storage Limits
- **Symptom:** Approaching the 500 MB Postgres limit or 1 GB storage limit on the free tier.
- **Action:**
  1. Toggle upload kill-switch: set `uploads_enabled=false` in app settings to prevent new file uploads.
  2. Inspect `/admin/usage` for storage breakdown by workspace.
  3. Delete idle demo conversations or obsolete workspaces (cascading chunk & storage deletion).
  4. Once within safe limits (< 70% capacity), re-enable `uploads_enabled=true`.

## 3. Gemini Quota & Rate Limit Exhaustion
- **Symptom:** 429 RESOURCE_EXHAUSTED or Daily Budget reached in application logs.
- **Action:**
  1. The app gracefully falls back to a friendly "Assistant is busy" message when daily limits are reached.
  2. Check current quotas in Google AI Studio rate-limit dashboard (`aistudio.google.com/rate-limit`).
  3. If on a paid tier, update `LLM_TIER=paid` and adjust `GEMINI_RPM` / `GEMINI_DAILY_CALL_BUDGET` in Render environment variables.

## 4. Stuck Documents in Ingestion
- **Symptom:** Document status stays in `processing` for longer than 10 minutes.
- **Action:**
  1. The background sweeper task automatically resets stale processing locks older than 10 minutes back to `pending`.
  2. After 3 failed attempts, status transitions to `failed` with an explicit `error_message`.
  3. Users can trigger a retry via `POST /workspaces/{wid}/documents/{did}/retry`.

## 5. Key Rotation Procedure
- **Gemini API Key:** Generate new key in Google AI Studio → update `GEMINI_API_KEY` in Render env and local `.env` → trigger redeploy.
- **Supabase Service Key:** Generate new service role key in Supabase API settings → update `SUPABASE_SERVICE_KEY` in Render env and local `.env` → trigger redeploy.

