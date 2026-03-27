"""Add ai_status column to raw_media_items

Revision ID: i1d9e2f3g4h5
Revises: h0c8d1e2f3g4
Create Date: 2026-03-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i1d9e2f3g4h5'
down_revision: Union[str, None] = 'h0c8d1e2f3g4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('raw_media_items', sa.Column('ai_status', sa.String(20), nullable=False, server_default=sa.text("'pending'")))
    op.create_index('ix_raw_media_items_ai_status', 'raw_media_items', ['ai_status'])


def downgrade() -> None:
    op.drop_index('ix_raw_media_items_ai_status', table_name='raw_media_items')
    op.drop_column('raw_media_items', 'ai_status')
