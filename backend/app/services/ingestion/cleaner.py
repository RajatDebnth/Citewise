import re
import unicodedata
from collections import Counter


def clean_text(text: str) -> str:
    """Cleans raw extracted text:
    
    - Normalizes Unicode to NFC
    - Strips null bytes and non-printable control characters
    - De-hyphenates line breaks (e.g. 'auto-\\nmation' -> 'automation')
    - Collapses excessive horizontal whitespace
    - Normalizes paragraph boundaries (max 2 consecutive newlines)
    """
    if not text:
        return ""

    # 1. Unicode NFC normalization
    text = unicodedata.normalize("NFC", text)

    # 2. Strip null bytes and control chars (preserve \n and \t)
    text = text.replace("\x00", "")
    text = "".join(
        ch for ch in text if ch in ("\n", "\t") or unicodedata.category(ch)[0] != "C"
    )

    # 3. De-hyphenate line breaks (e.g., "repre-\nsent" -> "represent")
    text = re.sub(r"(\b[a-zA-Z]+)-\n\s*([a-zA-Z]+\b)", r"\1\2", text)

    # 4. Collapse excessive horizontal whitespace while preserving line structure
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    cleaned_lines: list[str] = []
    consecutive_empty = 0

    for line in lines:
        if not line:
            consecutive_empty += 1
            if consecutive_empty <= 1:
                cleaned_lines.append("")
        else:
            consecutive_empty = 0
            cleaned_lines.append(line)

    result = "\n".join(cleaned_lines).strip()
    return result


def drop_repeated_headers_footers(
    page_texts: list[str], threshold: float = 0.6
) -> list[str]:
    """Drops lines that occur on more than 60% of pages (typical headers/footers/page numbers).
    
    Only applies if there are at least 3 pages.
    """
    num_pages = len(page_texts)
    if num_pages < 3:
        return page_texts

    # Collect unique non-empty lines per page
    page_line_sets = [
        {line.strip() for line in page.split("\n") if line.strip()}
        for page in page_texts
    ]

    line_counts: Counter[str] = Counter()
    for l_set in page_line_sets:
        for line in l_set:
            line_counts[line] += 1

    # Identify lines that appear on > 60% of pages and look like headers/footers (< 150 chars)
    min_page_count = int(num_pages * threshold)
    repeated_lines = {
        line
        for line, count in line_counts.items()
        if count > min_page_count and len(line) < 150
    }

    if not repeated_lines:
        return page_texts

    # Filter out repeated lines from each page
    filtered_pages: list[str] = []
    for page in page_texts:
        lines = [
            line for line in page.split("\n") if line.strip() not in repeated_lines
        ]
        filtered_pages.append("\n".join(lines))

    return filtered_pages
