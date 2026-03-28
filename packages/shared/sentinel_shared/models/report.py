import uuid
import enum
from sqlalchemy import Column, String, ForeignKey, Enum as SAEnum, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sentinel_shared.models.base import TimestampMixin, TenantMixin
from sentinel_shared.database.session import Base


class ReportFormat(str, enum.Enum):
    PDF = "pdf"
    IMAGE = "image"
    CSV = "csv"


class Report(Base, TimestampMixin, TenantMixin):
    __tablename__ = "reports"

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
    config = Column(JSONB, default=dict, server_default=text("'{}'::jsonb"))
    generated_file = Column(String(500), nullable=True)  # S3 key
    format = Column(SAEnum(ReportFormat), nullable=False)
    status = Column(String(50), default="pending", nullable=False)
