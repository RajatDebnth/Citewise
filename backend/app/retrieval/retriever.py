from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("app.retrieval.retriever")


async def match_workspace_chunks(
    db: AsyncSession,
    workspace_id: UUID,
    query_vector: list[float],
    k: int | None = None,
    document_ids: list[UUID] | None = None,
) -> list[dict[str, Any]]:
    """Retrieves top-k most similar document chunks in the workspace using pgvector cosine distance.
    
    Always scoped strictly by workspace_id (S4, S5).
    Filters to ready documents only.
    """
    top_k = k if k is not None else settings.TOP_K
    vec_str = f"[{','.join(str(x) for x in query_vector)}]"

    query = text(
        """
        SELECT id, document_id, filename, content, page_start, page_end,
               section_title, similarity
        FROM match_chunks(
            p_workspace_id => :wid,
            p_query => CAST(:query_vec AS vector),
            p_k => :k,
            p_document_ids => :doc_ids
        );
        """
    )
    params: dict[str, Any] = {
        "wid": workspace_id,
        "query_vec": vec_str,
        "k": top_k,
        "doc_ids": document_ids if document_ids else None,
    }

    res = await db.execute(query, params)
    rows = res.mappings().all()

    results: list[dict[str, Any]] = [dict(row) for row in rows]
    logger.debug(
        f"Retrieved {len(results)} chunks for workspace {workspace_id} (top score: {results[0]['similarity'] if results else 'none'})"
    )
    return results

