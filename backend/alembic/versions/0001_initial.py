"""initial empty migration

Walking-skeleton baseline: proves Alembic can connect and record a revision.
Business tables from docs/database-schema.md are added in later revisions.

Revision ID: 0001
Revises:
Create Date: 2026-10-28

"""
from typing import Sequence, Union

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
