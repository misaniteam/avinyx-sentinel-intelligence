from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, desc, asc, func, text
from sentinel_shared.database.session import get_db
from sentinel_shared.models.media import MediaFeed, SentimentAnalysis, RawMediaItem
from sentinel_shared.auth.dependencies import get_current_tenant, require_permissions
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()


class MediaFeedItem(BaseModel):
    id: UUID
    platform: str
    title: str | None = None
    description: str | None = None
    image_url: str | None = None
    source_link: str | None = None
    external_links: list[str] = []
    author: str | None = None
    published_at: datetime | None = None
    engagement: dict
    sentiment_score: float | None = None
    sentiment_label: str | None = None
    priority_score: float | None = None
    topics: list = []
    summary: str | None = None

    model_config = {"from_attributes": True}


class MediaFeedListResponse(BaseModel):
    items: list[MediaFeedItem]
    total: int


ALLOWED_SORT_FIELDS = {
    "published_at": MediaFeed.published_at,
    "sentiment_score": MediaFeed.sentiment_score,
    "platform": MediaFeed.platform,
    "author": MediaFeed.author,
}


@router.get("/", response_model=MediaFeedListResponse)
async def list_media_feeds(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("media:read")),
    platform: str | None = None,
    sentiment: str | None = None,
    topic: str | None = None,
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    sort_by: str = Query(
        "published_at", pattern="^(published_at|sentiment_score|platform|author)$"
    ),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    base = select(MediaFeed).where(MediaFeed.tenant_id == tenant_id)
    if platform:
        base = base.where(MediaFeed.platform == platform)
    if sentiment:
        base = base.where(MediaFeed.sentiment_label == sentiment)
    if topic:
        base = base.where(MediaFeed.topics.op("@>")(func.jsonb_build_array(topic)))
    if date_from:
        base = base.where(MediaFeed.published_at >= date_from)
    if date_to:
        base = base.where(MediaFeed.published_at <= date_to)

    # Total count
    count_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_result.scalar() or 0

    # Sorting
    sort_column = ALLOWED_SORT_FIELDS.get(sort_by, MediaFeed.published_at)
    order_func = desc if sort_order == "desc" else asc
    query = (
        base.order_by(order_func(sort_column).nulls_last()).offset(skip).limit(limit)
    )
    result = await db.execute(query)
    rows = result.scalars().all()

    return MediaFeedListResponse(
        items=[
            MediaFeedItem(
                id=row.id,
                platform=row.platform,
                title=row.title,
                description=row.description,
                image_url=row.image_url,
                source_link=row.source_link,
                external_links=row.external_links or [],
                author=row.author,
                published_at=row.published_at,
                engagement=row.engagement or {},
                sentiment_score=row.sentiment_score,
                sentiment_label=row.sentiment_label,
                priority_score=row.priority_score,
                topics=row.topics or [],
                summary=row.summary,
            )
            for row in rows
        ],
        total=total,
    )


@router.get("/topics", response_model=list[str])
async def list_media_feed_topics(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("media:read")),
):
    """Get distinct topics across all media feeds for the tenant."""
    result = await db.execute(
        text(
            "SELECT DISTINCT topic FROM media_feeds, "
            "jsonb_array_elements_text(topics) AS topic "
            "WHERE tenant_id = :tid ORDER BY topic"
        ),
        {"tid": tenant_id},
    )
    return [row[0] for row in result.fetchall()]


@router.delete("/{feed_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media_feed(
    feed_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("media:write")),
):
    result = await db.execute(
        select(MediaFeed).where(
            MediaFeed.id == feed_id,
            MediaFeed.tenant_id == tenant_id,
        )
    )
    feed = result.scalar_one_or_none()
    if not feed:
        raise HTTPException(status_code=404, detail="Media feed not found")

    media_item_id = feed.media_item_id

    # Delete MediaFeed, SentimentAnalysis, and the source RawMediaItem
    await db.delete(feed)
    if media_item_id:
        await db.execute(
            delete(SentimentAnalysis).where(
                SentimentAnalysis.media_item_id == media_item_id
            )
        )
        await db.execute(delete(RawMediaItem).where(RawMediaItem.id == media_item_id))
    await db.commit()
