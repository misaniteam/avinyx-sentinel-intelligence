from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sentinel_shared.database.session import get_db
from sentinel_shared.models.media import SentimentAnalysis, RawMediaItem
from sentinel_shared.auth.dependencies import (
    get_current_tenant_required,
    require_permissions,
)

router = APIRouter()


class TopicCountItem(BaseModel):
    topic: str
    count: int


@router.get("/top", response_model=list[TopicCountItem])
async def top_topics(
    limit: int = Query(10, ge=1, le=100),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("analytics:read")),
):
    # Use PostgreSQL jsonb_array_elements_text to unnest and count topics in SQL
    unnested = (
        select(func.jsonb_array_elements_text(SentimentAnalysis.topics).label("topic"))
        .join(RawMediaItem, SentimentAnalysis.media_item_id == RawMediaItem.id)
        .where(
            SentimentAnalysis.tenant_id == tenant_id,
            RawMediaItem.tenant_id == tenant_id,
            SentimentAnalysis.topics.isnot(None),
        )
    )

    if date_from:
        unnested = unnested.where(RawMediaItem.published_at >= date_from)
    if date_to:
        unnested = unnested.where(RawMediaItem.published_at <= date_to)

    subq = unnested.subquery()

    stmt = (
        select(func.trim(subq.c.topic).label("topic"), func.count().label("count"))
        .where(func.trim(subq.c.topic) != "")
        .group_by(func.trim(subq.c.topic))
        .order_by(func.count().desc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [{"topic": row.topic, "count": row.count} for row in rows]
