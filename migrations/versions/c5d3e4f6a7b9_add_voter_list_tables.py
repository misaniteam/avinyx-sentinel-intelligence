"""add voter_list_groups and voter_list_entries tables

Revision ID: c5d3e4f6a7b9
Revises: b4c2d3e5f7a8
Create Date: 2026-03-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "c5d3e4f6a7b9"
down_revision: Union[str, None] = "b4c2d3e5f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "voter_list_groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("constituency", sa.String(length=255), nullable=False),
        sa.Column("file_id", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), server_default="processing", nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_voter_list_groups_tenant_id", "voter_list_groups", ["tenant_id"])

    op.create_table(
        "voter_list_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("father_or_husband_name", sa.String(length=255), nullable=True),
        sa.Column("gender", sa.String(length=10), nullable=True),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column("voter_no", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["voter_list_groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_voter_list_entries_group_id", "voter_list_entries", ["group_id"])


def downgrade() -> None:
    op.drop_index("ix_voter_list_entries_group_id", table_name="voter_list_entries")
    op.drop_table("voter_list_entries")
    op.drop_index("ix_voter_list_groups_tenant_id", table_name="voter_list_groups")
    op.drop_table("voter_list_groups")
