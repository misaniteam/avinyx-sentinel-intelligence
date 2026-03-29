"""Add data_source_id to raw_media_items

Revision ID: k3f1g4h5i6j7
Revises: j2e0f3g4h5i6
Create Date: 2026-03-29 19:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "k3f1g4h5i6j7"
down_revision: Union[str, None] = "j2e0f3g4h5i6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "raw_media_items",
        sa.Column("data_source_id", sa.UUID(), nullable=True),
    )
    op.create_index(
        op.f("ix_raw_media_items_data_source_id"),
        "raw_media_items",
        ["data_source_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_raw_media_items_data_source_id",
        "raw_media_items",
        "data_sources",
        ["data_source_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_raw_media_items_data_source_id", "raw_media_items", type_="foreignkey"
    )
    op.drop_index(
        op.f("ix_raw_media_items_data_source_id"), table_name="raw_media_items"
    )
    op.drop_column("raw_media_items", "data_source_id")
