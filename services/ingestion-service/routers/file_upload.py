import re
import uuid
import structlog
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sentinel_shared.database.session import get_db
from sentinel_shared.models.data_source import DataSource
from sentinel_shared.auth.dependencies import get_current_tenant_required, require_permissions
from sentinel_shared.storage.s3 import S3Client
from sentinel_shared.messaging.sqs import SQSClient
from sentinel_shared.config import get_settings
from routers.data_sources import DataSourceResponse

logger = structlog.get_logger()
router = APIRouter()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
MAX_FILES = 10

ALLOWED_EXTENSIONS = {".pdf", ".xlsx", ".xls"}

# Magic byte signatures for allowed file types
MAGIC_SIGNATURES: dict[str, list[bytes]] = {
    ".pdf": [b"%PDF"],
    ".xlsx": [b"PK\x03\x04"],  # ZIP-based (OOXML)
    ".xls": [b"\xd0\xcf\x11\xe0"],  # OLE2 Compound Document
}

# Map extensions to safe content types (ignore client-provided content_type)
SAFE_CONTENT_TYPES: dict[str, str] = {
    ".pdf": "application/pdf",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
}


def _validate_magic_bytes(data: bytes, extension: str) -> bool:
    """Verify file content matches expected magic bytes for the extension."""
    signatures = MAGIC_SIGNATURES.get(extension, [])
    if not signatures:
        return False
    return any(data[:len(sig)] == sig for sig in signatures)


def _sanitize_filename(filename: str) -> str:
    """Sanitize filename: strip path, replace unsafe chars, truncate."""
    # Strip any path components
    filename = filename.split("/")[-1].split("\\")[-1]
    # Replace non-alphanumeric chars (except .-_) with underscore
    filename = re.sub(r"[^a-zA-Z0-9.\-_]", "_", filename)
    # Truncate to 100 chars
    if len(filename) > 100:
        name, _, ext = filename.rpartition(".")
        if ext and len(ext) <= 10:
            filename = name[: 100 - len(ext) - 1] + "." + ext
        else:
            filename = filename[:100]
    return filename


def _get_file_extension(filename: str) -> str:
    """Get lowercase file extension including the dot."""
    dot_idx = filename.rfind(".")
    if dot_idx == -1:
        return ""
    return filename[dot_idx:].lower()


def _validate_file(file: UploadFile) -> None:
    """Validate a single uploaded file's type and extension."""
    filename = file.filename or ""
    ext = _get_file_extension(filename)

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type: {filename}. Allowed: PDF, XLSX, XLS",
        )


@router.post("/", response_model=DataSourceResponse, status_code=status.HTTP_201_CREATED)
async def upload_files(
    files: list[UploadFile] = File(...),
    name: str = Form(..., min_length=1, max_length=255),
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("data_sources:write")),
):
    """Upload PDF/Excel files for one-shot ingestion."""
    if not files:
        raise HTTPException(status_code=422, detail="At least one file is required")
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=422, detail=f"Maximum {MAX_FILES} files allowed per upload")

    # Validate all files first before uploading anything
    for file in files:
        _validate_file(file)

    settings = get_settings()
    s3 = S3Client()

    # Create the DataSource record first to get its ID
    ds = DataSource(
        platform="file_upload",
        name=name,
        config={},
        poll_interval_minutes=0,
        is_active=False,
        tenant_id=tenant_id,
    )
    db.add(ds)
    await db.flush()  # Get the ID without committing

    file_infos = []

    for file in files:
        # Read file in a size-limited manner to prevent memory exhaustion.
        # Read one byte beyond the limit so we can detect oversized files
        # without loading arbitrarily large data into memory.
        data = await file.read(MAX_FILE_SIZE + 1)
        if len(data) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=422,
                detail=f"File {file.filename} exceeds maximum size of 50MB",
            )
        if len(data) == 0:
            raise HTTPException(
                status_code=422,
                detail=f"File {file.filename} is empty",
            )

        # Validate magic bytes match the declared extension
        ext = _get_file_extension(file.filename or "")
        if not _validate_magic_bytes(data, ext):
            raise HTTPException(
                status_code=422,
                detail=f"File {file.filename} content does not match its extension ({ext}). "
                       f"The file may be corrupted or misnamed.",
            )

        sanitized_name = _sanitize_filename(file.filename or "upload")
        s3_key = f"{tenant_id}/{ds.id}/{uuid.uuid4()}_{sanitized_name}"
        # Use a safe, deterministic content type based on extension (never trust client-provided value)
        content_type = SAFE_CONTENT_TYPES.get(ext, "application/octet-stream")

        try:
            await s3.upload_file(settings.s3_uploads_bucket, s3_key, data, content_type)
            logger.info(
                "file_uploaded_to_s3",
                s3_key=s3_key,
                filename=sanitized_name,
                size=len(data),
                tenant_id=tenant_id,
            )
        except Exception as exc:
            logger.error(
                "s3_upload_failed",
                filename=sanitized_name,
                error=str(exc),
                tenant_id=tenant_id,
            )
            raise HTTPException(
                status_code=502,
                detail=f"Failed to upload file {file.filename} to storage",
            )

        file_infos.append({
            "filename": sanitized_name,
            "s3_key": s3_key,
            "content_type": content_type,
            "size": len(data),
        })

    # Update the DataSource config with file information
    ds.config = {"files": file_infos}
    await db.commit()
    await db.refresh(ds)

    # Dispatch SQS message for the worker to process
    try:
        sqs = SQSClient()
        await sqs.send_message(settings.sqs_ingestion_queue, {
            "tenant_id": tenant_id,
            "platform": "file_upload",
            "config": ds.config,
            "data_source_id": str(ds.id),
        })
        logger.info(
            "file_upload_job_dispatched",
            data_source_id=str(ds.id),
            file_count=len(file_infos),
            tenant_id=tenant_id,
        )
    except Exception as exc:
        logger.error(
            "sqs_dispatch_failed",
            data_source_id=str(ds.id),
            error=str(exc),
            tenant_id=tenant_id,
        )
        # Files are already uploaded to S3, so we don't roll back the DataSource.
        # The admin can manually retry or delete.

    return DataSourceResponse.from_model(ds)
