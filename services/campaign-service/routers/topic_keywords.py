import structlog
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sentinel_shared.database.session import get_db
from sentinel_shared.models.topic_keyword import TopicKeyword
from sentinel_shared.schemas.topic_keyword import (
    TopicKeywordCreate,
    TopicKeywordUpdate,
    TopicKeywordResponse,
)
from sentinel_shared.auth.dependencies import (
    get_current_tenant_required,
    require_permissions,
)

logger = structlog.get_logger()

router = APIRouter()


@router.get("/", response_model=list[TopicKeywordResponse])
async def list_topic_keywords(
    is_active: bool | None = Query(default=None),
    category: str | None = Query(default=None, max_length=100),
    search: str | None = Query(default=None, max_length=255),
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("topics:read")),
):
    query = select(TopicKeyword).where(TopicKeyword.tenant_id == tenant_id)

    if is_active is not None:
        query = query.where(TopicKeyword.is_active == is_active)
    if category:
        query = query.where(TopicKeyword.category == category)
    if search:
        query = query.where(TopicKeyword.name.ilike(f"%{search}%"))

    query = query.order_by(TopicKeyword.name)
    result = await db.execute(query)
    return result.scalars().all()


@router.post(
    "/", response_model=TopicKeywordResponse, status_code=status.HTTP_201_CREATED
)
async def create_topic_keyword(
    request: TopicKeywordCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("topics:write")),
):
    # Check for duplicate name within tenant
    existing = await db.execute(
        select(TopicKeyword).where(
            TopicKeyword.tenant_id == tenant_id,
            TopicKeyword.name == request.name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="A topic with this name already exists",
        )

    topic = TopicKeyword(
        tenant_id=tenant_id,
        name=request.name,
        keywords=request.keywords,
        sentiment_direction=request.sentiment_direction,
        category=request.category,
        is_active=request.is_active,
    )
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.get("/{topic_id}", response_model=TopicKeywordResponse)
async def get_topic_keyword(
    topic_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("topics:read")),
):
    result = await db.execute(
        select(TopicKeyword).where(
            TopicKeyword.id == topic_id, TopicKeyword.tenant_id == tenant_id
        )
    )
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


@router.patch("/{topic_id}", response_model=TopicKeywordResponse)
async def update_topic_keyword(
    topic_id: UUID,
    request: TopicKeywordUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("topics:write")),
):
    result = await db.execute(
        select(TopicKeyword).where(
            TopicKeyword.id == topic_id, TopicKeyword.tenant_id == tenant_id
        )
    )
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    updates = request.model_dump(exclude_unset=True)

    # Check for duplicate name if name is being changed
    if "name" in updates and updates["name"] != topic.name:
        existing = await db.execute(
            select(TopicKeyword).where(
                TopicKeyword.tenant_id == tenant_id,
                TopicKeyword.name == updates["name"],
                TopicKeyword.id != topic_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail="A topic with this name already exists",
            )

    if "name" in updates:
        topic.name = updates["name"]
    if "keywords" in updates:
        topic.keywords = updates["keywords"]
    if "sentiment_direction" in updates:
        topic.sentiment_direction = updates["sentiment_direction"]
    if "category" in updates:
        topic.category = updates["category"]
    if "is_active" in updates:
        topic.is_active = updates["is_active"]

    await db.commit()
    await db.refresh(topic)
    return topic


@router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic_keyword(
    topic_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("topics:write")),
):
    result = await db.execute(
        select(TopicKeyword).where(
            TopicKeyword.id == topic_id, TopicKeyword.tenant_id == tenant_id
        )
    )
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    await db.delete(topic)
    await db.commit()
