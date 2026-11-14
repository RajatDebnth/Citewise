import hashlib
import io
import os
import re
import zipfile

import fitz  # PyMuPDF
from app.core.config import settings
from app.core.errors import AppException
from fastapi import UploadFile

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_DOCX_RATIO = 100.0


def sanitize_filename(filename: str | None) -> str:
    """Sanitizes client-supplied filename (S13).
    
    Strips path traversal, control characters, and truncates to 200 chars while preserving extension.
    """
    if not filename:
        return "unnamed_document.txt"

    # Normalize backslashes to forward slashes then strip directory components
    clean_name = os.path.basename(filename.replace("\\", "/"))
    # Remove control characters and problematic punctuation
    clean_name = re.sub(r"[\x00-\x1f\x7f\\/:\*\?\"<>\|]", "_", clean_name)
    clean_name = re.sub(r"_+", "_", clean_name).strip()
    if not clean_name:
        clean_name = "document"

    name_part, ext = os.path.splitext(clean_name)
    ext = ext.lower()

    # Truncate while preserving extension
    max_name_len = 200 - len(ext)
    if len(name_part) > max_name_len:
        name_part = name_part[:max_name_len].rstrip("._- ")

    return f"{name_part}{ext}"


async def validate_and_stream_upload(
    file: UploadFile,
    max_bytes: int | None = None,
) -> tuple[bytes, str, str, str, int | None]:
    """Streams and validates an uploaded file according to security rules S11-S14.
    
    Enforces:
    - Streaming byte limit (max 10 MB, aborted mid-stream).
    - Extension allowlist (.pdf, .docx, .txt).
    - Magic bytes verification.
    - PDF: encrypted rejection, page count limit (max 150).
    - DOCX: zip bomb guard (uncompressed size <= 50 MB, ratio <= 100:1).
    - TXT: UTF-8 validation.
    
    Returns:
    (content_bytes, sanitized_filename, sha256_hash, mime_type, page_count)
    """
    if max_bytes is None:
        max_bytes = settings.MAX_FILE_MB * 1024 * 1024

    sanitized_name = sanitize_filename(file.filename)
    _, ext = os.path.splitext(sanitized_name)
    ext = ext.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise AppException(
            status_code=400,
            code="invalid_file_type",
            message=f"Unsupported file format '{ext}'. Allowed extensions: .pdf, .docx, .txt",
        )

    # 1. Stream file while calculating SHA-256 and enforcing byte limit
    sha256 = hashlib.sha256()
    buffer = bytearray()
    total_bytes = 0
    chunk_size = 64 * 1024  # 64 KB

    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total_bytes += len(chunk)
        if total_bytes > max_bytes:
            raise AppException(
                status_code=413,
                code="file_too_large",
                message=f"File exceeds maximum allowed size of {settings.MAX_FILE_MB} MB",
            )
        sha256.update(chunk)
        buffer.extend(chunk)

    if total_bytes == 0:
        raise AppException(
            status_code=400,
            code="empty_file",
            message="Uploaded file is empty",
        )

    content_bytes = bytes(buffer)
    sha256_hex = sha256.hexdigest()
    page_count: int | None = None

    # 2. Magic bytes and structure validation
    if ext == ".pdf":
        mime_type = "application/pdf"
        if not content_bytes.startswith(b"%PDF-"):
            raise AppException(
                status_code=400,
                code="invalid_document",
                message="File content is not a valid PDF (invalid magic bytes)",
            )
        try:
            pdf_doc = fitz.open(stream=content_bytes, filetype="pdf")
            if pdf_doc.is_encrypted:
                raise AppException(
                    status_code=400,
                    code="encrypted_pdf_rejected",
                    message="Encrypted or password-protected PDFs are not supported.",
                )
            page_count = pdf_doc.page_count
            if page_count > settings.MAX_PAGES:
                raise AppException(
                    status_code=400,
                    code="page_limit_exceeded",
                    message=f"PDF page count ({page_count}) exceeds the maximum limit of {settings.MAX_PAGES} pages.",
                )
            if page_count == 0:
                raise AppException(
                    status_code=400,
                    code="empty_document",
                    message="PDF contains no pages",
                )
            pdf_doc.close()
        except AppException:
            raise
        except (fitz.FileDataError, fitz.EmptyFileError, RuntimeError, ValueError) as e:
            raise AppException(
                status_code=400,
                code="corrupt_pdf",
                message=f"Failed to parse PDF document: {e}",
            ) from e

    elif ext == ".docx":
        mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        if not content_bytes.startswith(b"PK\x03\x04"):
            raise AppException(
                status_code=400,
                code="invalid_document",
                message="File content is not a valid Word document (invalid magic bytes)",
            )
        try:
            with zipfile.ZipFile(io.BytesIO(content_bytes)) as zf:
                namelist = set(zf.namelist())
                if "word/document.xml" not in namelist:
                    raise AppException(
                        status_code=400,
                        code="invalid_document",
                        message="Missing word/document.xml in DOCX archive",
                    )

                # Zip-bomb guard (S12)
                total_uncompressed = 0
                total_compressed = 0
                for info in zf.infolist():
                    total_uncompressed += info.file_size
                    total_compressed += info.compress_size

                if total_uncompressed > MAX_DOCX_UNCOMPRESSED_BYTES:
                    raise AppException(
                        status_code=400,
                        code="zip_bomb_detected",
                        message="Uncompressed Word document exceeds 50 MB security limit",
                    )

                if total_compressed > 0:
                    ratio = total_uncompressed / total_compressed
                    if ratio > MAX_DOCX_RATIO:
                        raise AppException(
                            status_code=400,
                            code="zip_bomb_detected",
                            message="Word document compression ratio exceeds security limits",
                        )
            page_count = 1
        except AppException:
            raise
        except (zipfile.BadZipFile, zipfile.LargeZipFile, ValueError, KeyError, OSError) as e:
            raise AppException(
                status_code=400,
                code="corrupt_docx",
                message=f"Failed to inspect Word document: {e}",
            ) from e

    elif ext == ".txt":
        mime_type = "text/plain"
        try:
            content_bytes.decode("utf-8")
        except UnicodeDecodeError as e:
            raise AppException(
                status_code=400,
                code="invalid_encoding",
                message=f"Text file must be valid UTF-8: {e}",
            )
        page_count = 1
    else:
        mime_type = "application/octet-stream"

    return content_bytes, sanitized_name, sha256_hex, mime_type, page_count
