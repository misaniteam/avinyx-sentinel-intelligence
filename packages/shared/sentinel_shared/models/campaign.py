import uuid
import enum
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Enum as SAEnum, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sentinel_shared.models.base import TimestampMixin, TenantMixin
from sentinel_shared.database.session import Base


class CampaignStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


class Campaign(Base, TimestampMixin, TenantMixin):
    __tablename__ = "campaigns"

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
    description = Column(Text, nullable=True)
    status = Column(
        SAEnum(CampaignStatus), default=CampaignStatus.DRAFT, nullable=False
    )
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    target_regions = Column(JSONB, default=list, server_default=text("'[]'::jsonb"))
    keywords = Column(JSONB, default=list, server_default=text("'[]'::jsonb"))
    settings = Column(JSONB, default=dict, server_default=text("'{}'::jsonb"))
