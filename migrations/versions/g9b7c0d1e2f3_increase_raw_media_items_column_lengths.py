"""Increase raw_media_items column lengths for long external IDs and authors

Revision ID: g9b7c0d1e2f3
Revises: f8a6b9c0d1e2
Create Date: 2026-03-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g9b7c0d1e2f3'
down_revision: Union[str, None] = 'f8a6b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('raw_media_items', 'external_id',
                    existing_type=sa.String(255),
                    type_=sa.String(1024),
                    existing_nullable=False)
    op.alter_column('raw_media_items', 'author',
                    existing_type=sa.String(255),
                    type_=sa.String(512),
                    existing_nullable=True)
    op.alter_column('raw_media_items', 'author_id',
                    existing_type=sa.String(255),
                    type_=sa.String(512),
                    existing_nullable=True)


def downgrade() -> None:
    op.alter_column('raw_media_items', 'external_id',
                    existing_type=sa.String(1024),
                    type_=sa.String(255),
                    existing_nullable=False)
    op.alter_column('raw_media_items', 'author',
                    existing_type=sa.String(512),
                    type_=sa.String(255),
                    existing_nullable=True)
    op.alter_column('raw_media_items', 'author_id',
                    existing_type=sa.String(512),
                    type_=sa.String(255),
                    existing_nullable=True)
