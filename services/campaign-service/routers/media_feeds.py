from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sentinel_shared.database.session import get_db
from sentinel_shared.models.media import MediaFeed
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


@router.get("/", response_model=MediaFeedListResponse)
async def list_media_feeds(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("media:read")),
    platform: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    base = select(MediaFeed).where(MediaFeed.tenant_id == tenant_id)
    if platform:
        base = base.where(MediaFeed.platform == platform)

    # Total count
    count_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_result.scalar() or 0

    # Paginated results
    query = base.order_by(desc(MediaFeed.published_at)).offset(skip).limit(limit)
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
