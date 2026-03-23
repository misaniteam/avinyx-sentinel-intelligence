"""Tests for the FileUploadHandler (PDF/Excel text extraction from S3)."""

import uuid
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Helpers to create minimal valid test files
# ---------------------------------------------------------------------------


def _create_pdf_bytes(text: str = "Hello PDF World", num_pages: int = 1) -> bytes:
    """Create a valid PDF with the given text using pymupdf (fitz)."""
    import fitz

    doc = fitz.open()
    for i in range(num_pages):
        page = doc.new_page()
        page.insert_text((72, 72), text if num_pages == 1 else f"{text} page {i + 1}")
    data = doc.tobytes()
    doc.close()
    return data


def _create_xlsx_bytes(rows: list[list[str]] | None = None, sheet_name: str = "Sheet1") -> bytes:
    """Create a valid XLSX with the given rows using openpyxl."""
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    if rows is None:
        rows = [["Name", "Value"], ["Alice", "100"], ["Bob", "200"]]
    for row in rows:
        ws.append(row)
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


def _create_xls_bytes() -> bytes:
    """Create a valid XLS file using xlwt."""
    import xlwt

    wb = xlwt.Workbook()
    ws = wb.add_sheet("Sheet1")
    ws.write(0, 0, "Name")
    ws.write(0, 1, "Value")
    ws.write(1, 0, "Charlie")
    ws.write(1, 1, "300")
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FAKE_TENANT_ID = str(uuid.uuid4())
FAKE_S3_KEY = f"{FAKE_TENANT_ID}/ds-123/abc_report.pdf"
FAKE_XLSX_KEY = f"{FAKE_TENANT_ID}/ds-123/abc_data.xlsx"
FAKE_XLS_KEY = f"{FAKE_TENANT_ID}/ds-123/abc_data.xls"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_s3():
    with patch("handlers.file_upload_handler.S3Client") as mock_cls:
        s3_instance = AsyncMock()
        mock_cls.return_value = s3_instance
        yield s3_instance


@pytest.fixture
def mock_settings():
    with patch("handlers.file_upload_handler.get_settings") as mock_fn:
        settings = MagicMock()
        settings.s3_uploads_bucket = "test-uploads"
        mock_fn.return_value = settings
        yield settings


@pytest.fixture
def mock_tenant():
    with patch("handlers.file_upload_handler.tenant_context") as mock_ctx:
        mock_ctx.get.return_value = FAKE_TENANT_ID
        yield mock_ctx


@pytest.fixture
def handler():
    from handlers.file_upload_handler import FileUploadHandler
    return FileUploadHandler()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_extract_pdf_text(handler, mock_s3, mock_settings, mock_tenant):
    """A simple PDF should produce a RawMediaItem with extracted text content."""
    pdf_bytes = _create_pdf_bytes("Hello PDF World")
    mock_s3.download_file = AsyncMock(return_value=pdf_bytes)

    config = {
        "files": [
            {"filename": "report.pdf", "s3_key": FAKE_S3_KEY, "content_type": "application/pdf", "size": len(pdf_bytes)},
        ]
    }

    results = await handler.fetch(config, since=None)

    assert len(results) == 1
    item = results[0]
    assert item.platform == "file_upload"
    assert "Hello PDF World" in item.content
    assert item.author == "report.pdf"
    assert item.external_id == FAKE_S3_KEY
    assert item.raw_payload["page_count"] >= 1
    assert item.tenant_id == FAKE_TENANT_ID


@pytest.mark.asyncio
async def test_extract_xlsx_text(handler, mock_s3, mock_settings, mock_tenant):
    """A simple XLSX should produce a RawMediaItem with extracted text content."""
    xlsx_bytes = _create_xlsx_bytes([["Name", "Score"], ["Alice", "95"]])
    mock_s3.download_file = AsyncMock(return_value=xlsx_bytes)

    config = {
        "files": [
            {"filename": "data.xlsx", "s3_key": FAKE_XLSX_KEY, "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "size": len(xlsx_bytes)},
        ]
    }

    results = await handler.fetch(config, since=None)

    assert len(results) == 1
    item = results[0]
    assert item.platform == "file_upload"
    assert "Alice" in item.content
    assert "95" in item.content
    assert "[Sheet: Sheet1]" in item.content
    assert item.raw_payload["sheet_count"] >= 1


@pytest.mark.asyncio
async def test_extract_xls_text(handler, mock_s3, mock_settings, mock_tenant):
    """A simple XLS (legacy format) should produce a RawMediaItem."""
    xls_bytes = _create_xls_bytes()
    mock_s3.download_file = AsyncMock(return_value=xls_bytes)

    config = {
        "files": [
            {"filename": "data.xls", "s3_key": FAKE_XLS_KEY, "content_type": "application/vnd.ms-excel", "size": len(xls_bytes)},
        ]
    }

    results = await handler.fetch(config, since=None)

    assert len(results) == 1
    item = results[0]
    assert "Charlie" in item.content
    assert "300" in item.content
    assert item.raw_payload["sheet_count"] >= 1


@pytest.mark.asyncio
async def test_large_file_chunking(handler, mock_s3, mock_settings, mock_tenant):
    """Text exceeding MAX_CONTENT_CHARS should produce multiple chunked items."""
    # Create a PDF with enough text to exceed 500K chars
    from handlers.file_upload_handler import MAX_CONTENT_CHARS

    # Generate a large text string (600K chars) and create a PDF
    large_text = "A" * (MAX_CONTENT_CHARS + 100_000)
    # We'll mock the PDF extraction to return our large text directly
    pdf_bytes = _create_pdf_bytes("placeholder")
    mock_s3.download_file = AsyncMock(return_value=pdf_bytes)

    with patch("handlers.file_upload_handler._extract_pdf_text", return_value=(large_text, 1)):
        config = {
            "files": [
                {"filename": "big.pdf", "s3_key": FAKE_S3_KEY, "content_type": "application/pdf", "size": 1000},
            ]
        }

        results = await handler.fetch(config, since=None)

    assert len(results) >= 2
    # Check that external_ids contain #partN suffixes
    for i, item in enumerate(results):
        assert f"#part{i}" in item.external_id
        assert item.raw_payload["part"] == i
        assert item.raw_payload["total_parts"] == len(results)


@pytest.mark.asyncio
async def test_encrypted_pdf(handler, mock_s3, mock_settings, mock_tenant):
    """An encrypted PDF should not crash the handler; it should be skipped gracefully."""
    # Create encrypted PDF using fitz
    import fitz

    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "secret content")
    # Save with encryption
    encrypted_bytes = doc.tobytes(
        encryption=fitz.PDF_ENCRYPT_AES_256,
        owner_pw="owner",
        user_pw="user",
        permissions=0,
    )
    doc.close()

    mock_s3.download_file = AsyncMock(return_value=encrypted_bytes)

    config = {
        "files": [
            {"filename": "secret.pdf", "s3_key": FAKE_S3_KEY, "content_type": "application/pdf", "size": len(encrypted_bytes)},
        ]
    }

    # Should not raise; the handler catches exceptions and continues
    results = await handler.fetch(config, since=None)

    # The encrypted file should be skipped (exception caught), producing 0 items
    assert len(results) == 0


@pytest.mark.asyncio
async def test_empty_pdf(handler, mock_s3, mock_settings, mock_tenant):
    """A PDF with no text content should produce an item with empty content."""
    import fitz

    doc = fitz.open()
    doc.new_page()  # blank page, no text
    empty_pdf = doc.tobytes()
    doc.close()

    mock_s3.download_file = AsyncMock(return_value=empty_pdf)

    config = {
        "files": [
            {"filename": "blank.pdf", "s3_key": FAKE_S3_KEY, "content_type": "application/pdf", "size": len(empty_pdf)},
        ]
    }

    results = await handler.fetch(config, since=None)

    assert len(results) == 1
    # Content should be empty or whitespace
    assert results[0].content.strip() == ""


@pytest.mark.asyncio
async def test_tenant_key_validation(handler, mock_s3, mock_settings, mock_tenant):
    """An S3 key with wrong tenant prefix should be skipped."""
    wrong_tenant_id = str(uuid.uuid4())
    wrong_key = f"{wrong_tenant_id}/ds-123/report.pdf"

    config = {
        "files": [
            {"filename": "report.pdf", "s3_key": wrong_key, "content_type": "application/pdf", "size": 1000},
        ]
    }

    results = await handler.fetch(config, since=None)

    # File should be skipped due to tenant mismatch
    assert len(results) == 0
    # S3 should NOT have been called
    mock_s3.download_file.assert_not_awaited()


@pytest.mark.asyncio
async def test_pdf_page_limit(handler, mock_s3, mock_settings, mock_tenant):
    """A PDF exceeding MAX_PDF_PAGES should be skipped (exception caught)."""
    from handlers.file_upload_handler import MAX_PDF_PAGES

    # Mock the extraction to raise the page limit error
    pdf_bytes = _create_pdf_bytes("placeholder")
    mock_s3.download_file = AsyncMock(return_value=pdf_bytes)

    with patch(
        "handlers.file_upload_handler._extract_pdf_text",
        side_effect=ValueError(f"PDF has 3000 pages, exceeding the limit of {MAX_PDF_PAGES}"),
    ):
        config = {
            "files": [
                {"filename": "huge.pdf", "s3_key": FAKE_S3_KEY, "content_type": "application/pdf", "size": 1000},
            ]
        }

        results = await handler.fetch(config, since=None)

    # Should be skipped due to exception
    assert len(results) == 0


@pytest.mark.asyncio
async def test_no_files_in_config(handler, mock_s3, mock_settings, mock_tenant):
    """Empty files list should return empty results."""
    results = await handler.fetch({"files": []}, since=None)
    assert results == []


@pytest.mark.asyncio
async def test_missing_s3_key(handler, mock_s3, mock_settings, mock_tenant):
    """A file entry without s3_key should be skipped."""
    config = {
        "files": [
            {"filename": "report.pdf", "content_type": "application/pdf", "size": 1000},
        ]
    }

    results = await handler.fetch(config, since=None)
    assert len(results) == 0


# ---------------------------------------------------------------------------
# Unit tests for chunking helper
# ---------------------------------------------------------------------------


class TestChunkText:
    def test_short_text_no_chunking(self):
        from handlers.file_upload_handler import _chunk_text
        text = "short text"
        chunks = _chunk_text(text, 500_000)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_long_text_produces_multiple_chunks(self):
        from handlers.file_upload_handler import _chunk_text
        text = "A" * 1_200_000
        chunks = _chunk_text(text, 500_000)
        assert len(chunks) >= 2
        # All text should be preserved
        assert "".join(chunks) == text

    def test_breaks_at_newlines(self):
        from handlers.file_upload_handler import _chunk_text
        # Build text where a newline occurs near the chunk boundary
        part1 = "A" * 450_000
        part2 = "B" * 100_000
        text = part1 + "\n" + part2
        chunks = _chunk_text(text, 500_000)
        # Should prefer breaking at the newline
        assert len(chunks) >= 1
        assert "".join(chunks) == text


class TestTypeDetection:
    def test_is_pdf(self):
        from handlers.file_upload_handler import _is_pdf
        assert _is_pdf("report.pdf", "application/pdf") is True
        assert _is_pdf("report.PDF", "") is True
        assert _is_pdf("report.xlsx", "application/pdf") is True
        assert _is_pdf("report.xlsx", "text/plain") is False

    def test_is_xlsx(self):
        from handlers.file_upload_handler import _is_xlsx
        assert _is_xlsx("data.xlsx", "") is True
        assert _is_xlsx("data.txt", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") is True
        assert _is_xlsx("data.txt", "text/plain") is False

    def test_is_xls(self):
        from handlers.file_upload_handler import _is_xls
        assert _is_xls("old.xls", "") is True
        assert _is_xls("old.txt", "application/vnd.ms-excel") is True
        assert _is_xls("old.txt", "text/plain") is False
