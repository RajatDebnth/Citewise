# Company Knowledge Assistant

A grounded enterprise retrieval-augmented generation (RAG) assistant designed to ingest company documents (PDF, DOCX, TXT) and provide verified answers strictly backed by exact citations.

## Tech Stack
- **Backend:** Python 3.12, FastAPI, SQLAlchemy (asyncio), asyncpg, pgvector, pydantic-settings, google-genai
- **Database & Storage:** Supabase (PostgreSQL with pgvector, Supabase Auth, Storage)
- **AI & Embeddings:** Google Gemini (`gemini-2.5-flash` for reasoning/answers, `gemini-embedding-001` for 768-dim embeddings)
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui components, React Router
- **Deployment:** Render (FastAPI Docker runtime) + Cloudflare Pages (Static SPA)

## Project Layout
```
├── AGENTS.md                  # Strict development rules for AI coding agents
├── BLUEPRINT.md               # Architecture, schema, and API specification
├── PREREQUISITES.md           # Setup verification & secrets register
├── docs/                      # Documentation (BLUEPRINT, CONTEXT, PRIVACY, RUNBOOK)
├── backend/                   # FastAPI application
│   ├── app/                   # App factory, core config, APIs, schemas, services
│   ├── tests/                 # Unit, integration, and security tests
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                  # Vite + React + TypeScript SPA
│   ├── src/                   # Components, pages, layouts, hooks, types
│   └── public/                # Static assets & routing redirects
└── .github/workflows/         # CI validation & keep-alive pinger
```

## Getting Started

### 1. Prerequisites
- Python 3.12+
- Node.js 20+ / 22+
- Supabase account with pgvector enabled
- Google AI Studio API key

### 2. Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # Configure your Supabase and Gemini credentials
uvicorn app.main:app --reload --port 8000
```
Verify the health check:
```bash
curl http://localhost:8000/api/v1/health
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Security & Architectural Constraints
- **Tenant Isolation:** Every workspace query strictly filters by `workspace_id`.
- **Zero Raw HTML:** Model outputs and markdown are sanitized; raw HTML execution is blocked.
- **Privacy First:** Uploaded documents are kept in private storage buckets; free-tier warnings inform users about LLM provider data handling.

