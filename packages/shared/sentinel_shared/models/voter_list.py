import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, Index, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from sentinel_shared.models.base import TimestampMixin, TenantMixin
from sentinel_shared.database.session import Base


class VoterListGroup(Base, TimestampMixin, TenantMixin):
    __tablename__ = "voter_list_groups"

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

    year = Column(Integer, nullable=False)
    constituency = Column(String(255), nullable=False)

    file_id = Column(String(255), nullable=False)

    status = Column(
        String(50),
        nullable=False,
        default="processing",
        server_default="processing",
    )

    part_no = Column(String(50))
    part_name = Column(String(255))

    # Relationship
    entries = relationship(
        "VoterListEntry",
        back_populates="group",
        cascade="all, delete-orphan",
    )

    # Index
    __table_args__ = (
        Index("idx_voter_group_tenant_year", "tenant_id", "year"),
    )




class VoterListEntry(Base, TimestampMixin):
    __tablename__ = "voter_list_entries"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )

    group_id = Column(
        UUID(as_uuid=True),
        ForeignKey("voter_list_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Core fields
    name = Column(String(255), nullable=False)
    father_or_husband_name = Column(String(255))
    relation_type = Column(String(20))  # S/O, W/O, etc.

    gender = Column(String(10))
    age = Column(Integer)

    # Identifiers
    voter_no = Column(String(50))   # not unique
    serial_no = Column(Integer)

    epic_no = Column(String(50))   # indexed below

    # Address
    house_number = Column(String(100))

    # Metadata
    section = Column(String(50))
    status = Column(String(50))  # SHIFTED, DELETED, etc.

    # Debug / OCR trace (optional but useful)
    raw_text = Column(String)

    # Relationship
    group = relationship("VoterListGroup", back_populates="entries")

    # Indexes
    __table_args__ = (
        Index("idx_group_serial", "group_id", "serial_no"),
        Index("idx_group_voter_no", "group_id", "voter_no"),
        Index("idx_epic_no", "epic_no"),
        Index("idx_group_epic", "group_id", "epic_no"),
    )