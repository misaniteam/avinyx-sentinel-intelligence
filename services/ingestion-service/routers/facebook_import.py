import io
import re
import uuid
import structlog
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from openpyxl import Workbook
from sentinel_shared.database.session import get_db
from sentinel_shared.models.data_source import DataSource
from sentinel_shared.auth.dependencies import (
    get_current_tenant_required,
    require_permissions,
)
from sentinel_shared.storage.s3 import S3Client
from sentinel_shared.messaging.sqs import SQSClient
from sentinel_shared.config import get_settings
from routers.data_sources import DataSourceResponse

logger = structlog.get_logger()
router = APIRouter()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
XLSX_MAGIC = b"PK\x03\x04"

TEMPLATE_COLUMNS = [
    "title",
    "author",
    "datetime",
    "post_link",
    "reaction_count",
    "comments",
]

TEMPLATE_EXAMPLE_ROW = [
    "Local community event was a huge success!",
    "Rahul Sharma",
    "2026-03-15 14:30:00",
    "https://www.facebook.com/example/posts/123456",
    152,
    "Great initiative! Keep it up.",
]


@router.get("/template")
async def download_template(
    user: dict = Depends(require_permissions("data_sources:read")),
):
    """Download a sample XLSX template for Facebook posts import."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Facebook Posts"
    ws.append(TEMPLATE_COLUMNS)
    ws.append(TEMPLATE_EXAMPLE_ROW)

    # Auto-size columns for readability
    for col_idx, col_name in enumerate(TEMPLATE_COLUMNS, 1):
        ws.column_dimensions[
            ws.cell(row=1, column=col_idx).column_letter
        ].width = max(len(col_name) + 4, 20)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="facebook_posts_template.xlsx"'
        },
    )


def _sanitize_filename(filename: str) -> str:
    filename = filename.split("/")[-1].split("\\")[-1]
    filename = re.sub(r"[^a-zA-Z0-9.\-_]", "_", filename)
    if len(filename) > 100:
        name, _, ext = filename.rpartition(".")
        if ext and len(ext) <= 10:
            filename = name[: 100 - len(ext) - 1] + "." + ext
        else:
            filename = filename[:100]
    return filename


@router.post(
    "/", response_model=DataSourceResponse, status_code=status.HTTP_201_CREATED
)
async def upload_facebook_posts(
    file: UploadFile = File(...),
    name: str = Form(..., min_length=1, max_length=255),
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("data_sources:write")),
):
    """Upload an XLSX file containing Facebook posts for ingestion."""
    filename = file.filename or ""
    if not filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=422,
            detail="Only .xlsx files are accepted for Facebook post import",
        )

    data = await file.read(MAX_FILE_SIZE + 1)
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=422,
            detail=f"File {filename} exceeds maximum size of 50MB",
        )
    if len(data) == 0:
        raise HTTPException(status_code=422, detail=f"File {filename} is empty")

    if data[:4] != XLSX_MAGIC:
        raise HTTPException(
            status_code=422,
            detail=f"File {filename} does not appear to be a valid XLSX file",
        )

    settings = get_settings()
    s3 = S3Client()

    ds = DataSource(
        platform="facebook_import",
        name=name,
        config={},
        poll_interval_minutes=0,
        is_active=False,
        tenant_id=tenant_id,
    )
    db.add(ds)
    await db.flush()

    sanitized_name = _sanitize_filename(filename)
    s3_key = f"{tenant_id}/{ds.id}/{uuid.uuid4()}_{sanitized_name}"
    content_type = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

    try:
        await s3.upload_file(settings.s3_uploads_bucket, s3_key, data, content_type)
        logger.info(
            "facebook_import_uploaded",
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

    file_info = {
        "filename": sanitized_name,
        "s3_key": s3_key,
        "content_type": content_type,
        "size": len(data),
    }
    ds.config = {"files": [file_info]}
    await db.commit()
    await db.refresh(ds)

    try:
        sqs = SQSClient()
        await sqs.send_message(
            settings.sqs_ingestion_queue,
            {
                "tenant_id": tenant_id,
                "platform": "facebook_import",
                "config": ds.config,
                "data_source_id": str(ds.id),
            },
        )
        logger.info(
            "facebook_import_job_dispatched",
            data_source_id=str(ds.id),
            tenant_id=tenant_id,
        )
    except Exception as exc:
        logger.error(
            "sqs_dispatch_failed",
            data_source_id=str(ds.id),
            error=str(exc),
            tenant_id=tenant_id,
        )

    return DataSourceResponse.from_model(ds)
