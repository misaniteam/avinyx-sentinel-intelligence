"""Add media_feeds table for AI-enriched content

Revision ID: h0c8d1e2f3g4
Revises: g9b7c0d1e2f3
Create Date: 2026-03-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = 'h0c8d1e2f3g4'
down_revision: Union[str, None] = 'g9b7c0d1e2f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'media_feeds',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('media_item_id', UUID(as_uuid=True), sa.ForeignKey('raw_media_items.id', ondelete='CASCADE'), nullable=False, unique=True, index=True),

        # Denormalized from RawMediaItem
        sa.Column('platform', sa.String(50), nullable=False, index=True),
        sa.Column('author', sa.String(512), nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('engagement', JSONB, server_default=sa.text("'{}'::jsonb")),

        # AI-extracted fields
        sa.Column('title', sa.Text, nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('image_url', sa.Text, nullable=True),
        sa.Column('source_link', sa.Text, nullable=True),
        sa.Column('external_links', JSONB, server_default=sa.text("'[]'::jsonb")),

        # Sentiment
        sa.Column('sentiment_score', sa.Float, nullable=True),
        sa.Column('sentiment_label', sa.String(20), nullable=True),

        # Priority (future)
        sa.Column('priority_score', sa.Float, nullable=True),

        # AI metadata
        sa.Column('ai_provider', sa.String(50), nullable=True),
        sa.Column('topics', JSONB, server_default=sa.text("'[]'::jsonb")),
        sa.Column('entities', JSONB, server_default=sa.text("'[]'::jsonb")),
        sa.Column('summary', sa.Text, nullable=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('media_feeds')
