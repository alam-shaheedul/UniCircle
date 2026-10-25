"""Establish the migration history before feature tables are approved.

Revision ID: 20260920_0001
Revises:
Create Date: 2026-09-20
"""

from collections.abc import Sequence

revision: str = "20260920_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Intentionally no domain tables: the approved ERD is not in the repository.
    pass


def downgrade() -> None:
    pass
