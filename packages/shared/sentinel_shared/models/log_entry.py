import uuid
from sqlalchemy import Column, String, Text, DateTime, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sentinel_shared.models.base import TimestampMixin
from sentinel_shared.database.session import Base


class LogEntry(Base, TimestampMixin):
    __tablename__ = "log_entries"
    __table_args__ = (
        Index("ix_log_entries_service_level", "service", "level"),
        Index("ix_log_entries_tenant_timestamp", "tenant_id", "timestamp"),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    service = Column(String(100), nullable=False, index=True)
    level = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    tenant_id = Column(UUID(as_uuid=True), nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    context = Column(JSONB, default=dict, server_default=text("'{}'::jsonb"))
    trace_id = Column(String(64), nullable=True)
