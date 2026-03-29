import asyncio
import json
import structlog
import httpx
from datetime import datetime, timezone, timedelta
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from handlers.base import BaseConnectorHandler
from handlers.brand24_schemas import (
    DailyMetricDay,
    DailyMetricBySource,
    DailyMetricsPayload,
    SentimentPayload,
    ReachPayload,
    TopicsPayload,
    EventsPayload,
    DomainsPayload,
    TrendingLinksPayload,
    Topic,
    ProjectEvent,
    DomainSource,
    TrendingLink,
)
from sentinel_shared.models.media import RawMediaItem
from sentinel_shared.database.session import tenant_context

logger = structlog.get_logger()

BASE_URL = "https://api-data.brand24.com/api-data/v1"
MAX_DAYS = 90

T = TypeVar("T", bound=BaseModel)


def _get_payload(body: dict) -> dict:
    """Extract payload — API uses 'message' or 'data' key."""
    return body.get("data") or body.get("message") or {}


def _parse(body: dict, model: type[T], endpoint: str) -> T | None:
    """Validate Brand24 response payload into a Pydantic model."""
    if body.get("status") != "success":
        logger.warning("brand24_bad_status", endpoint=endpoint, status=body.get("status"))
        return None
    raw = _get_payload(body)
    if isinstance(raw, str):
        return None
    try:
        return model.model_validate(raw)
    except ValidationError as exc:
        logger.warning("brand24_validation_error", endpoint=endpoint, detail=str(exc)[:300])
        return None


class Brand24Handler(BaseConnectorHandler):
    """Handler for Brand24 API Data — aggregated social media analytics."""

    async def fetch(
        self,
        config: dict,
        since: str | None,
        location_context: dict | None = None,
    ) -> list[RawMediaItem]:
        api_key = config.get("api_key")
        project_id = config.get("project_id")

        if not api_key or not project_id:
            logger.error("brand24_missing_config", has_key=bool(api_key), has_project=bool(project_id))
            return []

        tid = tenant_context.get()
        headers = {"X-Api-Key": api_key}

        # Date range
        date_to = datetime.now(timezone.utc).date()
        if since:
            try:
                date_from = datetime.fromisoformat(since.replace("Z", "+00:00")).date()
            except (ValueError, TypeError):
                date_from = date_to - timedelta(days=7)
        else:
            date_from = date_to - timedelta(days=7)

        if (date_to - date_from).days > MAX_DAYS:
            date_from = date_to - timedelta(days=MAX_DAYS)

        date_from_str = date_from.isoformat()
        date_to_str = date_to.isoformat()

        logger.info("brand24_fetch_start", project_id=project_id, date_from=date_from_str, date_to=date_to_str)

        results: list[RawMediaItem] = []

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                (
                    daily_metrics,
                    sentiment_data,
                    topics_data,
                    events_data,
                    reach_data,
                    domains_data,
                    trending_links_data,
                ) = await asyncio.gather(
                    self._fetch_daily_metrics(client, headers, project_id, date_from_str, date_to_str),
                    self._fetch_sentiment(client, headers, project_id, date_from_str, date_to_str),
                    self._fetch_topics(client, headers, project_id, date_from_str, date_to_str),
                    self._fetch_events(client, headers, project_id, date_from_str, date_to_str),
                    self._fetch_reach(client, headers, project_id, date_from_str, date_to_str),
                    self._fetch_domains(client, headers, project_id, date_from_str, date_to_str),
                    self._fetch_trending_links(client, headers, project_id, date_from_str, date_to_str),
                )

                # Lookups by date
                events_by_date: dict[str, list[ProjectEvent]] = {}
                for ev in events_data.anomalies:
                    events_by_date.setdefault(ev.anomaly_date, []).append(ev)

                most_recent_date = max((d.date for d in daily_metrics.days), default="") if daily_metrics.days else ""

                for day in daily_metrics.days:
                    if not day.date:
                        continue

                    pos = sentiment_data.positive_mentions.get(day.date, 0)
                    neg = sentiment_data.negative_mentions.get(day.date, 0)
                    neu = max(0, day.mentions_count - pos - neg)

                    social = reach_data.social_media_reach.get(day.date, 0)
                    non_social = reach_data.non_social_media_reach.get(day.date, 0)

                    day_events = events_by_date.get(day.date, [])
                    is_range = day.date == most_recent_date

                    content = _build_content(
                        day=day,
                        pos=pos, neg=neg, neu=neu,
                        social=social, non_social=non_social,
                        events=day_events,
                        topics=topics_data.topics if is_range else [],
                        domains=domains_data.domains if is_range else [],
                        links=trending_links_data.trending_links,
                    )

                    sentiment_score = round(day.sentiment.positive - day.sentiment.negative, 4)

                    # Flat list of trending URLs for AI pipeline to pick up as external_links
                    all_link_urls = [l.url for l in trending_links_data.trending_links]

                    raw_payload = {
                        "date": day.date,
                        "project_id": project_id,
                        "mentions_count": day.mentions_count,
                        "reach_total": day.reach_total,
                        "reach_breakdown": {"social": social, "non_social": non_social},
                        "sentiment": day.sentiment.model_dump(),
                        "sentiment_counts": {"positive": pos, "negative": neg, "neutral": neu},
                        "sentiment_score": sentiment_score,
                        "engagement": day.engagement.model_dump(),
                        "by_source": [s.model_dump() for s in day.by_source],
                        "events": [e.model_dump() for e in day_events],
                        "has_range_data": is_range,
                        "topics": [t.model_dump() for t in topics_data.topics] if is_range else [],
                        "domains": [d.model_dump() for d in domains_data.domains] if is_range else [],
                        "trending_links": [l.model_dump() for l in trending_links_data.trending_links],
                        "post_links": all_link_urls,
                    }

                    # Store trending link URLs — JSON array for multiple, plain string for one
                    all_urls = [l.url for l in trending_links_data.trending_links]
                    if len(all_urls) > 1:
                        url_value = json.dumps(all_urls)
                    elif all_urls:
                        url_value = all_urls[0]
                    else:
                        url_value = None

                    results.append(RawMediaItem(
                        tenant_id=tid,
                        platform="brand24",
                        external_id=f"{project_id}_{day.date}",
                        content=content,
                        author="Brand24",
                        published_at=_parse_date(day.date),
                        url=url_value,
                        engagement=day.engagement.model_dump(),
                        raw_payload=raw_payload,
                    ))

        except Exception as exc:
            logger.error("brand24_unexpected_error", error=str(exc), items_collected=len(results))

        logger.info("brand24_fetch_complete", total_items=len(results))
        return results

    # ── Fetch methods (all return typed Pydantic models) ──────────────

    async def _get(self, client: httpx.AsyncClient, headers: dict, url: str, params: dict, endpoint: str) -> dict | None:
        try:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            logger.error(f"brand24_{endpoint}_http_error", status=exc.response.status_code, body=exc.response.text[:500])
        except httpx.RequestError as exc:
            logger.error(f"brand24_{endpoint}_request_error", error=str(exc))
        return None

    async def _fetch_daily_metrics(self, client, headers, project_id, date_from, date_to) -> DailyMetricsPayload:
        body = await self._get(client, headers, f"{BASE_URL}/project/{project_id}/daily-metrics",
                               {"from": date_from, "to": date_to, "includeBySource": "true"}, "daily-metrics")
        return _parse(body, DailyMetricsPayload, "daily-metrics") if body else DailyMetricsPayload()

    async def _fetch_sentiment(self, client, headers, project_id, date_from, date_to) -> SentimentPayload:
        body = await self._get(client, headers, f"{BASE_URL}/project/{project_id}/mentions/sentiment",
                               {"date_from": date_from, "date_to": date_to}, "sentiment")
        return _parse(body, SentimentPayload, "sentiment") if body else SentimentPayload()

    async def _fetch_reach(self, client, headers, project_id, date_from, date_to) -> ReachPayload:
        body = await self._get(client, headers, f"{BASE_URL}/project/{project_id}/mentions/reach",
                               {"date_from": date_from, "date_to": date_to}, "reach")
        return _parse(body, ReachPayload, "reach") if body else ReachPayload()

    async def _fetch_topics(self, client, headers, project_id, date_from, date_to) -> TopicsPayload:
        body = await self._get(client, headers, f"{BASE_URL}/project/{project_id}/topics",
                               {"date_from": date_from, "date_to": date_to}, "topics")
        return _parse(body, TopicsPayload, "topics") if body else TopicsPayload()

    async def _fetch_events(self, client, headers, project_id, date_from, date_to) -> EventsPayload:
        body = await self._get(client, headers, f"{BASE_URL}/project/{project_id}/project_events",
                               {"date_from": date_from, "date_to": date_to}, "events")
        return _parse(body, EventsPayload, "events") if body else EventsPayload()

    async def _fetch_domains(self, client, headers, project_id, date_from, date_to) -> DomainsPayload:
        body = await self._get(client, headers, f"{BASE_URL}/project/{project_id}/domains/",
                               {"date_from": date_from, "date_to": date_to}, "domains")
        return _parse(body, DomainsPayload, "domains") if body else DomainsPayload()

    async def _fetch_trending_links(self, client, headers, project_id, date_from, date_to) -> TrendingLinksPayload:
        body = await self._get(client, headers, f"{BASE_URL}/project/{project_id}/trending-links",
                               {"date_from": date_from, "date_to": date_to}, "trending-links")
        return _parse(body, TrendingLinksPayload, "trending-links") if body else TrendingLinksPayload()


# ── Content builder ──────────────────────────────────────────────────


def _build_content(
    *,
    day: DailyMetricDay,
    pos: int,
    neg: int,
    neu: int,
    social: int,
    non_social: int,
    events: list[ProjectEvent],
    topics: list[Topic],
    domains: list[DomainSource],
    links: list[TrendingLink],
) -> str:
    """Build a readable daily briefing — topics, posts, links, engagement.

    No sentiment analysis. Focuses on what's being discussed, where,
    and links to the actual posts/articles.
    """
    parts: list[str] = []

    # ── Topics: what's being discussed ────────────────────────────────

    if topics:
        top_topic = topics[0]
        parts.append(
            f"The dominant conversation on {day.date} centered around "
            f"{top_topic.topic_name.lower()} — {top_topic.description.rstrip('.')}. "
            f"This topic accounted for {top_topic.share_of_voice:.0f}% of all "
            f"discussion with {top_topic.mentions:,} mentions."
        )

        if len(topics) > 1:
            other_lines = []
            for t in topics[1:5]:
                other_lines.append(
                    f"{t.topic_name} ({t.mentions:,} mentions, "
                    f"{t.share_of_voice:.0f}% share) — {t.description.rstrip('.')}."
                )
            parts.append(
                "Other notable conversations:\n" + "\n".join(f"• {l}" for l in other_lines)
            )
    else:
        parts.append(
            f"On {day.date}, the monitoring project tracked {day.mentions_count:,} "
            f"mentions across social media and news, reaching an estimated "
            f"{day.reach_total:,} people."
        )

    # ── Platform activity ─────────────────────────────────────────────

    if day.by_source:
        ranked = sorted(day.by_source, key=lambda s: s.mentions_count, reverse=True)
        platform_lines = []
        for s in ranked[:5]:
            pct = (s.mentions_count / day.mentions_count * 100) if day.mentions_count else 0
            platform_lines.append(
                f"{_platform_label(s.source)}: {s.mentions_count:,} mentions "
                f"({pct:.0f}%), {s.reach:,} reach"
            )
        parts.append(
            "Platform breakdown:\n" + "\n".join(f"• {l}" for l in platform_lines)
        )

    # ── Engagement ────────────────────────────────────────────────────

    eng = day.engagement
    if eng.likes or eng.comments or eng.shares:
        total_eng = eng.likes + eng.comments + eng.shares
        parts.append(
            f"Total engagement was {total_eng:,} interactions — "
            f"{eng.likes:,} likes, {eng.comments:,} comments, "
            f"and {eng.shares:,} shares."
        )

    # ── Events / anomalies ────────────────────────────────────────────

    for ev in events:
        parts.append(
            f"Alert: {ev.description.rstrip('.')}. "
            f"This spike peaked at {ev.peak_mentions:,} mentions "
            f"reaching an estimated {ev.peak_reach:,} people."
        )

    # ── Influential sources ───────────────────────────────────────────

    if domains:
        high_influence = [d for d in domains[:5] if d.influence_score >= 7]
        if high_influence:
            domain_lines = [
                f"{d.domain} — {d.mentions_count:,} mentions, "
                f"influence score {d.influence_score}/10"
                for d in high_influence
            ]
            parts.append(
                "Most influential sources covering this:\n"
                + "\n".join(f"• {l}" for l in domain_lines)
            )

    # ── Trending links ────────────────────────────────────────────────

    if links:
        link_lines = [
            f"{l.url} — shared in {l.mentions_count:,} mentions"
            for l in links[:10]
        ]
        parts.append(
            "Most shared links:\n" + "\n".join(f"• {l}" for l in link_lines)
        )

    return "\n\n".join(parts)


def _platform_label(source: str) -> str:
    """Readable platform names."""
    labels = {
        "twitter": "Twitter / X",
        "facebook": "Facebook",
        "instagram": "Instagram",
        "reddit": "Reddit",
        "youtube": "YouTube",
        "tiktok": "TikTok",
        "news": "News & Blogs",
    }
    return labels.get(source, source.title())


def _parse_date(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        logger.warning("brand24_date_parse_failed", date_str=date_str)
        return None
