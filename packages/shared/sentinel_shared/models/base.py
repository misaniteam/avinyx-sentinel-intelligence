from sqlalchemy import Column, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sentinel_shared.database.session import Base


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class TenantMixin:
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
