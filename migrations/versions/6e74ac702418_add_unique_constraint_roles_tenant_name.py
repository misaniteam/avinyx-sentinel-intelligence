"""add unique constraint on roles tenant_id and name

Revision ID: 6e74ac702418
Revises: 1c3a7f6385e7
Create Date: 2026-03-21 11:22:44.811216

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '6e74ac702418'
down_revision: Union[str, None] = '1c3a7f6385e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint('uq_roles_tenant_name', 'roles', ['tenant_id', 'name'])


def downgrade() -> None:
    op.drop_constraint('uq_roles_tenant_name', 'roles', type_='unique')
