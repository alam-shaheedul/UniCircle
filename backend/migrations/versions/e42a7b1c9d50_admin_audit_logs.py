"""add App Admin audit logs

Revision ID: e42a7b1c9d50
Revises: c31f2a9d8e40
Create Date: 2026-09-29 15:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e42a7b1c9d50"
down_revision: str | None = "c31f2a9d8e40"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "admin_audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target_type", sa.String(length=64), nullable=False),
        sa.Column("target_id", sa.String(length=128), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_admin_audit_logs_actor_id_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_admin_audit_logs")),
    )
    op.create_index(
        op.f("ix_admin_audit_logs_actor_id"),
        "admin_audit_logs",
        ["actor_id"],
    )
    op.create_index(
        "ix_admin_audit_actor_created",
        "admin_audit_logs",
        ["actor_id", "created_at"],
    )
    op.create_index(
        "ix_admin_audit_action_created",
        "admin_audit_logs",
        ["action", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_admin_audit_action_created", table_name="admin_audit_logs")
    op.drop_index("ix_admin_audit_actor_created", table_name="admin_audit_logs")
    op.drop_index(op.f("ix_admin_audit_logs_actor_id"), table_name="admin_audit_logs")
    op.drop_table("admin_audit_logs")
