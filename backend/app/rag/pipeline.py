import time
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.rag.citations import (
    FALLBACK_NOT_FOUND,
    build_citations,
    parse_llm_json,
    strip_html,
)
from app.rag.prompts import (
    ANSWER_JSON_SCHEMA,
    CONDENSE_SYSTEM_PROMPT,
    SYSTEM_PROMPT,
    format_condense_prompt,
    format_user_prompt,
)
from app.repositories.conversations import (
    check_and_record_question_quota,
    check_chat_enabled,
    get_conversation_turns,
    get_or_create_conversation,
    record_unanswered_question,
    save_message,
)
from app.retrieval.retriever import match_workspace_chunks
from app.services.providers.base import EmbeddingProvider, LLMProvider
from app.services.providers.gemini import (
    GeminiEmbeddingProvider,
    GeminiLLMProvider,
)

logger = get_logger("app.rag.pipeline")


async def ask_question(
    db: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
    question: str,
    conversation_id: UUID | None = None,
    document_ids: list[UUID] | None = None,
    embedding_provider: EmbeddingProvider | None = None,
    llm_provider: LLMProvider | None = None,
) -> dict[str, Any]:
    """Orchestrates RAG chat answering per Blueprint Section 6.4:
    
    1. Check killswitch and daily question quota
    2. Lookup/create conversation
    3. Condense question if history exists
    4. Save user turn to messages
    5. Retrieve top-k chunks with match_chunks
    6. Similarity threshold gate (fallback without LLM if score < RETRIEVAL_MIN_SCORE)
    7. Generate JSON answer using LLM
    8. Validate citations against DB metadata, strip HTML
    9. Persist assistant message and update conversation
    """
    embed_provider = embedding_provider or GeminiEmbeddingProvider()
    gen_provider = llm_provider or GeminiLLMProvider()

    # 1. Killswitch & Quota check
    await check_chat_enabled(db)
    await check_and_record_question_quota(db, user_id, workspace_id)

    # 2. Get or create conversation (S6)
    conv = await get_or_create_conversation(
        db, workspace_id, user_id, conversation_id, question
    )
    conv_id = conv["id"]

    # 3. Optional question condensation if conversation history exists
    standalone_query = question
    if settings.CONDENSE_ENABLED:
        past_turns = await get_conversation_turns(
            db, workspace_id, conv_id, limit=4
        )
        if past_turns:
            condense_prompt = format_condense_prompt(past_turns, question)
            try:
                condensed = await gen_provider.generate(
                    CONDENSE_SYSTEM_PROMPT, condense_prompt
                )
                if condensed and len(condensed.strip()) > 3:
                    standalone_query = condensed.strip()
                    logger.debug(
                        f"Condensed question '{question}' -> '{standalone_query}'"
                    )
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    f"Condensation failed, falling back to original question: {e}"
                )
                standalone_query = question

    # 4. Save user message to database
    await save_message(
        db=db,
        conversation_id=conv_id,
        workspace_id=workspace_id,
        role="user",
        content=question,
    )

    # 5. Embed standalone query
    query_vector = await embed_provider.embed_query(standalone_query)

    # 6. Retrieve relevant document chunks
    retrieved_chunks = await match_workspace_chunks(
        db=db,
        workspace_id=workspace_id,
        query_vector=query_vector,
        k=settings.TOP_K,
        document_ids=document_ids,
    )

    # 7. Similarity threshold gate: fallback if no chunks or score < RETRIEVAL_MIN_SCORE
    top_score = (
        float(retrieved_chunks[0]["similarity"]) if retrieved_chunks else None
    )
    if not retrieved_chunks or (top_score is not None and top_score < settings.RETRIEVAL_MIN_SCORE):
        logger.info(
            f"Retrieval gate triggered: top_score={top_score} < min_score={settings.RETRIEVAL_MIN_SCORE}. Returning fallback without LLM call."
        )
        asst_msg = await save_message(
            db=db,
            conversation_id=conv_id,
            workspace_id=workspace_id,
            role="assistant",
            content=FALLBACK_NOT_FOUND,
            citations=[],
            grounded=False,
            model=gen_provider.model_name,
        )
        await record_unanswered_question(
            db=db,
            workspace_id=workspace_id,
            message_id=asst_msg["id"],
            question=question,
            top_score=top_score,
        )
        await db.commit()

        return {
            "conversation_id": conv_id,
            "message_id": asst_msg["id"],
            "answer": FALLBACK_NOT_FOUND,
            "grounded": False,
            "citations": [],
        }

    # 8. Format sources prompt and call LLM
    user_prompt = format_user_prompt(standalone_query, retrieved_chunks)

    t0 = time.perf_counter()
    raw_response = await gen_provider.generate(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_schema=ANSWER_JSON_SCHEMA,
    )
    latency_ms = int((time.perf_counter() - t0) * 1000)

    # Record LLM call usage
    await db.execute(
        text(
            """
            INSERT INTO usage_events (user_id, workspace_id, kind, units)
            VALUES (:uid, :wid, 'llm_call', 1);
            """
        ),
        {"uid": user_id, "wid": workspace_id},
    )

    parsed = parse_llm_json(raw_response)
    if parsed is None:
        # Retry once on parse failure per Blueprint 6.4
        logger.warning("Retrying LLM generation due to JSON parse failure...")
        raw_response = await gen_provider.generate(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            response_schema=ANSWER_JSON_SCHEMA,
        )
        parsed = parse_llm_json(raw_response)

    # 9. Determine answer, grounded status, and citations
    if parsed and parsed.get("answerable") is True:
        raw_answer = strip_html(parsed.get("answer", ""))
        used_indices = parsed.get("used_sources", [])
        citations, is_grounded = build_citations(used_indices, retrieved_chunks)

        if is_grounded:
            answer = raw_answer
            grounded = True
        else:
            # Answerable was true, but used_sources was empty or invalid
            answer = FALLBACK_NOT_FOUND
            grounded = False
            citations = []
    else:
        answer = FALLBACK_NOT_FOUND
        grounded = False
        citations = []

    # 10. Persist assistant message
    asst_msg = await save_message(
        db=db,
        conversation_id=conv_id,
        workspace_id=workspace_id,
        role="assistant",
        content=answer,
        citations=citations,
        grounded=grounded,
        model=gen_provider.model_name,
        latency_ms=latency_ms,
    )

    if not grounded:
        await record_unanswered_question(
            db=db,
            workspace_id=workspace_id,
            message_id=asst_msg["id"],
            question=question,
            top_score=top_score,
        )

    await db.commit()

    return {
        "conversation_id": conv_id,
        "message_id": asst_msg["id"],
        "answer": answer,
        "grounded": grounded,
        "citations": citations,
    }


async def ask_demo_question(
    db: AsyncSession,
    workspace_id: UUID,
    question: str,
    history: list[dict[str, str]] | None = None,
    embedding_provider: EmbeddingProvider | None = None,
    llm_provider: LLMProvider | None = None,
) -> dict[str, Any]:
    """Answers a question against the read-only demo workspace without persisting conversations (Blueprint 5.4)."""
    embed_provider = embedding_provider or GeminiEmbeddingProvider()
    gen_provider = llm_provider or GeminiLLMProvider()

    # 1. Condensation if history exists
    standalone_query = question
    if settings.CONDENSE_ENABLED and history:
        recent_turns = [
            {"role": t.get("role", "user"), "content": t.get("content", "")}
            for t in history[-4:]
            if t.get("content")
        ]
        if recent_turns:
            condense_prompt = format_condense_prompt(recent_turns, question)
            try:
                condensed = await gen_provider.generate(
                    CONDENSE_SYSTEM_PROMPT, condense_prompt
                )
                if condensed and len(condensed.strip()) > 3:
                    standalone_query = condensed.strip()
            except Exception as e:  # noqa: BLE001
                logger.warning(f"Demo question condensation failed, using original: {e}")
                standalone_query = question

    # 2. Embed query
    query_vector = await embed_provider.embed_query(standalone_query)

    # 3. Retrieve chunks
    retrieved_chunks = await match_workspace_chunks(
        db=db,
        workspace_id=workspace_id,
        query_vector=query_vector,
        k=settings.TOP_K,
    )

    # 4. Threshold gate
    top_score = (
        float(retrieved_chunks[0]["similarity"]) if retrieved_chunks else None
    )
    if not retrieved_chunks or (top_score is not None and top_score < settings.RETRIEVAL_MIN_SCORE):
        return {
            "answer": FALLBACK_NOT_FOUND,
            "grounded": False,
            "citations": [],
        }

    # 5. Format sources and call LLM
    user_prompt = format_user_prompt(standalone_query, retrieved_chunks)
    raw_response = await gen_provider.generate(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_schema=ANSWER_JSON_SCHEMA,
    )

    parsed = parse_llm_json(raw_response)
    if parsed is None:
        raw_response = await gen_provider.generate(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            response_schema=ANSWER_JSON_SCHEMA,
        )
        parsed = parse_llm_json(raw_response)

    if parsed and parsed.get("answerable") is True:
        raw_answer = strip_html(parsed.get("answer", ""))
        used_indices = parsed.get("used_sources", [])
        citations, is_grounded = build_citations(used_indices, retrieved_chunks)
        if is_grounded:
            return {
                "answer": raw_answer,
                "grounded": True,
                "citations": citations,
            }

    return {
        "answer": FALLBACK_NOT_FOUND,
        "grounded": False,
        "citations": [],
    }

