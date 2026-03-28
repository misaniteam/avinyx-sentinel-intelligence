import uuid
import enum
from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    ForeignKey,
    Enum as SAEnum,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sentinel_shared.models.base import TimestampMixin, TenantMixin
from sentinel_shared.database.session import Base


class WorkerRunStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class WorkerRun(Base, TimestampMixin, TenantMixin):
    __tablename__ = "worker_runs"

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
        nullable=False,
        index=True,
    )
    status = Column(
        SAEnum(WorkerRunStatus), default=WorkerRunStatus.PENDING, nullable=False
    )
    items_fetched = Column(Integer, default=0, nullable=False)
    items_processed = Column(Integer, default=0, nullable=False)
    error_message = Column(String(1000), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
