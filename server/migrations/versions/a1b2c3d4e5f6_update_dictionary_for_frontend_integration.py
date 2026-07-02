"""update_dictionary_for_frontend_integration

Revision ID: a1b2c3d4e5f6
Revises: c3a9f2b1d8e4
Create Date: 2026-05-25 00:00:00.000000

Changes:
- Rename kind enum string values to frontend slugs
- Add description column to dictionary_entries
- Create dictionary_applications table
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "c3a9f2b1d8e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Rename kind string values to frontend slugs
    op.execute("UPDATE dictionary_entries SET kind = 'mappings'   WHERE kind = 'NORMALIZATION_PRESET'")
    op.execute("UPDATE dictionary_entries SET kind = 'categories' WHERE kind = 'CATEGORY_LIST'")
    op.execute("UPDATE dictionary_entries SET kind = 'context'    WHERE kind = 'CLASSIFICATION_INSTRUCTION'")

    # 2. Add description column (NOT NULL with default so existing rows get '')
    op.add_column(
        "dictionary_entries",
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
    )

    # 3. Create dictionary_applications table
    op.create_table(
        "dictionary_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entry_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("column_name", sa.String(80), nullable=False),
        sa.Column(
            "applied_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["entry_id"], ["dictionary_entries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entry_id", "project_id", "column_name", name="uq_dict_application"),
    )
    op.create_index("idx_dict_app_entry", "dictionary_applications", ["entry_id"])
    op.create_index("idx_dict_app_project", "dictionary_applications", ["project_id"])


def downgrade() -> None:
    op.drop_table("dictionary_applications")

    op.drop_column("dictionary_entries", "description")

    op.execute("UPDATE dictionary_entries SET kind = 'NORMALIZATION_PRESET'       WHERE kind = 'mappings'")
    op.execute("UPDATE dictionary_entries SET kind = 'CATEGORY_LIST'              WHERE kind = 'categories'")
    op.execute("UPDATE dictionary_entries SET kind = 'CLASSIFICATION_INSTRUCTION' WHERE kind = 'context'")
