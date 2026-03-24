"""add house_number and relation_type to voter_list_entries

Revision ID: d6e4f5a7b8c0
Revises: c5d3e4f6a7b9
Create Date: 2026-03-24 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d6e4f5a7b8c0"
down_revision: Union[str, None] = "c5d3e4f6a7b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("voter_list_entries", sa.Column("house_number", sa.String(length=100), nullable=True))
    op.add_column("voter_list_entries", sa.Column("relation_type", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("voter_list_entries", "relation_type")
    op.drop_column("voter_list_entries", "house_number")
