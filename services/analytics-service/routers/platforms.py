from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sentinel_shared.database.session import get_db
from sentinel_shared.models.media import RawMediaItem
from sentinel_shared.auth.dependencies import (
    get_current_tenant_required,
    require_permissions,
)

router = APIRouter()


class PlatformBreakdownItem(BaseModel):
    platform: str
    count: int


class EngagementOverTimeItem(BaseModel):
    period_start: str
    likes: int
    shares: int
    comments: int


@router.get("/breakdown", response_model=list[PlatformBreakdownItem])
async def platform_breakdown(
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("analytics:read")),
):
    query = (
        select(RawMediaItem.platform, func.count().label("count"))
        .where(RawMediaItem.tenant_id == tenant_id)
        .group_by(RawMediaItem.platform)
    )

    if date_from:
        query = query.where(RawMediaItem.published_at >= date_from)
    if date_to:
        query = query.where(RawMediaItem.published_at <= date_to)

    result = await db.execute(query)
    rows = result.all()

    return [{"platform": row.platform, "count": row.count} for row in rows]


@router.get("/engagement-over-time", response_model=list[EngagementOverTimeItem])
async def engagement_over_time(
    period: str = Query("daily", pattern="^(daily|weekly)$"),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("analytics:read")),
):
    trunc_period = "day" if period == "daily" else "week"
    period_col = func.date_trunc(trunc_period, RawMediaItem.published_at).label(
        "period_start"
    )

    query = (
        select(
            period_col,
            func.coalesce(
                func.sum(RawMediaItem.engagement["likes"].as_integer()), 0
            ).label("likes"),
            func.coalesce(
                func.sum(RawMediaItem.engagement["shares"].as_integer()), 0
            ).label("shares"),
            func.coalesce(
                func.sum(RawMediaItem.engagement["comments"].as_integer()), 0
            ).label("comments"),
        )
        .where(
            RawMediaItem.tenant_id == tenant_id,
            RawMediaItem.published_at.isnot(None),
        )
        .group_by(period_col)
        .order_by(period_col)
    )

    if date_from:
        query = query.where(RawMediaItem.published_at >= date_from)
    if date_to:
        query = query.where(RawMediaItem.published_at <= date_to)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "period_start": str(row.period_start),
            "likes": row.likes,
            "shares": row.shares,
            "comments": row.comments,
        }
        for row in rows
    ]
