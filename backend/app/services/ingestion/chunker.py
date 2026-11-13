import hashlib
import re
from dataclasses import dataclass
from typing import Any

import tiktoken
from app.core.config import settings
from app.services.ingestion.extractors import ExtractedDocument

# Initialize tiktoken cl100k_base encoder
_encoder = tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    """Calculates approximate token count using tiktoken cl100k_base."""
    if not text:
        return 0
    return len(_encoder.encode(text, disallowed_special=()))


@dataclass
class DocumentChunk:
    chunk_index: int
    content: str
    embed_input: str
    token_count: int
    page_start: int | None
    page_end: int | None
    section_title: str | None
    content_sha256: str


def _split_into_atomic_units(
    text: str, page_start: int, page_end: int, section_title: str | None
) -> list[tuple[str, int, int, str | None]]:
    """Splits text recursively: paragraphs -> sentences -> words if necessary."""
    units: list[tuple[str, int, int, str | None]] = []

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        if text.strip():
            paragraphs = [text.strip()]
        else:
            return []

    for para in paragraphs:
        para_tokens = count_tokens(para)
        if para_tokens <= settings.CHUNK_TOKENS:
            units.append((para, page_start, page_end, section_title))
        else:
            # Paragraph exceeds target chunk size; split into sentences
            sentences = [
                s.strip()
                for s in re.split(r"(?<=[.!?])\s+|\n+", para)
                if s.strip()
            ]
            for sentence in sentences:
                sent_tokens = count_tokens(sentence)
                if sent_tokens <= settings.CHUNK_TOKENS:
                    units.append((sentence, page_start, page_end, section_title))
                else:
                    # Sentence is very long; split into words
                    words = sentence.split()
                    word_buf: list[str] = []
                    for word in words:
                        word_buf.append(word)
                        if count_tokens(" ".join(word_buf)) >= settings.CHUNK_TOKENS:
                            units.append((" ".join(word_buf), page_start, page_end, section_title))
                            word_buf = []
                    if word_buf:
                        units.append((" ".join(word_buf), page_start, page_end, section_title))

    return units


def chunk_document(
    extracted_doc: ExtractedDocument, filename: str
) -> list[DocumentChunk]:
    """Chunks an extracted document into overlapping text chunks per Section 6.2.
    
    Target ≈ 800 tokens, overlap ≈ 120 tokens, max 1000 tokens.
    Drops chunks under 30 tokens (unless it is the only chunk).
    Caps at settings.MAX_CHUNKS_PER_DOC (400).
    Prefixes embedding input with '{filename} · {section_title}\\n'.
    """
    # 1. Collect all atomic text units with page and section metadata
    all_units: list[tuple[str, int, int, str | None]] = []
    for section in extracted_doc.sections:
        units = _split_into_atomic_units(
            section.text, section.page_start, section.page_end, section.section_title
        )
        all_units.extend(units)

    if not all_units:
        return []

    target_tokens = settings.CHUNK_TOKENS
    overlap_tokens = settings.CHUNK_OVERLAP

    raw_chunks: list[dict[str, Any]] = []
    current_units: list[tuple[str, int, int, str | None]] = []
    current_tokens = 0

    for unit in all_units:
        text, _p_start, _p_end, _title = unit
        u_tokens = count_tokens(text)

        if current_tokens + u_tokens > target_tokens and current_units:
            # Emit current chunk
            chunk_text = "\n\n".join(u[0] for u in current_units).strip()
            pages_start = [u[1] for u in current_units]
            pages_end = [u[2] for u in current_units]
            titles = [u[3] for u in current_units if u[3]]
            raw_chunks.append(
                {
                    "content": chunk_text,
                    "token_count": count_tokens(chunk_text),
                    "page_start": min(pages_start) if pages_start else None,
                    "page_end": max(pages_end) if pages_end else None,
                    "section_title": titles[0] if titles else None,
                }
            )

            # Build overlap window for next chunk
            overlap_units: list[tuple[str, int, int, str | None]] = []
            overlap_tok_count = 0
            for prev_u in reversed(current_units):
                prev_toks = count_tokens(prev_u[0])
                if overlap_tok_count + prev_toks <= overlap_tokens:
                    overlap_units.insert(0, prev_u)
                    overlap_tok_count += prev_toks
                else:
                    break

            current_units = list(overlap_units)
            current_tokens = overlap_tok_count

        current_units.append(unit)
        current_tokens += u_tokens

    # Emit final remaining chunk
    if current_units:
        chunk_text = "\n\n".join(u[0] for u in current_units).strip()
        pages_start = [u[1] for u in current_units]
        pages_end = [u[2] for u in current_units]
        titles = [u[3] for u in current_units if u[3]]
        raw_chunks.append(
            {
                "content": chunk_text,
                "token_count": count_tokens(chunk_text),
                "page_start": min(pages_start) if pages_start else None,
                "page_end": max(pages_end) if pages_end else None,
                "section_title": titles[0] if titles else None,
            }
        )

    # Filter chunks < 30 tokens (unless it is the only content)
    filtered = [c for c in raw_chunks if c["token_count"] >= 30]
    if not filtered and raw_chunks:
        filtered = [max(raw_chunks, key=lambda c: c["token_count"])]

    # Cap at MAX_CHUNKS_PER_DOC
    capped = filtered[: settings.MAX_CHUNKS_PER_DOC]

    final_chunks: list[DocumentChunk] = []
    for idx, c in enumerate(capped):
        content = c["content"]
        sec_title = c["section_title"]
        # Prefix embedding input with '{filename} · {section_title}\n'
        if sec_title:
            embed_input = f"{filename} · {sec_title}\n{content}"
        else:
            embed_input = f"{filename}\n{content}"

        content_sha256 = hashlib.sha256(content.encode("utf-8")).hexdigest()

        final_chunks.append(
            DocumentChunk(
                chunk_index=idx,
                content=content,
                embed_input=embed_input,
                token_count=c["token_count"],
                page_start=c["page_start"],
                page_end=c["page_end"],
                section_title=sec_title,
                content_sha256=content_sha256,
            )
        )

    return final_chunks
