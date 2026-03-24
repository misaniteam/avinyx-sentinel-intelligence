import re
import uuid
import structlog
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel
from sentinel_shared.auth.dependencies import get_current_tenant_required, require_permissions
from sentinel_shared.storage.s3 import S3Client
from sentinel_shared.messaging.sqs import SQSClient
from sentinel_shared.config import get_settings

logger = structlog.get_logger()
router = APIRouter()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
PDF_MAGIC_BYTES = b"%PDF"


class VoterListUploadResponse(BaseModel):
    file_id: str
    s3_key: str
    year: int
    language: str
    status: str


def _sanitize_filename(filename: str) -> str:
    """Sanitize filename: strip path, replace unsafe chars, truncate."""
    filename = filename.split("/")[-1].split("\\")[-1]
    filename = re.sub(r"[^a-zA-Z0-9.\-_]", "_", filename)
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


@router.post("/", response_model=VoterListUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_voter_list(
    file: UploadFile = File(...),
    year: int = Form(...),
    language: str = Form(default="en"),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("voters:write")),
):
    """Upload a voter list PDF for processing."""
    filename = file.filename or ""
    ext = _get_file_extension(filename)

    # Validate PDF extension
    if ext != ".pdf":
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type: {filename}. Only PDF files are allowed.",
        )

    # Read file with size limit
    data = await file.read(MAX_FILE_SIZE + 1)
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=422,
            detail=f"File {filename} exceeds maximum size of 50MB",
        )
    if len(data) == 0:
        raise HTTPException(
            status_code=422,
            detail=f"File {filename} is empty",
        )

    # Validate PDF magic bytes
    if not data[:4].startswith(PDF_MAGIC_BYTES):
        raise HTTPException(
            status_code=422,
            detail=f"File {filename} is not a valid PDF. The file may be corrupted or misnamed.",
        )

    # Validate language
    if language not in ("en", "bn", "hi"):
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported language: {language}. Allowed: en, bn, hi",
        )

    settings = get_settings()
    s3 = S3Client()

    # Generate file ID and S3 key
    file_id = str(uuid.uuid4())
    sanitized_name = _sanitize_filename(filename)
    s3_key = f"{tenant_id}/{file_id}_{sanitized_name}"

    # Upload to S3
    try:
        await s3.upload_file(
            settings.s3_voter_docs_bucket,
            s3_key,
            data,
            "application/pdf",
        )
        logger.info(
            "voter_list_uploaded_to_s3",
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
            detail=f"Failed to upload file {filename} to storage",
        )

    # Send SQS message to voter-list processing queue
    try:
        sqs = SQSClient()
        await sqs.send_message(settings.sqs_voter_list_queue, {
            "file_id": file_id,
            "s3_key": s3_key,
            "year": year,
            "language": language,
            "tenant_id": tenant_id,
        })
        logger.info(
            "voter_list_job_dispatched",
            file_id=file_id,
            s3_key=s3_key,
            year=year,
            language=language,
            tenant_id=tenant_id,
        )
    except Exception as exc:
        logger.error(
            "sqs_dispatch_failed",
            file_id=file_id,
            error=str(exc),
            tenant_id=tenant_id,
        )

    return VoterListUploadResponse(
        file_id=file_id,
        s3_key=s3_key,
        year=year,
        language=language,
        status="processing",
    )
