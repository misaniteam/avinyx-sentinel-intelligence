"""Tests for the S3Client (upload and download)."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.fixture
def mock_settings():
    with patch("sentinel_shared.storage.s3.get_settings") as mock_fn:
        settings = MagicMock()
        settings.aws_region = "ap-south-1"
        settings.aws_endpoint_url = None
        mock_fn.return_value = settings
        yield settings


@pytest.fixture
def s3_client(mock_settings):
    from sentinel_shared.storage.s3 import S3Client

    return S3Client()


@pytest.mark.asyncio
async def test_upload_file(s3_client):
    """upload_file should call put_object with correct params including ServerSideEncryption."""
    mock_s3_service = AsyncMock()
    mock_s3_service.put_object = AsyncMock()

    # Mock the context manager chain: session.create_client() -> __aenter__ -> s3 client
    mock_ctx = AsyncMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_s3_service)
    mock_ctx.__aexit__ = AsyncMock(return_value=False)

    with patch.object(s3_client._session, "create_client", return_value=mock_ctx):
        result = await s3_client.upload_file(
            bucket="test-bucket",
            key="tenant-1/file.pdf",
            data=b"pdf bytes here",
            content_type="application/pdf",
        )

    assert result == "tenant-1/file.pdf"
    mock_s3_service.put_object.assert_awaited_once_with(
        Bucket="test-bucket",
        Key="tenant-1/file.pdf",
        Body=b"pdf bytes here",
        ContentType="application/pdf",
        ServerSideEncryption="AES256",
    )


@pytest.mark.asyncio
async def test_download_file(s3_client):
    """download_file should call get_object and return the file bytes."""
    file_data = b"downloaded file contents"

    mock_body = AsyncMock()
    mock_body.read = AsyncMock(return_value=file_data)

    mock_body_ctx = AsyncMock()
    mock_body_ctx.__aenter__ = AsyncMock(return_value=mock_body)
    mock_body_ctx.__aexit__ = AsyncMock(return_value=False)

    mock_s3_service = AsyncMock()
    mock_s3_service.get_object = AsyncMock(return_value={"Body": mock_body_ctx})

    mock_ctx = AsyncMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_s3_service)
    mock_ctx.__aexit__ = AsyncMock(return_value=False)

    with patch.object(s3_client._session, "create_client", return_value=mock_ctx):
        result = await s3_client.download_file(
            bucket="test-bucket",
            key="tenant-1/file.pdf",
        )

    assert result == file_data
    mock_s3_service.get_object.assert_awaited_once_with(
        Bucket="test-bucket",
        Key="tenant-1/file.pdf",
    )


@pytest.mark.asyncio
async def test_upload_file_with_endpoint_url(mock_settings):
    """When aws_endpoint_url is set, it should be passed to create_client."""
    mock_settings.aws_endpoint_url = "http://localhost:4566"

    from sentinel_shared.storage.s3 import S3Client

    client = S3Client()

    kwargs = client._get_client_kwargs()
    assert kwargs["region_name"] == "ap-south-1"
    assert kwargs["endpoint_url"] == "http://localhost:4566"


@pytest.mark.asyncio
async def test_upload_file_without_endpoint_url(mock_settings):
    """When aws_endpoint_url is None, endpoint_url should not be in kwargs."""
    mock_settings.aws_endpoint_url = None

    from sentinel_shared.storage.s3 import S3Client

    client = S3Client()

    kwargs = client._get_client_kwargs()
    assert kwargs["region_name"] == "ap-south-1"
    assert "endpoint_url" not in kwargs
