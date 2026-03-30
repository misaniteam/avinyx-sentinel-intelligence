import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sentinel_shared.models.base import TimestampMixin, TenantMixin
from sentinel_shared.database.session import Base


class DataSource(Base, TimestampMixin, TenantMixin):
    __tablename__ = "data_sources"

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
    platform = Column(String(50), nullable=False)  # youtube, twitter, news, reddit, etc.
    name = Column(String(255), nullable=False)
    config = Column(JSONB, default=dict, server_default=text("'{}'::jsonb"))
    poll_interval_minutes = Column(Integer, default=60, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    last_polled_at = Column(DateTime(timezone=True), nullable=True)
