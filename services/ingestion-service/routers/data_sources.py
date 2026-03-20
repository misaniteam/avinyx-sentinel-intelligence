from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sentinel_shared.database.session import get_db
from sentinel_shared.models.data_source import DataSource
from sentinel_shared.auth.dependencies import get_current_tenant, require_permissions
from pydantic import BaseModel

router = APIRouter()

class DataSourceCreate(BaseModel):
    platform: str
    name: str
    config: dict = {}
    poll_interval_minutes: int = 60

class DataSourceUpdate(BaseModel):
    name: str | None = None
    config: dict | None = None
    poll_interval_minutes: int | None = None
    is_active: bool | None = None

class DataSourceResponse(BaseModel):
    id: UUID
    platform: str
    name: str
    config: dict
    poll_interval_minutes: int
    is_active: bool
    last_polled_at: str | None = None

    model_config = {"from_attributes": True}

@router.get("/", response_model=list[DataSourceResponse])
async def list_data_sources(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("data_sources:read")),
):
    result = await db.execute(select(DataSource).where(DataSource.tenant_id == tenant_id))
    return result.scalars().all()

@router.post("/", response_model=DataSourceResponse, status_code=status.HTTP_201_CREATED)
async def create_data_source(
    request: DataSourceCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("data_sources:write")),
):
    ds = DataSource(
        platform=request.platform,
        name=request.name,
        config=request.config,
        poll_interval_minutes=request.poll_interval_minutes,
        tenant_id=tenant_id,
    )
    db.add(ds)
    await db.commit()
    await db.refresh(ds)
    return ds

@router.get("/{source_id}", response_model=DataSourceResponse)
async def get_data_source(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("data_sources:read")),
):
    result = await db.execute(select(DataSource).where(DataSource.id == source_id, DataSource.tenant_id == tenant_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Data source not found")
    return ds

@router.patch("/{source_id}", response_model=DataSourceResponse)
async def update_data_source(
    source_id: UUID,
    request: DataSourceUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("data_sources:write")),
):
    result = await db.execute(select(DataSource).where(DataSource.id == source_id, DataSource.tenant_id == tenant_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Data source not found")
    for key, value in request.model_dump(exclude_unset=True).items():
        setattr(ds, key, value)
    await db.commit()
    await db.refresh(ds)
    return ds

@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_data_source(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("data_sources:write")),
):
    result = await db.execute(select(DataSource).where(DataSource.id == source_id, DataSource.tenant_id == tenant_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Data source not found")
    await db.delete(ds)
    await db.commit()
