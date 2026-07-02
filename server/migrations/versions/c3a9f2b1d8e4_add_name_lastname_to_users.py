"""add_name_lastname_to_users

Revision ID: c3a9f2b1d8e4
Revises: 4df85356b0f8
Create Date: 2026-05-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3a9f2b1d8e4'
down_revision: Union[str, None] = '4df85356b0f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('name', sa.String(length=120), nullable=False, server_default=''))
    op.add_column('users', sa.Column('last_name', sa.String(length=120), nullable=False, server_default=''))
    op.alter_column('users', 'name', server_default=None)
    op.alter_column('users', 'last_name', server_default=None)


def downgrade() -> None:
    op.drop_column('users', 'last_name')
    op.drop_column('users', 'name')
