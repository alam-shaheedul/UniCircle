"""club membership recruitment

Revision ID: 7b6f0c2d91aa
Revises: 0363e1e5ad21
Create Date: 2026-09-23 20:30:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7b6f0c2d91aa"
down_revision: str | None = "0363e1e5ad21"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "clubs",
        sa.Column(
            "membership_recruitment_open",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "clubs",
        sa.Column("membership_fee", sa.Integer(), server_default="200", nullable=False),
    )
    op.add_column("clubs", sa.Column("membership_bkash_number", sa.String(length=24)))
    op.add_column("clubs", sa.Column("membership_nagad_number", sa.String(length=24)))
    op.create_check_constraint(
        "ck_clubs_standard_membership_fee", "clubs", "membership_fee = 200"
    )

    op.create_table(
        "club_membership_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("club_id", sa.String(length=80), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("applicant_name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("student_id", sa.String(length=64), nullable=False),
        sa.Column("department_name", sa.String(length=100), nullable=False),
        sa.Column("phone", sa.String(length=40), nullable=False),
        sa.Column("motivation", sa.Text(), nullable=False),
        sa.Column("payment_method", sa.String(length=12), nullable=False),
        sa.Column("transaction_id", sa.String(length=100), nullable=False),
        sa.Column("fee", sa.Integer(), server_default="200", nullable=False),
        sa.Column(
            "status", sa.String(length=16), server_default="pending", nullable=False
        ),
        sa.Column("reviewer_id", sa.Uuid()),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "payment_method IN ('bkash','nagad')",
            name=op.f("ck_club_membership_requests_valid_payment_method"),
        ),
        sa.CheckConstraint(
            "status IN ('pending','approved')",
            name=op.f("ck_club_membership_requests_valid_status"),
        ),
        sa.ForeignKeyConstraint(
            ["club_id"],
            ["clubs.id"],
            ondelete="CASCADE",
            name=op.f("fk_club_membership_requests_club_id_clubs"),
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_id"],
            ["users.id"],
            name=op.f("fk_club_membership_requests_reviewer_id_users"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
            name=op.f("fk_club_membership_requests_user_id_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_club_membership_requests")),
        sa.UniqueConstraint(
            "club_id", "user_id", name="uq_club_membership_request_user"
        ),
    )
    op.create_index(
        op.f("ix_club_membership_requests_club_id"),
        "club_membership_requests",
        ["club_id"],
    )
    op.create_index(
        op.f("ix_club_membership_requests_user_id"),
        "club_membership_requests",
        ["user_id"],
    )
    op.create_table(
        "club_membership_notifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("membership_request_id", sa.Uuid(), nullable=False),
        sa.Column("club_id", sa.String(length=80), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(
            ["club_id"],
            ["clubs.id"],
            ondelete="CASCADE",
            name=op.f("fk_club_membership_notifications_club_id_clubs"),
        ),
        sa.ForeignKeyConstraint(
            ["membership_request_id"],
            ["club_membership_requests.id"],
            ondelete="CASCADE",
            name=op.f(
                "fk_club_membership_notifications_membership_request_id_club_membership_requests"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
            name=op.f("fk_club_membership_notifications_user_id_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_club_membership_notifications")),
        sa.UniqueConstraint("membership_request_id", name="uq_membership_notification"),
    )
    op.create_index(
        op.f("ix_club_membership_notifications_user_id"),
        "club_membership_notifications",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_club_membership_notifications_user_id"),
        table_name="club_membership_notifications",
    )
    op.drop_table("club_membership_notifications")
    op.drop_index(
        op.f("ix_club_membership_requests_user_id"),
        table_name="club_membership_requests",
    )
    op.drop_index(
        op.f("ix_club_membership_requests_club_id"),
        table_name="club_membership_requests",
    )
    op.drop_table("club_membership_requests")
    op.drop_constraint("ck_clubs_standard_membership_fee", "clubs", type_="check")
    op.drop_column("clubs", "membership_nagad_number")
    op.drop_column("clubs", "membership_bkash_number")
    op.drop_column("clubs", "membership_fee")
    op.drop_column("clubs", "membership_recruitment_open")
