"""add part_no and part_name to voter_list_groups

Revision ID: e7f5a6b8c9d1
Revises: d6e4f5a7b8c0
Create Date: 2026-03-24 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e7f5a6b8c9d1"
down_revision: Union[str, None] = "d6e4f5a7b8c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("voter_list_groups", sa.Column("part_no", sa.String(length=50), nullable=True))
    op.add_column("voter_list_groups", sa.Column("part_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("voter_list_groups", "part_name")
    op.drop_column("voter_list_groups", "part_no")
