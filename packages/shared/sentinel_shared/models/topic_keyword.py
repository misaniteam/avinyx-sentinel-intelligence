import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sentinel_shared.models.base import TimestampMixin, TenantMixin
from sentinel_shared.database.session import Base


class TopicKeyword(Base, TimestampMixin, TenantMixin):
    __tablename__ = "topic_keywords"

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
    name = Column(String(255), nullable=False)
    keywords = Column(JSONB, default=list, server_default=text("'[]'::jsonb"))
    sentiment_direction = Column(
        String(20), nullable=False
    )  # positive, negative, neutral
    category = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_topic_keywords_tenant_name"),
    )
