"""add classification_metrics to report_executions

Revision ID: b7e93f1c2a05
Revises: a1b2c3d4e5f6
Create Date: 2026-05-29 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b7e93f1c2a05"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "report_executions",
        sa.Column(
            "classification_metrics",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("report_executions", "classification_metrics")
