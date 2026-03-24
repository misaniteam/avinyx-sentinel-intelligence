import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sentinel_shared.models.base import TimestampMixin, TenantMixin
from sentinel_shared.database.session import Base


class VoterListGroup(Base, TimestampMixin, TenantMixin):
    __tablename__ = "voter_list_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    year = Column(Integer, nullable=False)
    constituency = Column(String(255), nullable=False)
    file_id = Column(String(255), nullable=False)
    status = Column(String(50), default="processing", server_default="processing")


class VoterListEntry(Base, TimestampMixin):
    __tablename__ = "voter_list_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    group_id = Column(UUID(as_uuid=True), ForeignKey("voter_list_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    father_or_husband_name = Column(String(255), nullable=True)
    gender = Column(String(10), nullable=True)
    age = Column(Integer, nullable=True)
    voter_no = Column(String(50), nullable=True)
    house_number = Column(String(100), nullable=True)
    relation_type = Column(String(20), nullable=True)
