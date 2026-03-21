import uuid
import enum
from sqlalchemy import Column, String, Enum as SAEnum, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sentinel_shared.models.base import TimestampMixin
from sentinel_shared.database.session import Base


class TenantStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class Tenant(Base, TimestampMixin):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    status = Column(SAEnum(TenantStatus), default=TenantStatus.ACTIVE, nullable=False)
    settings = Column(JSONB, default=dict, server_default=text("'{}'::jsonb"))
    constituency_code = Column(String(10), unique=True, nullable=True, index=True)
