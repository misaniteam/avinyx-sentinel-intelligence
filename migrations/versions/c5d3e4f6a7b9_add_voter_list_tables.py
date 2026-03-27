"""add voter_list_groups and voter_list_entries tables

Revision ID: c5d3e4f6a7b9
Revises: b4c2d3e5f7a8
Create Date: 2026-03-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5d3e4f6a7b9'
down_revision: Union[str, None] = 'b4c2d3e5f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- voter_list_groups --
    op.create_table(
        'voter_list_groups',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('tenant_id', sa.UUID(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('constituency', sa.String(255), nullable=False),
        sa.Column('file_id', sa.String(255), nullable=False),
        sa.Column('status', sa.String(50), server_default='processing', nullable=False),
        sa.Column('part_no', sa.String(50), nullable=True),
        sa.Column('part_name', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_voter_list_groups_tenant_id', 'voter_list_groups', ['tenant_id'])
    op.create_index('idx_voter_group_tenant_year', 'voter_list_groups', ['tenant_id', 'year'])

    # -- voter_list_entries --
    op.create_table(
        'voter_list_entries',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('group_id', sa.UUID(), sa.ForeignKey('voter_list_groups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('father_or_husband_name', sa.String(255), nullable=True),
        sa.Column('relation_type', sa.String(20), nullable=True),
        sa.Column('gender', sa.String(10), nullable=True),
        sa.Column('age', sa.Integer(), nullable=True),
        sa.Column('voter_no', sa.String(50), nullable=True),
        sa.Column('serial_no', sa.Integer(), nullable=True),
        sa.Column('epic_no', sa.String(50), nullable=True),
        sa.Column('house_number', sa.String(100), nullable=True),
        sa.Column('section', sa.String(50), nullable=True),
        sa.Column('status', sa.String(50), nullable=True),
        sa.Column('raw_text', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_voter_list_entries_group_id', 'voter_list_entries', ['group_id'])
    op.create_index('idx_group_serial', 'voter_list_entries', ['group_id', 'serial_no'])
    op.create_index('idx_group_voter_no', 'voter_list_entries', ['group_id', 'voter_no'])
    op.create_index('idx_epic_no', 'voter_list_entries', ['epic_no'])
    op.create_index('idx_group_epic', 'voter_list_entries', ['group_id', 'epic_no'])


def downgrade() -> None:
    op.drop_index('idx_group_epic', table_name='voter_list_entries')
    op.drop_index('idx_epic_no', table_name='voter_list_entries')
    op.drop_index('idx_group_voter_no', table_name='voter_list_entries')
    op.drop_index('idx_group_serial', table_name='voter_list_entries')
    op.drop_index('ix_voter_list_entries_group_id', table_name='voter_list_entries')
    op.drop_table('voter_list_entries')

    op.drop_index('idx_voter_group_tenant_year', table_name='voter_list_groups')
    op.drop_index('ix_voter_list_groups_tenant_id', table_name='voter_list_groups')
    op.drop_table('voter_list_groups')
