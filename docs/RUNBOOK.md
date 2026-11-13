# Operations Runbook

This document details operational procedures, incident response, monitoring, and recovery steps for the Company Knowledge Assistant.

---

## 1. Supabase Inactivity & Paused Database
- **Symptom:** API logs show connection timeouts to Postgres, or `GET /api/v1/health/deep` returns 503 or times out.
- **Root Cause:** Free Supabase projects automatically pause after 7 consecutive days of inactivity.
- **Recovery Procedure:**
  1. Open the [Supabase Dashboard](https://supabase.com/dashboard).
  2. Select your project and click **Restore project**. Wait 1–2 minutes for the database cluster to resume.
  3. Verify connection by curling the deep health endpoint:
     ```bash
     curl -fsS https://<your-service>.onrender.com/api/v1/health/deep
     ```
     Should return: `{"status": "ok", "db": "ok", "storage": "ok"}`.
  4. Ensure the GitHub Actions keepalive workflow (`.github/workflows/keepalive.yml`) is active. Note: GitHub disables scheduled workflows in public repos after 60 days without commit activity; configure an external pinger (UptimeRobot or cron-job.org) hitting `/api/v1/health` every 5 minutes and `/api/v1/health/deep` once daily.

---

## 2. Database Backup & Disaster Recovery
- **Policy:** Take monthly off-platform backups of the database schema and data.
- **Execution:**
  ```bash
  # Dump database using Supabase session pooler connection string
  pg_dump --clean --if-exists --no-owner --no-privileges \
    -d "$DATABASE_URL" \
    -f "backup_$(date +%Y%m%d).sql"
  ```
- **Seeding after Fresh Restore:**
  Synthetic demo documents are tracked in git under `supabase/seed/demo_docs/`. After restoring a database schema or moving projects:
  ```bash
  python scripts/apply_migration.py
  python scripts/seed_demo.py
  ```

---

## 3. Database Space & Storage Limits (500 MB DB / 1 GB Storage)
- **Symptom:** Approaching the 500 MB Postgres limit or 1 GB Supabase storage budget on the free tier.
- **Emergency Action:**
  1. Toggle the upload kill-switch immediately to halt new file ingestions:
     ```bash
     curl -X PATCH https://<your-api>/api/v1/admin/settings \
       -H "Authorization: Bearer <admin-jwt>" \
       -H "Content-Type: application/json" \
       -d '{"uploads_enabled": false}'
     ```
  2. Inspect `/api/v1/admin/usage` for total chunks, document counts, and estimated DB size.
  3. Purge inactive test workspaces (deleting a workspace cascades to delete all chunks, messages, conversations, and Supabase Storage files).
  4. Once storage is below 70% capacity (< 350 MB), re-enable uploads:
     ```bash
     curl -X PATCH https://<your-api>/api/v1/admin/settings \
       -H "Authorization: Bearer <admin-jwt>" \
       -H "Content-Type: application/json" \
       -d '{"uploads_enabled": true}'
     ```

---

## 4. Gemini Quota & Rate Limit Exhaustion
- **Symptom:** `429 RESOURCE_EXHAUSTED` or daily budget reached in application logs.
- **Behavior:** The application returns a graceful 429 response to clients ("Daily quota exceeded") or a 503 response for the public demo ("Service busy").
- **Recovery Procedure:**
  1. Inspect daily usage breakdown via `GET /api/v1/admin/usage` (shows `embed_calls`, `llm_calls`, `questions`, and `demo_questions`).
  2. Check current quotas in the [Google AI Studio Rate Limit Dashboard](https://aistudio.google.com/rate-limit).
  3. If upgrading to paid tier:
     - Set `LLM_TIER=paid` in Render environment variables.
     - Increase `GEMINI_RPM` (e.g., from 15 to 60 or higher).
     - Increase `GEMINI_DAILY_CALL_BUDGET` accordingly.
     - Redeploy the service.

---

## 5. Stuck Documents in Ingestion Queue
- **Symptom:** Document status stays in `processing` for longer than 10 minutes.
- **Automatic Recovery:**
  - The background sweeper task (`sweep_stale_jobs`) runs automatically in the FastAPI lifespan and resets locks older than 10 minutes.
  - After 3 failed attempts, status transitions to `failed` with a user-safe `error_message`.
- **Manual Intervention:**
  - Users or admins can trigger an instant retry via:
    ```bash
    POST /api/v1/workspaces/{wid}/documents/{did}/retry
    ```

---

## 6. Cold Start & Server Sleeping Mitigation
- **Symptom:** Render free web service sleeps after 15 minutes of inactivity; first request takes 45–60 seconds.
- **Mitigation:**
  - The frontend includes `useServerWake` which pings `/api/v1/health` on load and displays a friendly "Waking server, this can take up to a minute…" banner.
  - Set up a free monitor on [UptimeRobot](https://uptimerobot.com) to ping `GET /api/v1/health` every 5 minutes to prevent sleep during operating hours.

---

## 7. Key Rotation Procedures
- **Gemini API Key:**
  1. Generate new key in Google AI Studio.
  2. Update `GEMINI_API_KEY` in Render dashboard environment settings.
  3. Trigger a manual deploy in Render.
- **Supabase Service Key:**
  1. In Supabase Dashboard → Settings → API, rotate the `service_role` secret.
  2. Update `SUPABASE_SERVICE_KEY` in Render environment variables and redeploy.
- **Supabase JWT Secret:**
  1. Update `SUPABASE_JWT_SECRET` in Render. JWKS-based verification (`SUPABASE_JWKS_URL`) continues to work seamlessly without downtime.

---

## 8. Portable Deployment Fallbacks
If Render free tier or Cloudflare Pages policy changes:
- **API Runtime:** The backend is packaged as a standard single-worker Docker container (`backend/Dockerfile`). It deploys identically to Koyeb, Fly.io, or Railway with zero code modifications.
- **Frontend SPA:** The frontend builds to a pure static bundle in `frontend/dist`. It deploys identically to Netlify, Vercel, or AWS S3 + CloudFront.
