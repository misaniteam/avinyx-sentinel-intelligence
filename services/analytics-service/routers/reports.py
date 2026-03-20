import logging
from typing import Any, Literal
from uuid import UUID

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sentinel_shared.auth.dependencies import get_current_tenant_required, require_permissions
from sentinel_shared.config import get_settings
from sentinel_shared.database.session import get_db
from sentinel_shared.models.report import Report

logger = logging.getLogger(__name__)

router = APIRouter()


class ReportCreate(BaseModel):
    name: str
    config: dict[str, Any] = {}
    format: Literal["pdf", "image", "csv"] = "pdf"

    @field_validator("config")
    @classmethod
    def validate_config_size(cls, v: dict) -> dict:
        import json

        if len(json.dumps(v)) > 10000:  # 10KB limit
            raise ValueError("Report config too large (max 10KB)")
        return v


class ReportResponse(BaseModel):
    id: UUID
    name: str
    config: dict
    format: str
    status: str
    generated_file: str | None = None

    model_config = {"from_attributes": True}


class ReportGenerateResponse(BaseModel):
    status: str


class ReportDownloadResponse(BaseModel):
    download_url: str
    expires_in: int


def _get_s3_client():
    settings = get_settings()
    kwargs: dict = {
        "region_name": settings.aws_region,
    }
    if settings.aws_endpoint_url:
        kwargs["endpoint_url"] = settings.aws_endpoint_url
    return boto3.client("s3", **kwargs)


@router.get("/", response_model=list[ReportResponse])
async def list_reports(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("reports:read")),
):
    result = await db.execute(select(Report).where(Report.tenant_id == tenant_id))
    return result.scalars().all()


@router.post("/", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    request: ReportCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("reports:write")),
):
    report = Report(
        name=request.name,
        config=request.config,
        format=request.format,
        tenant_id=tenant_id,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("reports:read")),
):
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.tenant_id == tenant_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.post("/{report_id}/generate", response_model=ReportGenerateResponse)
async def generate_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("reports:write")),
):
    """Trigger report generation. MVP: sets status to completed with a placeholder S3 key."""
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.tenant_id == tenant_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status == "generating":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Report is already being generated",
        )

    # MVP: immediately mark as completed with placeholder S3 key
    report.status = "completed"
    report.generated_file = f"{tenant_id}/{report_id}.{report.format}"
    await db.commit()
    await db.refresh(report)

    logger.info("Report %s generation triggered (MVP: completed immediately)", report_id)
    return ReportGenerateResponse(status="generating")


@router.get("/{report_id}/download", response_model=ReportDownloadResponse)
async def download_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("reports:read")),
):
    """Return a presigned S3 URL for downloading a generated report."""
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.tenant_id == tenant_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if not report.generated_file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report has not been generated yet",
        )

    settings = get_settings()
    expires_in = 600

    try:
        s3 = _get_s3_client()
        download_url = s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.s3_reports_bucket,
                "Key": report.generated_file,
            },
            ExpiresIn=expires_in,
        )
    except ClientError:
        logger.exception("Failed to generate presigned URL for report %s", report_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate download URL",
        )

    return ReportDownloadResponse(download_url=download_url, expires_in=expires_in)
