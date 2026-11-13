import json
import re
from typing import Any

from app.core.logging import get_logger

logger = get_logger("app.rag.citations")

FALLBACK_NOT_FOUND = "I couldn't find this in the uploaded documents."


def strip_html(text: str) -> str:
    """Strips raw HTML tags and dangerous blocks (<script>, <style>) to prevent XSS / HTML injection (Blueprint 6.4, Security Rules)."""
    if not text:
        return ""
    # 1. Strip script and style blocks along with their inner contents
    text = re.sub(r"(?is)<script[^>]*>.*?</script>", "", text)
    text = re.sub(r"(?is)<style[^>]*>.*?</style>", "", text)
    # 2. Remove any remaining HTML tags while preserving markdown
    cleaned = re.sub(r"<[^>]+>", "", text)
    return cleaned.strip()


def parse_llm_json(raw_text: str) -> dict[str, Any] | None:
    """Parses JSON output from LLM, stripping markdown fences if present."""
    if not raw_text:
        return None

    cleaned = raw_text.strip()
    # Handle ```json ... ``` code fence
    if cleaned.startswith("```"):
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
        if match:
            cleaned = match.group(1).strip()

    try:
        data = json.loads(cleaned)
        if (
            isinstance(data, dict)
            and "answerable" in data
            and "answer" in data
            and "used_sources" in data
        ):
            return {
                "answerable": bool(data["answerable"]),
                "answer": str(data["answer"]),
                "used_sources": [
                    int(x) for x in data["used_sources"] if isinstance(x, (int, str)) and str(x).isdigit()
                ],
            }
    except (json.JSONDecodeError, ValueError, TypeError) as e:
        logger.warning(f"Failed to parse LLM JSON: {e}. Raw content: {raw_text[:200]}")
    return None


def build_citations(
    used_sources: list[int],
    retrieved_chunks: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], bool]:
    """Validates used source indices and builds verified citation objects from DB metadata.
    
    Returns (citations, is_grounded).
    If used_sources is empty or invalid, returns ([], False).
    """
    total_sources = len(retrieved_chunks)
    valid_indices: list[int] = []

    for idx in used_sources:
        if 1 <= idx <= total_sources and idx not in valid_indices:
            valid_indices.append(idx)

    if not valid_indices:
        return [], False

    citations: list[dict[str, Any]] = []
    for n in sorted(valid_indices):
        chunk = retrieved_chunks[n - 1]
        snippet = chunk.get("content", "")[:300].strip()

        citations.append(
            {
                "n": n,
                "chunk_id": str(chunk["id"]),
                "document_id": str(chunk["document_id"]),
                "filename": chunk.get("filename", "unknown"),
                "page_start": chunk.get("page_start"),
                "page_end": chunk.get("page_end"),
                "section_title": chunk.get("section_title"),
                "score": round(float(chunk.get("similarity", 0.0)), 4),
                "snippet": snippet,
            }
        )

    return citations, True
