"""add log_entries table

Revision ID: b4c2d3e5f7a8
Revises: a3b1c2d4e5f6
Create Date: 2026-03-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b4c2d3e5f7a8'
down_revision: Union[str, None] = 'a3b1c2d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'log_entries',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('service', sa.String(100), nullable=False),
        sa.Column('level', sa.String(20), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('context', postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=True),
        sa.Column('trace_id', sa.String(64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_log_entries_service', 'log_entries', ['service'])
    op.create_index('ix_log_entries_timestamp', 'log_entries', ['timestamp'])
    op.create_index('ix_log_entries_service_level', 'log_entries', ['service', 'level'])
    op.create_index('ix_log_entries_tenant_timestamp', 'log_entries', ['tenant_id', 'timestamp'])


def downgrade() -> None:
    op.drop_index('ix_log_entries_tenant_timestamp', table_name='log_entries')
    op.drop_index('ix_log_entries_service_level', table_name='log_entries')
    op.drop_index('ix_log_entries_timestamp', table_name='log_entries')
    op.drop_index('ix_log_entries_service', table_name='log_entries')
    op.drop_table('log_entries')
