from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sentinel_shared.database.session import get_db
from sentinel_shared.models.media import RawMediaItem, SentimentAnalysis
from sentinel_shared.auth.dependencies import get_current_tenant, require_permissions
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class MediaFeedItem(BaseModel):
    id: UUID
    platform: str
    content: str | None
    author: str | None
    published_at: datetime | None
    url: str | None
    engagement: dict
    sentiment_score: float | None = None
    sentiment_label: str | None = None

    model_config = {"from_attributes": True}

@router.get("/", response_model=list[MediaFeedItem])
async def list_media_feeds(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("media:read")),
    platform: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    query = (
        select(
            RawMediaItem,
            SentimentAnalysis.sentiment_score,
            SentimentAnalysis.sentiment_label,
        )
        .outerjoin(SentimentAnalysis, SentimentAnalysis.media_item_id == RawMediaItem.id)
        .where(RawMediaItem.tenant_id == tenant_id)
        .order_by(desc(RawMediaItem.published_at))
    )

    if platform:
        query = query.where(RawMediaItem.platform == platform)

    result = await db.execute(query.offset(skip).limit(limit))
    rows = result.all()

    return [
        MediaFeedItem(
            id=row[0].id,
            platform=row[0].platform,
            content=row[0].content,
            author=row[0].author,
            published_at=row[0].published_at,
            url=row[0].url,
            engagement=row[0].engagement or {},
            sentiment_score=row[1],
            sentiment_label=row[2],
        )
        for row in rows
    ]
