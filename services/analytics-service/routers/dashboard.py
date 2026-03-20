from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sentinel_shared.database.session import get_db
from sentinel_shared.models.media import SentimentAnalysis, SentimentAggregate, RawMediaItem
from sentinel_shared.auth.dependencies import get_current_tenant, require_permissions

router = APIRouter()

@router.get("/summary")
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("dashboard:view")),
):
    # Total media items
    total_result = await db.execute(
        select(func.count()).select_from(RawMediaItem).where(RawMediaItem.tenant_id == tenant_id)
    )
    total_items = total_result.scalar() or 0

    # Average sentiment
    avg_result = await db.execute(
        select(func.avg(SentimentAnalysis.sentiment_score)).where(SentimentAnalysis.tenant_id == tenant_id)
    )
    avg_sentiment = avg_result.scalar() or 0.0

    # Sentiment distribution
    pos_result = await db.execute(
        select(func.count()).select_from(SentimentAnalysis)
        .where(SentimentAnalysis.tenant_id == tenant_id, SentimentAnalysis.sentiment_label == "positive")
    )
    neg_result = await db.execute(
        select(func.count()).select_from(SentimentAnalysis)
        .where(SentimentAnalysis.tenant_id == tenant_id, SentimentAnalysis.sentiment_label == "negative")
    )
    neu_result = await db.execute(
        select(func.count()).select_from(SentimentAnalysis)
        .where(SentimentAnalysis.tenant_id == tenant_id, SentimentAnalysis.sentiment_label == "neutral")
    )

    return {
        "total_media_items": total_items,
        "avg_sentiment": round(float(avg_sentiment), 3),
        "sentiment_distribution": {
            "positive": pos_result.scalar() or 0,
            "negative": neg_result.scalar() or 0,
            "neutral": neu_result.scalar() or 0,
        },
    }

@router.get("/trends")
async def sentiment_trends(
    period: str = Query("daily", regex="^(hourly|daily|weekly)$"),
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("dashboard:view")),
):
    result = await db.execute(
        select(SentimentAggregate)
        .where(SentimentAggregate.tenant_id == tenant_id, SentimentAggregate.period == period)
        .order_by(SentimentAggregate.period_start.desc())
        .limit(30)
    )
    aggregates = result.scalars().all()
    return [
        {
            "period_start": str(a.period_start),
            "platform": a.platform,
            "region": a.region,
            "avg_sentiment": a.avg_sentiment,
            "total_count": a.total_count,
        }
        for a in aggregates
    ]
