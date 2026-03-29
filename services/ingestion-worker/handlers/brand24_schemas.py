"""Pydantic v2 models for Brand24 API Data responses.

Matches the OpenAPI spec at https://api-data.brand24.com.
All fields have defaults so parsing never fails on missing optional data.
"""

from __future__ import annotations

from pydantic import BaseModel


# ── Daily Metrics (/project/{id}/daily-metrics) ──────────────────────────


class DailyMetricSentiment(BaseModel):
    positive: float = 0
    neutral: float = 0
    negative: float = 0


class DailyMetricEngagement(BaseModel):
    likes: int = 0
    comments: int = 0
    shares: int = 0


class DailyMetricBySource(BaseModel):
    source: str
    mentions_count: int = 0
    reach: int = 0


class DailyMetricDay(BaseModel):
    date: str
    mentions_count: int = 0
    reach_total: int = 0
    sentiment: DailyMetricSentiment = DailyMetricSentiment()
    engagement: DailyMetricEngagement = DailyMetricEngagement()
    by_source: list[DailyMetricBySource] = []


class DailyMetricsPayload(BaseModel):
    project_id: int | None = None
    from_: str | None = None
    to: str | None = None
    days: list[DailyMetricDay] = []

    model_config = {"populate_by_name": True}


# ── Mentions Sentiment (/project/{id}/mentions/sentiment) ────────────────


class SentimentPayload(BaseModel):
    mentions: dict[str, int] = {}
    total_mentions: int = 0
    positive_mentions: dict[str, int] = {}
    total_positive_mentions: int = 0
    negative_mentions: dict[str, int] = {}
    total_negative_results: int = 0


# ── Mentions Reach (/project/{id}/mentions/reach) ────────────────────────


class ReachPayload(BaseModel):
    social_media_reach: dict[str, int] = {}
    social_media_reach_total: int = 0
    non_social_media_reach: dict[str, int] = {}
    non_social_media_reach_total: int = 0


# ── Topics (/project/{id}/topics) ────────────────────────────────────────


class TopicSentiment(BaseModel):
    positive: float = 0
    negative: float = 0
    neutral: float = 0


class Topic(BaseModel):
    topic_id: int
    topic_name: str
    description: str = ""
    mentions: int = 0
    reach: float = 0
    sentiment: TopicSentiment = TopicSentiment()
    share_of_voice: float = 0


class TopicsPayload(BaseModel):
    project_id: int | None = None
    status: str = "unavailable"
    topics: list[Topic] = []


# ── Project Events (/project/{id}/project_events) ───────────────────────


class ProjectEvent(BaseModel):
    anomaly_date: str
    project_id: int | None = None
    description: str = ""
    peak_mentions: int = 0
    peak_reach: int = 0


class EventsPayload(BaseModel):
    project_id: str | int | None = None
    project_name: str = ""
    anomalies: list[ProjectEvent] = []
    total: int = 0


# ── Domains (/project/{id}/domains/) ─────────────────────────────────────


class DomainSource(BaseModel):
    domain: str
    mentions_count: int = 0
    reach: float = 0
    visits: int = 0
    influence_score: int = 0


class DomainsPayload(BaseModel):
    project_id: int | None = None
    domains: list[DomainSource] = []
    total_domains: int = 0


# ── Trending Links (/project/{id}/trending-links) ────────────────────────


class TrendingLink(BaseModel):
    url: str
    mentions_count: int = 0


class TrendingLinksPayload(BaseModel):
    project_id: int | None = None
    trending_links: list[TrendingLink] = []
    total_links: int = 0
