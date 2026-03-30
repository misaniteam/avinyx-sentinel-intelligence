import json
import time
import structlog

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sentinel_shared.database.session import get_db
from sentinel_shared.models.media import (
    SentimentAnalysis,
    SentimentAggregate,
    RawMediaItem,
    MediaFeed,
)
from sentinel_shared.models.tenant import Tenant
from sentinel_shared.models.topic_keyword import TopicKeyword
from sentinel_shared.ai.factory import AIProviderFactory
from sentinel_shared.ai.claude_provider import ClaudeProvider
from sentinel_shared.ai.openai_provider import OpenAIProvider
from sentinel_shared.ai.bedrock_provider import BedrockProvider
from sentinel_shared.auth.dependencies import get_current_tenant, require_permissions
from pydantic import BaseModel

logger = structlog.get_logger()

# Register AI providers
AIProviderFactory.register("claude", ClaudeProvider)
AIProviderFactory.register("openai", OpenAIProvider)
AIProviderFactory.register("bedrock", BedrockProvider)

router = APIRouter()

# Simple in-memory cache for negative analysis (tenant_id -> (timestamp, result))
_analysis_cache: dict[str, tuple[float, dict]] = {}
CACHE_TTL = 900  # 15 minutes


@router.get("/summary")
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("dashboard:view")),
):
    # Total media items
    total_result = await db.execute(
        select(func.count())
        .select_from(RawMediaItem)
        .where(RawMediaItem.tenant_id == tenant_id)
    )
    total_items = total_result.scalar() or 0

    # Average sentiment
    avg_result = await db.execute(
        select(func.avg(SentimentAnalysis.sentiment_score)).where(
            SentimentAnalysis.tenant_id == tenant_id
        )
    )
    avg_sentiment = avg_result.scalar() or 0.0

    # Sentiment distribution
    pos_result = await db.execute(
        select(func.count())
        .select_from(SentimentAnalysis)
        .where(
            SentimentAnalysis.tenant_id == tenant_id,
            SentimentAnalysis.sentiment_label == "positive",
        )
    )
    neg_result = await db.execute(
        select(func.count())
        .select_from(SentimentAnalysis)
        .where(
            SentimentAnalysis.tenant_id == tenant_id,
            SentimentAnalysis.sentiment_label == "negative",
        )
    )
    neu_result = await db.execute(
        select(func.count())
        .select_from(SentimentAnalysis)
        .where(
            SentimentAnalysis.tenant_id == tenant_id,
            SentimentAnalysis.sentiment_label == "neutral",
        )
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
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("dashboard:view")),
):
    """Aggregate sentiment trends from media_feeds grouped by period and platform."""
    from datetime import datetime, timedelta

    period_trunc = {
        "hourly": "hour",
        "daily": "day",
        "weekly": "week",
    }[period]

    filters = [
        MediaFeed.tenant_id == tenant_id,
        MediaFeed.published_at.isnot(None),
        MediaFeed.sentiment_score.isnot(None),
    ]

    if date_from:
        filters.append(MediaFeed.published_at >= datetime.fromisoformat(date_from))
    if date_to:
        # Include the entire end date
        filters.append(
            MediaFeed.published_at < datetime.fromisoformat(date_to) + timedelta(days=1)
        )

    period_start_col = func.date_trunc(period_trunc, MediaFeed.published_at).label(
        "period_start"
    )

    result = await db.execute(
        select(
            period_start_col,
            MediaFeed.platform,
            func.avg(MediaFeed.sentiment_score).label("avg_sentiment"),
            func.count().label("total_count"),
        )
        .where(*filters)
        .group_by(period_start_col, MediaFeed.platform)
        .order_by(period_start_col.desc())
        .limit(200)
    )
    rows = result.all()

    return [
        {
            "period_start": str(row.period_start),
            "platform": row.platform,
            "region": None,
            "avg_sentiment": round(float(row.avg_sentiment), 4),
            "total_count": row.total_count,
        }
        for row in rows
    ]


# -------------------------
# NEGATIVE ANALYSIS
# -------------------------

NEGATIVE_ANALYSIS_SYSTEM = """You are a political campaign strategist analyzing negative media coverage.
You will receive up to 10 negative articles/posts about the candidate or their party.

Analyze them and return a JSON object with exactly these keys:
1. "negative_points": An array of objects, each representing a distinct negative theme found across the articles. Each object has:
   - "theme": string (short title of the negative theme, e.g., "Corruption allegations")
   - "severity": "high" | "medium" | "low" (based on reach and potential damage)
   - "summary": string (2-3 sentence explanation of what the negative coverage is about)
   - "sources_count": number (how many of the input articles mention this theme)
   - "sample_titles": array of strings (1-2 article titles that best represent this theme)

2. "actionables": An array of objects, each a recommended counter-action. Each object has:
   - "action": string (specific, actionable recommendation)
   - "priority": "urgent" | "high" | "medium" (how quickly this should be addressed)
   - "type": "public_statement" | "policy_response" | "social_media" | "community_outreach" | "legal" | "internal"
   - "addresses_themes": array of strings (which negative themes from "negative_points" this action addresses)

3. "overall_threat_level": "critical" | "high" | "moderate" | "low" (overall assessment)
4. "summary": string (2-3 sentence executive summary of the negative landscape)

Group similar articles into common themes. Be specific and actionable. Return only valid JSON."""


class NegativePoint(BaseModel):
    theme: str
    severity: str
    summary: str
    sources_count: int
    sample_titles: list[str] = []


class Actionable(BaseModel):
    action: str
    priority: str
    type: str
    addresses_themes: list[str] = []


class NegativeAnalysisResponse(BaseModel):
    negative_points: list[NegativePoint] = []
    actionables: list[Actionable] = []
    overall_threat_level: str = "low"
    summary: str = ""
    analyzed_count: int = 0


@router.get("/negative-analysis", response_model=NegativeAnalysisResponse)
async def negative_analysis(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("dashboard:view")),
    refresh: bool = Query(False),
):
    """Analyze top negative articles and provide actionable insights."""

    # Check cache
    if not refresh and tenant_id in _analysis_cache:
        cached_at, cached_result = _analysis_cache[tenant_id]
        if time.time() - cached_at < CACHE_TTL:
            return NegativeAnalysisResponse(**cached_result)

    # Fetch top 10 negative media feeds (most negative first)
    result = await db.execute(
        select(MediaFeed)
        .where(
            MediaFeed.tenant_id == tenant_id,
            MediaFeed.sentiment_label == "negative",
        )
        .order_by(MediaFeed.sentiment_score.asc())
        .limit(10)
    )
    feeds = result.scalars().all()

    if not feeds:
        empty = NegativeAnalysisResponse(summary="No negative articles found.")
        return empty

    # Deduplicate by title
    seen_titles: set[str] = set()
    unique_feeds = []
    for feed in feeds:
        title_key = (feed.title or "").strip().lower()
        if title_key and title_key in seen_titles:
            continue
        seen_titles.add(title_key)
        unique_feeds.append(feed)

    # Build user content with all articles
    articles_text = []
    for i, feed in enumerate(unique_feeds):
        parts = [f"--- ARTICLE {i + 1} ---"]
        if feed.title:
            parts.append(f"Title: {feed.title}")
        if feed.description:
            parts.append(f"Content: {feed.description[:1000]}")
        if feed.summary:
            parts.append(f"AI Summary: {feed.summary}")
        parts.append(f"Platform: {feed.platform}")
        parts.append(f"Sentiment Score: {feed.sentiment_score}")
        if feed.topics:
            parts.append(f"Topics: {', '.join(feed.topics)}")
        if feed.author:
            parts.append(f"Author: {feed.author}")
        if feed.published_at:
            parts.append(f"Published: {feed.published_at.isoformat()}")
        articles_text.append("\n".join(parts))

    user_content = "\n\n".join(articles_text)

    # Get tenant AI provider config
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    ai_provider_name = (
        (tenant.settings or {}).get("ai_provider", "bedrock") if tenant else "bedrock"
    )
    ai_config = (tenant.settings or {}).get("ai_config", {}) if tenant else {}

    # Add topic keywords context
    tk_result = await db.execute(
        select(TopicKeyword).where(
            TopicKeyword.tenant_id == tenant_id,
            TopicKeyword.is_active.is_(True),
        )
    )
    topic_keywords = tk_result.scalars().all()

    system_prompt = NEGATIVE_ANALYSIS_SYSTEM
    if topic_keywords:
        context_lines = ["\n\nCANDIDATE CONTEXT:"]
        for tk in topic_keywords:
            direction = tk.sentiment_direction
            keywords = ", ".join(tk.keywords) if tk.keywords else ""
            context_lines.append(
                f'- "{tk.name}" ({direction}){f" — keywords: {keywords}" if keywords else ""}'
            )
        system_prompt += "\n".join(context_lines)

    # Call AI provider
    try:
        provider = AIProviderFactory.get_provider(ai_provider_name, ai_config)
        response_text = await provider._invoke(
            system_prompt, user_content, max_tokens=4096
        )
        data = json.loads(response_text)
        data["analyzed_count"] = len(unique_feeds)

        # Cache result
        _analysis_cache[tenant_id] = (time.time(), data)

        return NegativeAnalysisResponse(**data)
    except Exception as e:
        logger.error(
            "negative_analysis_failed",
            tenant_id=tenant_id,
            error=str(e),
        )
        return NegativeAnalysisResponse(
            summary=f"Analysis temporarily unavailable. {len(unique_feeds)} negative articles found.",
            analyzed_count=len(unique_feeds),
        )
