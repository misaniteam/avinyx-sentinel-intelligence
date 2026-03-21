"""add constituency_code to tenants

Revision ID: a3b1c2d4e5f6
Revises: 6e74ac702418
Create Date: 2026-03-21 19:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3b1c2d4e5f6'
down_revision: Union[str, None] = '6e74ac702418'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('constituency_code', sa.String(10), nullable=True))
    op.create_index('ix_tenants_constituency_code', 'tenants', ['constituency_code'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_tenants_constituency_code', table_name='tenants')
    op.drop_column('tenants', 'constituency_code')
