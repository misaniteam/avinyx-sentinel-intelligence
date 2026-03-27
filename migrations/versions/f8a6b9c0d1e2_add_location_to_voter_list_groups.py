"""Add location fields to voter_list_groups

Revision ID: f8a6b9c0d1e2
Revises: c5d3e4f6a7b9
Create Date: 2026-03-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8a6b9c0d1e2'
down_revision: Union[str, None] = 'c5d3e4f6a7b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('voter_list_groups', sa.Column('location_name', sa.String(500), nullable=True))
    op.add_column('voter_list_groups', sa.Column('location_lat', sa.Float(), nullable=True))
    op.add_column('voter_list_groups', sa.Column('location_lng', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('voter_list_groups', 'location_lng')
    op.drop_column('voter_list_groups', 'location_lat')
    op.drop_column('voter_list_groups', 'location_name')
