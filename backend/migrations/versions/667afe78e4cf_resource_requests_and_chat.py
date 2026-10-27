"""resource requests and chat

Revision ID: 667afe78e4cf
Revises: ddcf224a1d10
Create Date: 2026-09-22 18:57:00.611534
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "667afe78e4cf"
down_revision: str | None = "ddcf224a1d10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "resource_profiles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "is_discoverable",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("level", sa.String(length=60), nullable=True),
        sa.Column("hall", sa.String(length=100), nullable=True),
        sa.Column("availability_note", sa.String(length=500), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_resource_profiles_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", name=op.f("pk_resource_profiles")),
    )
    op.create_table(
        "resource_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("requester_id", sa.Uuid(), nullable=False),
        sa.Column("recipient_id", sa.Uuid(), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("resource_name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "status", sa.String(length=16), server_default="pending", nullable=False
        ),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
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
            "category IN ('notebook','lab-report','t-scale','bicycle','other')",
            name=op.f("ck_resource_requests_valid_category"),
        ),
        sa.CheckConstraint(
            "status IN ('pending','accepted','rejected')",
            name=op.f("ck_resource_requests_valid_status"),
        ),
        sa.CheckConstraint(
            "requester_id <> recipient_id",
            name=op.f("ck_resource_requests_different_users"),
        ),
        sa.ForeignKeyConstraint(
            ["recipient_id"],
            ["users.id"],
            name=op.f("fk_resource_requests_recipient_id_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["requester_id"],
            ["users.id"],
            name=op.f("fk_resource_requests_requester_id_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_resource_requests")),
    )
    op.create_index(
        op.f("ix_resource_requests_recipient_id"),
        "resource_requests",
        ["recipient_id"],
        unique=False,
    )
    op.create_index(
        "ix_resource_requests_recipient_status",
        "resource_requests",
        ["recipient_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_resource_requests_requester_id"),
        "resource_requests",
        ["requester_id"],
        unique=False,
    )
    op.create_table(
        "conversations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("resource_request_id", sa.Uuid(), nullable=False),
        sa.Column(
            "last_activity_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
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
        sa.ForeignKeyConstraint(
            ["resource_request_id"],
            ["resource_requests.id"],
            name=op.f("fk_conversations_resource_request_id_resource_requests"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_conversations")),
        sa.UniqueConstraint(
            "resource_request_id", name=op.f("uq_conversations_resource_request_id")
        ),
    )
    op.create_table(
        "resource_profile_categories",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.CheckConstraint(
            "category IN ('notebook','lab-report','t-scale','bicycle','other')",
            name=op.f("ck_resource_profile_categories_valid_category"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["resource_profiles.user_id"],
            name=op.f("fk_resource_profile_categories_user_id_resource_profiles"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "user_id", "category", name=op.f("pk_resource_profile_categories")
        ),
    )
    op.create_table(
        "messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("sender_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
            name=op.f("fk_messages_conversation_id_conversations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["sender_id"],
            ["users.id"],
            name=op.f("fk_messages_sender_id_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_messages")),
    )
    op.create_index(
        "ix_messages_conversation_time_id",
        "messages",
        ["conversation_id", "sent_at", "id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_messages_conversation_time_id", table_name="messages")
    op.drop_table("messages")
    op.drop_table("resource_profile_categories")
    op.drop_table("conversations")
    op.drop_index(
        op.f("ix_resource_requests_requester_id"), table_name="resource_requests"
    )
    op.drop_index(
        "ix_resource_requests_recipient_status", table_name="resource_requests"
    )
    op.drop_index(
        op.f("ix_resource_requests_recipient_id"), table_name="resource_requests"
    )
    op.drop_table("resource_requests")
    op.drop_table("resource_profiles")
