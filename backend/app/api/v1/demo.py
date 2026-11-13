import hashlib
import time
from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.core.errors import AppException
from app.core.limits import limiter
from app.rag.pipeline import ask_demo_question

router = APIRouter(prefix="/demo", tags=["demo"])


class DemoDocumentItem(BaseModel):
    id: UUID
    filename: str
    page_count: int | None = None
    chunk_count: int = 0


class DemoChatMessageItem(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=2000)


class DemoChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    history: list[DemoChatMessageItem] = Field(default_factory=list, max_length=6)


class CitationResponse(BaseModel):
    n: int
    chunk_id: UUID
    document_id: UUID
    filename: str
    page_start: int | None = None
    page_end: int | None = None
    section_title: str | None = None
    score: float
    snippet: str


class DemoChatResponse(BaseModel):
    answer: str
    grounded: bool
    citations: list[CitationResponse] = Field(default_factory=list)


# Short-TTL answer cache for common demo questions (Blueprint 5.4)
class DemoAnswerCache:
    def __init__(self, ttl_seconds: int = 300) -> None:
        self.ttl = ttl_seconds
        self._cache: dict[str, tuple[float, dict[str, Any]]] = {}

    def get(self, question: str) -> dict[str, Any] | None:
        key = question.strip().lower()
        if key in self._cache:
            ts, val = self._cache[key]
            if time.time() - ts < self.ttl:
                return val
            del self._cache[key]
        return None

    def set(self, question: str, val: dict[str, Any]) -> None:
        key = question.strip().lower()
        self._cache[key] = (time.time(), val)


demo_cache = DemoAnswerCache(ttl_seconds=300)


def get_client_ip(request: Request) -> str:
    """Extracts client IP following S20: checks CF-Connecting-IP, trusted XFF hop, or client.host."""
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


def get_daily_ip_hash(ip: str) -> str:
    """Computes daily-salted SHA-256 IP hash (S16, S20). Raw IPs are never stored."""
    today_str = datetime.now(UTC).date().isoformat()
    salt = settings.SUPABASE_JWT_SECRET or "knowledge-demo-salt"
    return hashlib.sha256(f"{ip}:{today_str}:{salt}".encode()).hexdigest()


@router.get("/documents", response_model=list[DemoDocumentItem])
async def list_demo_documents(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[DemoDocumentItem]:
    """Public endpoint to list documents in the synthetic demo workspace (S5.4)."""
    ws_res = await db.execute(
        text("SELECT id FROM workspaces WHERE is_demo = true LIMIT 1;")
    )
    demo_ws = ws_res.mappings().first()
    if not demo_ws:
        return []

    docs_res = await db.execute(
        text(
            """
            SELECT id, filename, page_count, chunk_count
            FROM documents
            WHERE workspace_id = :wid AND status = 'ready'
            ORDER BY created_at ASC;
            """
        ),
        {"wid": demo_ws["id"]},
    )
    rows = docs_res.mappings().all()
    return [
        DemoDocumentItem(
            id=r["id"],
            filename=r["filename"],
            page_count=r["page_count"],
            chunk_count=r["chunk_count"],
        )
        for r in rows
    ]


@router.post("/chat", response_model=DemoChatResponse)
@limiter.limit("3/minute")
async def demo_chat(
    request: Request,
    payload: DemoChatRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DemoChatResponse:
    """Public demo chat endpoint (S5.4):
    
    - Rate limits: 3/min burst, 15/day per IP hash (S16, S20)
    - Global daily Gemini call budget check
    - Short-TTL in-memory answer cache
    - Targets the is_demo workspace only
    - Conversations and messages are NOT persisted
    """
    client_ip = get_client_ip(request)
    ip_hash = get_daily_ip_hash(client_ip)

    # 1. Check IP-hash daily quota (15 questions/day per IP-hash)
    quota_res = await db.execute(
        text(
            """
            SELECT COUNT(*) AS count
            FROM usage_events
            WHERE ip_hash = :ip_hash
              AND kind = 'demo_question'
              AND created_at >= date_trunc('day', now() at time zone 'utc');
            """
        ),
        {"ip_hash": ip_hash},
    )
    daily_count = quota_res.scalar_one() or 0
    if daily_count >= settings.DEMO_QUESTIONS_PER_IP_DAY:
        raise AppException(
            status_code=429,
            code="quota_exceeded",
            message=f"Daily demo limit of {settings.DEMO_QUESTIONS_PER_IP_DAY} questions reached. Sign up for a free workspace to ask more!",
        )

    # 2. Check global daily Gemini call budget
    budget_res = await db.execute(
        text(
            """
            SELECT COUNT(*) AS count
            FROM usage_events
            WHERE kind IN ('embed_call', 'llm_call')
              AND created_at >= date_trunc('day', now() at time zone 'utc');
            """
        )
    )
    today_budget_used = budget_res.scalar_one() or 0
    if today_budget_used >= settings.GEMINI_DAILY_CALL_BUDGET:
        raise AppException(
            status_code=503,
            code="service_busy",
            message="The public demo is currently busy due to high traffic volume. Please try again later or sign up for your own workspace.",
        )

    # 3. Check short-TTL cache
    cached_val = demo_cache.get(payload.question)
    if cached_val is not None:
        # Record demo question usage
        await db.execute(
            text(
                """
                INSERT INTO usage_events (ip_hash, kind, units)
                VALUES (:ip_hash, 'demo_question', 1);
                """
            ),
            {"ip_hash": ip_hash},
        )
        await db.commit()
        return DemoChatResponse(**cached_val)

    # 4. Locate demo workspace
    ws_res = await db.execute(
        text("SELECT id FROM workspaces WHERE is_demo = true LIMIT 1;")
    )
    demo_ws = ws_res.mappings().first()
    if not demo_ws:
        raise AppException(
            status_code=503,
            code="demo_not_ready",
            message="Demo workspace has not been initialized. Please try again shortly.",
        )
    demo_wid = demo_ws["id"]

    # 5. Execute RAG answer
    history_dicts = [{"role": h.role, "content": h.content} for h in payload.history]
    result = await ask_demo_question(
        db=db,
        workspace_id=demo_wid,
        question=payload.question,
        history=history_dicts,
    )

    # 6. Record usage event in DB
    await db.execute(
        text(
            """
            INSERT INTO usage_events (ip_hash, workspace_id, kind, units)
            VALUES (:ip_hash, :wid, 'demo_question', 1);
            """
        ),
        {"ip_hash": ip_hash, "wid": demo_wid},
    )
    await db.commit()

    # 7. Cache grounded responses
    if result.get("grounded") is True:
        demo_cache.set(payload.question, result)

    return DemoChatResponse(
        answer=result["answer"],
        grounded=result["grounded"],
        citations=[CitationResponse(**c) for c in result.get("citations", [])],
    )
