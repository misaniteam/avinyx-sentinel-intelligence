"""Tests for the file upload endpoint (POST /ingestion/file-upload/)."""

import uuid
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

# ---------------------------------------------------------------------------
# Minimal valid file bytes for test fixtures
# ---------------------------------------------------------------------------

# Minimal valid PDF (header + empty body + EOF marker)
MINIMAL_PDF_BYTES = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\nxref\n0 3\ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n0\n%%EOF"

# Minimal XLSX is a ZIP file (PK header)
# A real XLSX is a ZIP with specific XML contents, but magic byte check only needs PK\x03\x04
MINIMAL_XLSX_BYTES = b"PK\x03\x04" + b"\x00" * 100

# Minimal XLS (OLE2 header)
MINIMAL_XLS_BYTES = b"\xd0\xcf\x11\xe0" + b"\x00" * 100


# ---------------------------------------------------------------------------
# Fixtures and helpers
# ---------------------------------------------------------------------------

FAKE_TENANT_ID = str(uuid.uuid4())
FAKE_DS_ID = uuid.uuid4()
FAKE_USER = {
    "sub": str(uuid.uuid4()),
    "tenant_id": FAKE_TENANT_ID,
    "is_super_admin": False,
    "permissions": ["data_sources:write"],
}


def _make_fake_ds(**overrides):
    """Return a MagicMock that behaves like a DataSource ORM object."""
    ds = MagicMock()
    ds.id = overrides.get("id", FAKE_DS_ID)
    ds.platform = overrides.get("platform", "file_upload")
    ds.name = overrides.get("name", "Test Upload")
    ds.config = overrides.get("config", {})
    ds.poll_interval_minutes = overrides.get("poll_interval_minutes", 0)
    ds.is_active = overrides.get("is_active", False)
    ds.last_polled_at = overrides.get("last_polled_at", None)
    ds.tenant_id = overrides.get("tenant_id", FAKE_TENANT_ID)
    return ds


@pytest.fixture
def mock_deps():
    """Patch auth dependencies, DB session, S3Client, SQSClient, and get_settings."""
    with (
        patch(
            "routers.file_upload.get_current_tenant_required",
            return_value=FAKE_TENANT_ID,
        ),
        patch(
            "routers.file_upload.require_permissions", return_value=lambda: FAKE_USER
        ),
        patch("routers.file_upload.get_settings") as mock_settings,
        patch("routers.file_upload.S3Client") as mock_s3_cls,
        patch("routers.file_upload.SQSClient") as mock_sqs_cls,
        patch("routers.file_upload.get_db") as mock_get_db,
    ):
        # Settings
        settings = MagicMock()
        settings.s3_uploads_bucket = "test-uploads"
        settings.sqs_ingestion_queue = "test-queue"
        mock_settings.return_value = settings

        # S3
        mock_s3 = AsyncMock()
        mock_s3.upload_file = AsyncMock(return_value="fake-key")
        mock_s3_cls.return_value = mock_s3

        # SQS
        mock_sqs = AsyncMock()
        mock_sqs.send_message = AsyncMock()
        mock_sqs_cls.return_value = mock_sqs

        # DB session
        mock_session = AsyncMock()

        # When flush() is called, assign an id to the DataSource object
        async def fake_flush():
            pass

        mock_session.flush = fake_flush
        mock_session.commit = AsyncMock()

        async def fake_refresh(obj):
            # Simulate refreshing the DS — set id if not present
            if not hasattr(obj, "id") or obj.id is None:
                obj.id = FAKE_DS_ID

        mock_session.refresh = fake_refresh
        mock_session.add = MagicMock()

        async def db_gen():
            yield mock_session

        mock_get_db.return_value = db_gen()

        yield {
            "settings": settings,
            "s3": mock_s3,
            "sqs": mock_sqs,
            "session": mock_session,
        }


@pytest.fixture
def patched_app(mock_deps):
    """Import the app after mocking dependencies."""
    # We need to patch the DataSource model to avoid SQLAlchemy requiring a real engine.
    with patch("routers.file_upload.DataSource") as mock_ds_model:
        # DataSource() constructor returns a mock with an id
        fake_ds = _make_fake_ds()
        mock_ds_model.return_value = fake_ds
        mock_ds_model.side_effect = None

        # Re-wire so DataSourceResponse.from_model works on our fake
        with patch("routers.file_upload.DataSourceResponse") as mock_resp:
            mock_resp.from_model = MagicMock(
                side_effect=lambda ds: {
                    "id": str(ds.id),
                    "platform": ds.platform,
                    "name": ds.name,
                    "config": ds.config,
                    "poll_interval_minutes": ds.poll_interval_minutes,
                    "is_active": ds.is_active,
                    "last_polled_at": None,
                }
            )

            from main import app

            yield app, mock_deps, fake_ds


@pytest.fixture
async def client(patched_app):
    app, deps, fake_ds = patched_app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac, deps, fake_ds


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_upload_pdf_success(client):
    ac, deps, fake_ds = client
    response = await ac.post(
        "/ingestion/file-upload/",
        files=[
            ("files", ("report.pdf", BytesIO(MINIMAL_PDF_BYTES), "application/pdf"))
        ],
        data={"name": "PDF Upload"},
    )
    assert response.status_code == 201
    deps["s3"].upload_file.assert_awaited_once()
    call_args = deps["s3"].upload_file.call_args
    assert call_args[0][0] == "test-uploads"  # bucket
    assert "report.pdf" in call_args[0][1]  # key contains sanitized filename
    assert call_args[0][3] == "application/pdf"  # content_type


@pytest.mark.asyncio
async def test_upload_xlsx_success(client):
    ac, deps, fake_ds = client
    response = await ac.post(
        "/ingestion/file-upload/",
        files=[
            (
                "files",
                (
                    "data.xlsx",
                    BytesIO(MINIMAL_XLSX_BYTES),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ),
            )
        ],
        data={"name": "Excel Upload"},
    )
    assert response.status_code == 201
    deps["s3"].upload_file.assert_awaited_once()


@pytest.mark.asyncio
async def test_upload_multiple_files(client):
    ac, deps, fake_ds = client
    response = await ac.post(
        "/ingestion/file-upload/",
        files=[
            ("files", ("report.pdf", BytesIO(MINIMAL_PDF_BYTES), "application/pdf")),
            (
                "files",
                (
                    "data.xlsx",
                    BytesIO(MINIMAL_XLSX_BYTES),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ),
            ),
        ],
        data={"name": "Multi Upload"},
    )
    assert response.status_code == 201
    assert deps["s3"].upload_file.await_count == 2


@pytest.mark.asyncio
async def test_upload_invalid_file_type(client):
    """Uploading a .txt file should be rejected with 422."""
    ac, deps, _ = client
    response = await ac.post(
        "/ingestion/file-upload/",
        files=[("files", ("notes.txt", BytesIO(b"hello world"), "text/plain"))],
        data={"name": "Bad Upload"},
    )
    assert response.status_code == 422
    assert "Unsupported file type" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_file_too_large(client):
    """A file exceeding 50MB should be rejected with 422."""
    ac, deps, _ = client
    # Create data just over the 50MB limit (we prepend valid PDF magic bytes)
    oversized_data = MINIMAL_PDF_BYTES + b"\x00" * (50 * 1024 * 1024 + 1)
    response = await ac.post(
        "/ingestion/file-upload/",
        files=[("files", ("huge.pdf", BytesIO(oversized_data), "application/pdf"))],
        data={"name": "Huge Upload"},
    )
    assert response.status_code == 422
    assert "exceeds maximum size" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_too_many_files(client):
    """Uploading more than 10 files should be rejected with 422."""
    ac, deps, _ = client
    files = [
        ("files", (f"file{i}.pdf", BytesIO(MINIMAL_PDF_BYTES), "application/pdf"))
        for i in range(11)
    ]
    response = await ac.post(
        "/ingestion/file-upload/",
        files=files,
        data={"name": "Too Many"},
    )
    assert response.status_code == 422
    assert "Maximum" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_no_files(client):
    """Submitting with no files should fail with 422."""
    ac, deps, _ = client
    response = await ac.post(
        "/ingestion/file-upload/",
        data={"name": "No Files"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_upload_empty_name(client):
    """Empty name should be rejected by FastAPI validation."""
    ac, deps, _ = client
    response = await ac.post(
        "/ingestion/file-upload/",
        files=[
            ("files", ("report.pdf", BytesIO(MINIMAL_PDF_BYTES), "application/pdf"))
        ],
        data={"name": ""},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_filename_sanitization(client):
    """A path-traversal filename should be sanitized before use in S3 key."""
    ac, deps, _ = client
    response = await ac.post(
        "/ingestion/file-upload/",
        files=[
            ("files", ("../../evil.pdf", BytesIO(MINIMAL_PDF_BYTES), "application/pdf"))
        ],
        data={"name": "Sanitize Test"},
    )
    assert response.status_code == 201
    # Verify the S3 key does not contain path traversal
    s3_key = deps["s3"].upload_file.call_args[0][1]
    assert ".." not in s3_key
    assert "/" not in s3_key.split("/")[-1] or "evil" in s3_key


@pytest.mark.asyncio
async def test_magic_byte_validation(client):
    """A .pdf extension with non-PDF content (wrong magic bytes) should be rejected."""
    ac, deps, _ = client
    # Send a file with .pdf extension but plain text content (no %PDF header)
    fake_content = b"This is not a PDF file at all"
    response = await ac.post(
        "/ingestion/file-upload/",
        files=[("files", ("fake.pdf", BytesIO(fake_content), "application/pdf"))],
        data={"name": "Fake PDF"},
    )
    assert response.status_code == 422
    assert "does not match its extension" in response.json()["detail"]


# ---------------------------------------------------------------------------
# Unit tests for helper functions
# ---------------------------------------------------------------------------


class TestSanitizeFilename:
    def test_strips_path_components(self):
        from routers.file_upload import _sanitize_filename

        assert _sanitize_filename("../../etc/passwd") == "passwd"

    def test_strips_windows_path(self):
        from routers.file_upload import _sanitize_filename

        result = _sanitize_filename("C:\\Users\\evil\\doc.pdf")
        assert "\\" not in result
        assert "doc.pdf" in result

    def test_replaces_unsafe_chars(self):
        from routers.file_upload import _sanitize_filename

        result = _sanitize_filename("my file (1).pdf")
        assert " " not in result
        assert "(" not in result
        assert result.endswith(".pdf")

    def test_truncates_long_filenames(self):
        from routers.file_upload import _sanitize_filename

        long_name = "a" * 200 + ".pdf"
        result = _sanitize_filename(long_name)
        assert len(result) <= 100
        assert result.endswith(".pdf")


class TestValidateMagicBytes:
    def test_valid_pdf(self):
        from routers.file_upload import _validate_magic_bytes

        assert _validate_magic_bytes(b"%PDF-1.4 rest of content", ".pdf") is True

    def test_invalid_pdf(self):
        from routers.file_upload import _validate_magic_bytes

        assert _validate_magic_bytes(b"not a pdf", ".pdf") is False

    def test_valid_xlsx(self):
        from routers.file_upload import _validate_magic_bytes

        assert _validate_magic_bytes(b"PK\x03\x04 rest", ".xlsx") is True

    def test_valid_xls(self):
        from routers.file_upload import _validate_magic_bytes

        assert _validate_magic_bytes(b"\xd0\xcf\x11\xe0 rest", ".xls") is True

    def test_unknown_extension(self):
        from routers.file_upload import _validate_magic_bytes

        assert _validate_magic_bytes(b"anything", ".docx") is False


class TestGetFileExtension:
    def test_normal_extension(self):
        from routers.file_upload import _get_file_extension

        assert _get_file_extension("report.pdf") == ".pdf"

    def test_uppercase(self):
        from routers.file_upload import _get_file_extension

        assert _get_file_extension("DATA.XLSX") == ".xlsx"

    def test_no_extension(self):
        from routers.file_upload import _get_file_extension

        assert _get_file_extension("noext") == ""

    def test_multiple_dots(self):
        from routers.file_upload import _get_file_extension

        assert _get_file_extension("my.file.pdf") == ".pdf"
