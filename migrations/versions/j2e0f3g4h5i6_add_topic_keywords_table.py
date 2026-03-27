"""Add topic_keywords table

Revision ID: j2e0f3g4h5i6
Revises: i1d9e2f3g4h5
Create Date: 2026-03-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = 'j2e0f3g4h5i6'
down_revision: Union[str, None] = 'i1d9e2f3g4h5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'topic_keywords',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('keywords', JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column('sentiment_direction', sa.String(20), nullable=False),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint('uq_topic_keywords_tenant_name', 'topic_keywords', ['tenant_id', 'name'])


def downgrade() -> None:
    op.drop_table('topic_keywords')
