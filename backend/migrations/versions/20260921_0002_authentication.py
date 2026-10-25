"""Authentication users, OTP challenges, sessions, and throttle counters.

Revision ID: 20260921_0002
Revises: 20260920_0001
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260921_0002"
down_revision: str | None = "20260920_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.String(length=50)),
        sa.Column("admin_id", sa.String(length=128)),
        sa.Column("email", sa.String(length=254)),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("university_id", sa.String(length=64)),
        sa.Column("first_name", sa.String(length=100)),
        sa.Column("last_name", sa.String(length=100)),
        sa.Column("home_address", sa.String(length=500)),
        sa.Column("department_name", sa.String(length=100)),
        sa.Column("phone", sa.String(length=40)),
        sa.Column("bio", sa.String(length=240)),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "role IN ('student', 'teacher', 'staff', 'admin')",
            name="valid_role",
        ),
        sa.CheckConstraint(
            "(role = 'admin' AND admin_id IS NOT NULL AND username IS NULL "
            "AND email IS NULL AND university_id IS NULL) OR "
            "(role <> 'admin' AND admin_id IS NULL AND username IS NOT NULL "
            "AND email IS NOT NULL AND university_id IS NOT NULL "
            "AND first_name IS NOT NULL AND last_name IS NOT NULL "
            "AND home_address IS NOT NULL)",
            name="role_fields",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint(
            "role", "university_id", name="uq_users_role_university_id"
        ),
    )
    op.create_index(
        "uq_users_username_lower", "users", [sa.text("lower(username)")], unique=True
    )
    op.create_index(
        "uq_users_admin_id_lower", "users", [sa.text("lower(admin_id)")], unique=True
    )
    op.create_index(
        "uq_users_email_lower", "users", [sa.text("lower(email)")], unique=True
    )

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("jti_digest", sa.String(length=64), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_auth_sessions_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_auth_sessions"),
        sa.UniqueConstraint("jti_digest", name="uq_auth_sessions_jti_digest"),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_index("ix_auth_sessions_expires_at", "auth_sessions", ["expires_at"])

    op.create_table(
        "otp_challenges",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("recipient_email", sa.String(length=254), nullable=False),
        sa.Column("purpose", sa.String(length=40), nullable=False),
        sa.Column("digest", sa.String(length=64), nullable=False),
        sa.Column("attempts_remaining", sa.Integer(), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_otp_challenges_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_otp_challenges"),
        sa.UniqueConstraint(
            "recipient_email", "purpose", name="uq_otp_recipient_purpose"
        ),
    )
    op.create_index("ix_otp_challenges_user_id", "otp_challenges", ["user_id"])

    op.create_table(
        "auth_rate_limits",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("scope", sa.String(length=40), nullable=False),
        sa.Column("key_digest", sa.String(length=64), nullable=False),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_auth_rate_limits"),
        sa.UniqueConstraint("scope", "key_digest", name="uq_auth_limit_key"),
    )


def downgrade() -> None:
    op.drop_table("auth_rate_limits")
    op.drop_index("ix_otp_challenges_user_id", table_name="otp_challenges")
    op.drop_table("otp_challenges")
    op.drop_index("ix_auth_sessions_expires_at", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_user_id", table_name="auth_sessions")
    op.drop_table("auth_sessions")
    op.drop_index("uq_users_email_lower", table_name="users")
    op.drop_index("uq_users_admin_id_lower", table_name="users")
    op.drop_index("uq_users_username_lower", table_name="users")
    op.drop_table("users")
