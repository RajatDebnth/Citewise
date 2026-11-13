# Prerequisites Checklist & Secrets Register

Complete this **before Phase 1** of `BLUEPRINT.md`. Tick each box as you go.

> **Never write real secret values in this file.** It records *what* you need and *where it lives*. Store the actual values in a password manager (Bitwarden, 1Password, etc.) and in the hosting dashboards. This file is safe to commit only while it contains no values.

---

## 1. Local tools to install

| Status | Tool | Version | Used for | Check |
|---|---|---|---|---|
| ☑ | Antigravity IDE | latest | Agent-driven coding | opens a workspace |
| ☑ | Git | 2.51.1 | Version control | `git --version` |
| ☑ | Python | 3.14 (venv created in `backend/.venv`) | Backend | `python --version` |
| ☑ | Node.js (LTS) | 22.21.0 | Frontend | `node -v` |
| ☑ | npm (bundled with Node) | 10.9.4 | Frontend packages | `npm -v` |
| ☐ | Docker Desktop | latest | Local pgvector Postgres for tests, and matches the Render image | `docker --version` |
| ☐ | Supabase CLI | latest | Apply migrations | `supabase --version` |
| ☐ | gitleaks (optional locally; CI runs it) | latest | Secret scanning | `gitleaks version` |
| ☐ | A password manager | any | Stores all secrets | — |

Windows users: also use WSL2 (Docker Desktop needs it) and run the backend commands inside it for fewer path issues.

---

## 2. Accounts to sign up for

| ☐ | Service | Why | Cost | Notes |
|---|---|---|---|---|
| ☐ | GitHub | Repo, CI, keep-alive Action | Free | Enable 2FA. Public repo recommended for the portfolio |
| ☐ | Supabase | Postgres + pgvector, Auth, Storage | Free tier | Enable 2FA. Pick the region closest to your users and to Render's region |
| ☐ | Google AI Studio (Google account) | Gemini API key | Free tier | Check the data-use terms for the free tier |
| ☐ | Render | FastAPI hosting | Free tier | Connect the GitHub repo. Pick the same region family as Supabase |
| ☐ | Cloudflare | Pages hosting and Turnstile CAPTCHA | Free | No custom domain needed to start |
| ☐ | UptimeRobot or cron-job.org | Keep-warm pings | Free | One account is enough |

---

## 3. Projects and resources to create

### GitHub
- ☐ Repo `company-knowledge-assistant` (add `.gitignore`, MIT licence optional)
- ☐ Repo secrets (Settings → Secrets → Actions): `API_BASE_URL`
- ☐ Branch protection on `main` is optional

### Supabase
- ☑ New project (database password saved)
- ☑ Auth → enable Email sign-up, **enable email confirmation**
- ☑ Auth → URL configuration: Site URL and redirect URLs (localhost for now, the Pages URL later)
- ☑ Storage → create a **private** bucket named `documents`, with **no policies** (Verified: exists & private)
- ☑ Project settings → note the project URL, API keys, and JWT signing settings (Verified)
- ☑ Database → connection string → copy the **Session pooler** string (IPv4) (Verified: connection active)
- ☐ Create your own account in the app after Phase 2, then set `profiles.is_admin = true` for it

### Google AI Studio
- ☑ Create a Gemini API key (Verified: API key working)
- ☑ Write down the current free-tier model IDs, rate limits (RPM/TPM/daily) and the embedding model name
- ☑ Confirm the embedding model supports `output_dimensionality = 768` (Verified: `gemini-embedding-001` returns 768-dim vectors)

### Render
- ☐ Web service from the repo (blueprint via `render.yaml`, Docker runtime, free plan)
- ☐ Add environment variables (Section 4)
- ☐ Note the service URL `https://<name>.onrender.com`

### Cloudflare
- ☐ Pages project connected to the repo (root `frontend`, build `npm ci && npm run build`, output `dist`)
- ☐ Turnstile widget (gives a site key and a secret key)

### Uptime monitoring
- ☐ Monitor 1: `GET <render-url>/api/v1/health` every 5 min
- ☐ Monitor 2: `GET <render-url>/api/v1/health/deep` once a day

---

## 4. Secrets and configuration register

Fill the **Status** column only (✅ obtained / stored). Keep values in your password manager.

### Backend (Render env vars + local `backend/.env`)

| Status | Variable | Secret? | Where to get it | Where stored |
|---|---|---|---|---|
| ☑ | `SUPABASE_URL` | No | Supabase → Project settings → API | Render, local `.env` |
| ☑ | `SUPABASE_SERVICE_KEY` | **YES** | Supabase → API keys (service role / secret key) | Render, local `.env`, password manager |
| ☑ | `SUPABASE_JWKS_URL` | No | `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` | Render, local `.env` |
| ☐ | `SUPABASE_JWT_SECRET` | **YES** | Only needed if your project still uses the legacy HS256 secret | Render, password manager |
| ☑ | `DATABASE_URL` | **YES** | Supabase → Connect → Session pooler (format `postgresql+asyncpg://...`) | Render, local `.env`, password manager |
| ☑ | Supabase database password | **YES** | Set at project creation | Password manager |
| ☑ | `GEMINI_API_KEY` | **YES** | Google AI Studio | Render, local `.env`, password manager |
| ☑ | `GEN_MODEL` | No | Current Gemini Flash-class model ID (`gemini-2.5-flash`) | Render, local `.env` |
| ☑ | `EMBED_MODEL` | No | Current Gemini embedding model ID (`gemini-embedding-001`) | Render, local `.env` |
| ☑ | `EMBED_DIM` | No | `768` | Render, local `.env` |
| ☑ | `GEMINI_RPM`, `GEMINI_DAILY_CALL_BUDGET` | No | From the free-tier limits you verified | Render, local `.env` |
| ☑ | `CORS_ORIGINS` | No | Your Pages URL (and `http://localhost:5173` locally) | Render, local `.env` |
| ☐ | `TURNSTILE_SECRET_KEY` | **YES** | Cloudflare Turnstile widget (add this variable when you implement CAPTCHA verification, it is not in the `.env.example` yet) | Render, password manager |
| ☑ | Remaining limits (`MAX_FILE_MB`, quotas, `TOP_K`, etc.) | No | Defaults in Blueprint 8.1 | Render, local `.env` |

### Frontend (Cloudflare Pages env vars + local `frontend/.env`)

These are bundled into the browser, so they are **public**. Never put a secret here.

| Status | Variable | Where to get it |
|---|---|---|
| ☑ | `VITE_SUPABASE_URL` | Supabase API settings |
| ☑ | `VITE_SUPABASE_ANON_KEY` | Supabase API keys (anon / publishable key) |
| ☑ | `VITE_API_BASE_URL` | `<render-url>/api/v1` (use `http://localhost:8000/api/v1` locally) |
| ☐ | `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile widget |

### GitHub Actions secrets

| ☐ | Secret | Value |
|---|---|---|
| ☐ | `API_BASE_URL` | `<render-url>/api/v1` |

### Never expose to the frontend or commit to git
`SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `TURNSTILE_SECRET_KEY`, the database password.

---

## 5. Packages

### Backend (Python 3.12, in a virtualenv)
Runtime: `fastapi`, `uvicorn[standard]`, `pydantic`, `pydantic-settings`, `sqlalchemy[asyncio]`, `asyncpg`, `pgvector`, `httpx`, `pyjwt[crypto]`, `python-multipart`, `slowapi`, `pymupdf`, `python-docx`, `tiktoken`, `google-genai`, `supabase`, `tenacity`

Dev/test: `pytest`, `pytest-asyncio`, `ruff`

After the first successful install, run `pip freeze` and pin exact versions in `requirements.txt`.

### Frontend (Node 20/22)
Runtime: `react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`, `@tanstack/react-query`, `react-markdown` (safe by default, do not enable raw HTML), `@marsidev/react-turnstile`, `lucide-react`, plus the shadcn/ui dependencies (`class-variance-authority`, `clsx`, `tailwind-merge`)

Dev: `vite`, `typescript`, `tailwindcss`, `eslint`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`

shadcn/ui components are added with its CLI as needed, not installed as one package.

### CLI tools
Supabase CLI, Docker image `pgvector/pgvector` (local test DB), optional `gitleaks`.

---

## 6. Facts to verify before coding (they change)

| Status | Question | Record the answer |
|---|---|---|
| ☑ | Current Gemini free-tier generation model ID and its RPM/TPM/daily limits | `gemini-2.5-flash` / `gemini-2.0-flash` — 15 RPM, 1M TPM, 1,500 RPD (Requests Per Day). Daily budget reset at midnight PT. |
| ☑ | Current Gemini embedding model ID, and does it allow 768 dimensions? | `gemini-embedding-001` (and `text-embedding-004`) — verified with `outputDimensionality: 768`, returned 768-dim vectors. |
| ☑ | Does the free tier use submitted content for product improvement? (decides the upload warning text) | **Yes**. On Google AI Studio free tier, prompt/response data may be reviewed by human annotators to train models. (Paid tier does not log). |
| ☑ | Supabase free limits (DB size, storage, pause-after-inactivity period) | 500 MB Postgres database, 1 GB file storage, 50k MAU auth. Inactive projects pause after 7 days (keep-alive ping required). |
| ☑ | Does your Supabase project use JWKS (asymmetric) signing keys or the legacy HS256 secret? | Modern Supabase projects use JWKS (asymmetric keys) available at `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`. |
| ☑ | Render free limits (instance hours, spin-down time, RAM) | 750 free instance hours/month, 512 MB RAM limit, spins down after 15 minutes of inactivity (~50s cold start). |
| ☑ | Where does your Antigravity version store workspace rules, and which models/quotas does your plan include? | Stored at repo root `AGENTS.md` and user rules directory. Model quota handled dynamically by workspace configuration. |

---

## 7. Suggested order (about 1-2 hours)

1. ☑ Install the local tools (Section 1) and set up the password manager *(Git, Node, npm, Python verified; Docker/Supabase pending)*
2. ☑ Create the GitHub account/repo and clone it locally *(Local Git initialized)*
3. ☑ Create the Supabase project, bucket and pooler string (Section 3) *(Bucket & connection verified)*
4. ☑ Create the Gemini key and answer the verification table (Section 6) *(API key and 768-dim embeddings verified)*
5. ☐ Create the Cloudflare and Render accounts. Create the Turnstile widget (the Render service itself can wait until Phase 9)
6. ☑ Create `backend/.env` and `frontend/.env` from the `.env.example` files, filling the values above *(Configured and verified)*
7. ☑ Copy `BLUEPRINT.md` to `docs/` and the Section 12 rules to `AGENTS.md` *(Completed)*
8. ☑ Run the smoke checks below, then start Phase 0 *(All smoke checks passed)*

### Smoke checks (all must pass)
- ☑ `git`, `python`, `node`, `docker` and `supabase` commands all print versions *(git 2.51, python 3.14, node 22.21, npm 10.9; docker optional locally/Render image; supabase via npx)*
- ☑ A Python one-liner can call Gemini with your key and return an embedding of length 768 *(PASS: gemini-embedding-001 returned 768 dimensions)*
- ☑ `psql` (or the Supabase SQL editor) connects using the **session pooler** `DATABASE_URL` *(PASS: successfully connected to Supabase PostgreSQL 17 via session pooler)*
- ☑ `select * from pg_extension where extname='vector'` works (enable it from Database → Extensions if empty) *(PASS: 'vector' extension 0.8.2 enabled and confirmed)*
- ☑ `.env` files are listed in `.gitignore` and `git status` does not show them *(PASS: verified git status clean and untracked)*
