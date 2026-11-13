import io
from dataclasses import dataclass

import docx
import pymupdf
from app.core.errors import AppException
from app.services.ingestion.cleaner import clean_text, drop_repeated_headers_footers


@dataclass
class ExtractedSection:
    text: str
    page_start: int
    page_end: int
    section_title: str | None = None


@dataclass
class ExtractedDocument:
    sections: list[ExtractedSection]
    page_count: int


def _extract_pdf_heading_heuristic(page: pymupdf.Page) -> str | None:
    """Finds candidate section heading on a PDF page using largest-font span heuristic."""
    try:
        page_dict = page.get_text("dict")
        max_size = 0.0
        best_heading: str | None = None

        for block in page_dict.get("blocks", []):
            if block.get("type") == 0:  # text block
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text = span.get("text", "").strip()
                        size = span.get("size", 0.0)
                        # Headings are typically shorter than 120 chars and larger than normal text (>12pt)
                        if text and len(text) < 120 and size > max_size and size >= 12.0:
                            max_size = size
                            best_heading = text
        return best_heading
    except Exception:  # noqa: BLE001
        return None


def extract_pdf(file_bytes: bytes) -> ExtractedDocument:
    """Extracts text per-page from PDF, applying font heuristic and header/footer removal."""
    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception as e:
        raise AppException(
            status_code=400,
            code="corrupt_pdf",
            message=f"Failed to parse PDF document: {e}",
        ) from e

    page_count = len(doc)
    if page_count == 0:
        return ExtractedDocument(sections=[], page_count=0)

    raw_page_texts: list[str] = []
    page_headings: list[str | None] = []

    for page in doc:
        raw_text = page.get_text("text") or ""
        raw_page_texts.append(raw_text)
        page_headings.append(_extract_pdf_heading_heuristic(page))

    # Drop repeated headers/footers appearing on >60% of pages
    cleaned_page_texts = drop_repeated_headers_footers(raw_page_texts, threshold=0.6)

    sections: list[ExtractedSection] = []
    last_heading: str | None = None

    for i, page_text in enumerate(cleaned_page_texts, start=1):
        cleaned = clean_text(page_text)
        heading = page_headings[i - 1]
        if heading:
            last_heading = heading

        if cleaned:
            sections.append(
                ExtractedSection(
                    text=cleaned,
                    page_start=i,
                    page_end=i,
                    section_title=heading or last_heading,
                )
            )

    return ExtractedDocument(sections=sections, page_count=page_count)


def extract_docx(file_bytes: bytes) -> ExtractedDocument:
    """Extracts text from DOCX, tracking Heading 1-3 styles as section titles."""
    try:
        doc = docx.Document(io.BytesIO(file_bytes))
    except Exception as e:
        raise AppException(
            status_code=400,
            code="corrupt_docx",
            message=f"Failed to parse DOCX document: {e}",
        ) from e

    sections: list[ExtractedSection] = []
    current_title: str | None = None
    current_paragraphs: list[str] = []

    def flush_section():
        nonlocal current_paragraphs
        if current_paragraphs:
            combined = "\n\n".join(current_paragraphs)
            cleaned = clean_text(combined)
            if cleaned:
                sections.append(
                    ExtractedSection(
                        text=cleaned,
                        page_start=1,
                        page_end=1,
                        section_title=current_title,
                    )
                )
            current_paragraphs = []

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue

        style_name = para.style.name if para.style else ""
        if style_name and style_name.lower().startswith("heading"):
            flush_section()
            current_title = text
        else:
            current_paragraphs.append(text)

    # Also capture table contents if present
    for table in doc.tables:
        table_rows: list[str] = []
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                table_rows.append(row_text)
        if table_rows:
            current_paragraphs.append("\n".join(table_rows))

    flush_section()

    return ExtractedDocument(sections=sections, page_count=1)


def extract_txt(file_bytes: bytes) -> ExtractedDocument:
    """Extracts text from plain text file."""
    try:
        raw_text = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        # Fallback to UTF-8 with replacement
        raw_text = file_bytes.decode("utf-8", errors="replace")

    cleaned = clean_text(raw_text)
    sections: list[ExtractedSection] = []
    if cleaned:
        sections.append(
            ExtractedSection(
                text=cleaned,
                page_start=1,
                page_end=1,
                section_title=None,
            )
        )
    return ExtractedDocument(sections=sections, page_count=1)


def extract_document(
    file_bytes: bytes, mime_type: str, filename: str
) -> ExtractedDocument:
    """Routes extraction based on MIME type and filename extension."""
    lower_name = filename.lower()
    if mime_type == "application/pdf" or lower_name.endswith(".pdf"):
        return extract_pdf(file_bytes)
    elif (
        mime_type
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        or lower_name.endswith(".docx")
    ):
        return extract_docx(file_bytes)
    elif mime_type == "text/plain" or lower_name.endswith(".txt"):
        return extract_txt(file_bytes)
    else:
        raise AppException(
            status_code=400,
            code="unsupported_mime_type",
            message=f"Unsupported document format: {mime_type}",
        )
