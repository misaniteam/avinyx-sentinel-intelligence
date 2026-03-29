import uuid
from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sentinel_shared.models.base import TimestampMixin, TenantMixin
from sentinel_shared.database.session import Base


class RawMediaItem(Base, TimestampMixin, TenantMixin):
    __tablename__ = "raw_media_items"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "platform", "external_id", name="uq_media_tenant_platform_ext"
        ),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    data_source_id = Column(
        UUID(as_uuid=True),
        ForeignKey("data_sources.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    platform = Column(String(50), nullable=False, index=True)
    external_id = Column(String(1024), nullable=False)
    content = Column(Text, nullable=True)
    author = Column(String(512), nullable=True)
    author_id = Column(String(512), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    url = Column(Text, nullable=True)
    geo_lat = Column(Float, nullable=True)
    geo_lng = Column(Float, nullable=True)
    geo_region = Column(String(255), nullable=True)
    engagement = Column(JSONB, default=dict, server_default=text("'{}'::jsonb"))
    raw_payload = Column(JSONB, nullable=True)
    ai_status = Column(
        String(20), nullable=False, server_default=text("'pending'"), index=True
    )  # pending, processing, completed, failed


class SentimentAnalysis(Base, TimestampMixin, TenantMixin):
    __tablename__ = "sentiment_analyses"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    media_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("raw_media_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ai_provider = Column(String(50), nullable=False)
    sentiment_score = Column(Float, nullable=False)  # -1.0 to 1.0
    sentiment_label = Column(String(20), nullable=False)  # positive, negative, neutral
    topics = Column(JSONB, default=list, server_default=text("'[]'::jsonb"))
    entities = Column(JSONB, default=list, server_default=text("'[]'::jsonb"))
    summary = Column(Text, nullable=True)


class SentimentAggregate(Base, TimestampMixin, TenantMixin):
    __tablename__ = "sentiment_aggregates"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "period",
            "period_start",
            "platform",
            "region",
            name="uq_sentiment_agg",
        ),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    period = Column(String(20), nullable=False)  # hourly, daily, weekly
    period_start = Column(DateTime(timezone=True), nullable=False)
    platform = Column(String(50), nullable=True)
    region = Column(String(255), nullable=True)
    avg_sentiment = Column(Float, nullable=False, default=0.0)
    positive_count = Column(Integer, nullable=False, default=0)
    negative_count = Column(Integer, nullable=False, default=0)
    neutral_count = Column(Integer, nullable=False, default=0)
    total_count = Column(Integer, nullable=False, default=0)


class MediaFeed(Base, TimestampMixin, TenantMixin):
    __tablename__ = "media_feeds"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    media_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("raw_media_items.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Denormalized from RawMediaItem
    platform = Column(String(50), nullable=False, index=True)
    author = Column(String(512), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True, index=True)
    engagement = Column(JSONB, default=dict, server_default=text("'{}'::jsonb"))

    # AI-extracted fields
    title = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    source_link = Column(Text, nullable=True)
    external_links = Column(JSONB, default=list, server_default=text("'[]'::jsonb"))

    # Sentiment (populated by AI pipeline)
    sentiment_score = Column(Float, nullable=True)
    sentiment_label = Column(String(20), nullable=True)

    # Priority (populated in future step)
    priority_score = Column(Float, nullable=True)

    # AI metadata
    ai_provider = Column(String(50), nullable=True)
    topics = Column(JSONB, default=list, server_default=text("'[]'::jsonb"))
    entities = Column(JSONB, default=list, server_default=text("'[]'::jsonb"))
    summary = Column(Text, nullable=True)
