from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sentinel_shared.database.session import get_db
from sentinel_shared.models.report import Report
from sentinel_shared.auth.dependencies import get_current_tenant, require_permissions
from pydantic import BaseModel

router = APIRouter()

class ReportCreate(BaseModel):
    name: str
    config: dict = {}
    format: str = "pdf"

class ReportResponse(BaseModel):
    id: UUID
    name: str
    config: dict
    format: str
    status: str
    generated_file: str | None = None

    model_config = {"from_attributes": True}

@router.get("/", response_model=list[ReportResponse])
async def list_reports(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("reports:read")),
):
    result = await db.execute(select(Report).where(Report.tenant_id == tenant_id))
    return result.scalars().all()

@router.post("/", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    request: ReportCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
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
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("reports:read")),
):
    result = await db.execute(select(Report).where(Report.id == report_id, Report.tenant_id == tenant_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report
