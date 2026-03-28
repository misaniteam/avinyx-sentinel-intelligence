import uuid
from sqlalchemy import Column, String, Float, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sentinel_shared.models.base import TimestampMixin, TenantMixin
from sentinel_shared.database.session import Base


class Voter(Base, TimestampMixin, TenantMixin):
    __tablename__ = "voters"

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
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    geo_lat = Column(Float, nullable=True)
    geo_lng = Column(Float, nullable=True)
    geo_region = Column(String(255), nullable=True)
    demographics = Column(JSONB, default=dict, server_default=text("'{}'::jsonb"))
    sentiment_score = Column(Float, nullable=True)
    tags = Column(JSONB, default=list, server_default=text("'[]'::jsonb"))


class VoterInteraction(Base, TimestampMixin, TenantMixin):
    __tablename__ = "voter_interactions"

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
    voter_id = Column(
        UUID(as_uuid=True),
        ForeignKey("voters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    campaign_id = Column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    interaction_type = Column(
        String(50), nullable=False
    )  # call, visit, email, sms, event
    notes = Column(Text, nullable=True)
    interaction_metadata = Column(
        "metadata", JSONB, default=dict, server_default=text("'{}'::jsonb")
    )
