from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sentinel_shared.database.session import get_db
from sentinel_shared.models.media import RawMediaItem, SentimentAnalysis
from sentinel_shared.auth.dependencies import (
    get_current_tenant_required,
    require_permissions,
)

router = APIRouter()


@router.get("/data")
async def heatmap_data(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("heatmap:view")),
    sentiment_filter: str | None = Query(None, pattern="^(positive|negative|neutral)$"),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    limit: int = Query(5000, le=10000),
):
    query = (
        select(
            RawMediaItem.geo_lat,
            RawMediaItem.geo_lng,
            SentimentAnalysis.sentiment_score,
        )
        .join(SentimentAnalysis, SentimentAnalysis.media_item_id == RawMediaItem.id)
        .where(
            RawMediaItem.tenant_id == tenant_id,
            SentimentAnalysis.tenant_id == tenant_id,
            RawMediaItem.geo_lat.isnot(None),
            RawMediaItem.geo_lng.isnot(None),
        )
    )

    if sentiment_filter:
        query = query.where(SentimentAnalysis.sentiment_label == sentiment_filter)
    if date_from:
        query = query.where(RawMediaItem.published_at >= date_from)
    if date_to:
        query = query.where(RawMediaItem.published_at <= date_to)

    query = query.limit(limit)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "lat": row.geo_lat,
            "lng": row.geo_lng,
            "weight": (row.sentiment_score + 1) / 2,
        }
        for row in rows
    ]
