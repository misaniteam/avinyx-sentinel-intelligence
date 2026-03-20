import uuid
from sqlalchemy import Column, String, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sentinel_shared.models.base import TimestampMixin, TenantMixin
from sentinel_shared.database.session import Base
from sentinel_shared.models.user import user_roles


class Role(Base, TimestampMixin, TenantMixin):
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    permissions = Column(JSONB, default=list, server_default=text("'[]'::jsonb"))

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    users = relationship("User", secondary=user_roles, back_populates="roles", lazy="selectin")
