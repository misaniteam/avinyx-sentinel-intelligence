from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sentinel_shared.database.session import get_db
from sentinel_shared.models.media import RawMediaItem
from sentinel_shared.auth.dependencies import (
    get_current_tenant_required,
    require_permissions,
)
from pydantic import BaseModel

router = APIRouter()


class IngestedDataItem(BaseModel):
    id: UUID
    platform: str
    external_id: str
    content: str | None
    author: str | None
    published_at: datetime | None
    url: str | None
    geo_region: str | None
    engagement: dict
    ai_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class IngestedDataResponse(BaseModel):
    items: list[IngestedDataItem]
    total: int


@router.get("/", response_model=IngestedDataResponse)
async def list_ingested_data(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("data_sources:read")),
    platform: str | None = None,
    search: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    # Build base filter conditions
    conditions = [RawMediaItem.tenant_id == tenant_id]

    if platform:
        conditions.append(RawMediaItem.platform == platform)
    if search:
        conditions.append(RawMediaItem.content.ilike(f"%{search}%"))
    if date_from:
        conditions.append(RawMediaItem.published_at >= date_from)
    if date_to:
        conditions.append(RawMediaItem.published_at <= date_to)

    # Count query
    count_query = select(func.count()).select_from(RawMediaItem).where(*conditions)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Items query
    items_query = (
        select(RawMediaItem)
        .where(*conditions)
        .order_by(desc(RawMediaItem.created_at))
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(items_query)
    items = result.scalars().all()

    return IngestedDataResponse(
        items=[
            IngestedDataItem(
                id=item.id,
                platform=item.platform,
                external_id=item.external_id,
                content=item.content,
                author=item.author,
                published_at=item.published_at,
                url=item.url,
                geo_region=item.geo_region,
                engagement=item.engagement or {},
                ai_status=item.ai_status,
                created_at=item.created_at,
            )
            for item in items
        ],
        total=total,
    )
