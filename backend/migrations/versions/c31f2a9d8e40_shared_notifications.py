"""consolidate shared notifications

Revision ID: c31f2a9d8e40
Revises: a18d6c9e4f20
Create Date: 2026-09-29 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c31f2a9d8e40"
down_revision: str | None = "a18d6c9e4f20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("recipient_id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("message", sa.String(length=1000), nullable=False),
        sa.Column("related_object_type", sa.String(length=64)),
        sa.Column("related_object_id", sa.String(length=128)),
        sa.Column("href", sa.String(length=500)),
        sa.Column("dedupe_key", sa.String(length=200), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "(related_object_type IS NULL AND related_object_id IS NULL) OR "
            "(related_object_type IS NOT NULL AND related_object_id IS NOT NULL)",
            name=op.f("ck_notifications_complete_related_object"),
        ),
        sa.ForeignKeyConstraint(
            ["recipient_id"],
            ["users.id"],
            ondelete="CASCADE",
            name=op.f("fk_notifications_recipient_id_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notifications")),
        sa.UniqueConstraint(
            "recipient_id", "dedupe_key", name="uq_notification_recipient_dedupe"
        ),
    )
    op.create_index(
        op.f("ix_notifications_recipient_id"),
        "notifications",
        ["recipient_id"],
    )
    op.create_index(
        "ix_notifications_recipient_created",
        "notifications",
        ["recipient_id", "created_at"],
    )

    # Preserve unread/read state and timestamps from the three legacy stores.
    op.execute(
        sa.text(
            """
            INSERT INTO notifications (
                id, recipient_id, type, title, message,
                related_object_type, related_object_id, href, dedupe_key,
                created_at, read_at
            )
            SELECT
                en.id, en.user_id, 'event-' || en.kind,
                ce.title || ' has ' || en.kind,
                CASE WHEN en.kind = 'started'
                    THEN 'The event is now underway.'
                    ELSE 'The event has now finished.' END,
                'event', CAST(en.event_id AS VARCHAR(128)),
                '/events/' || CAST(en.event_id AS VARCHAR(128)),
                'event:' || CAST(en.event_id AS VARCHAR(128)) || ':' || en.kind,
                en.created_at, en.read_at
            FROM event_notifications en
            JOIN club_events ce ON ce.id = en.event_id
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO notifications (
                id, recipient_id, type, title, message,
                related_object_type, related_object_id, href, dedupe_key,
                created_at, read_at
            )
            SELECT
                cmn.id, cmn.user_id, 'club-membership-approved',
                'Welcome to ' || c.name,
                'Your membership request was approved by the club admin.',
                'club', cmn.club_id, '/clubs/' || cmn.club_id,
                'membership-approved:' ||
                    CAST(cmn.membership_request_id AS VARCHAR(128)),
                cmn.created_at, cmn.read_at
            FROM club_membership_notifications cmn
            JOIN clubs c ON c.id = cmn.club_id
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO notifications (
                id, recipient_id, type, title, message,
                related_object_type, related_object_id, href, dedupe_key,
                created_at, read_at
            )
            SELECT
                cnn.id, cnn.user_id,
                CASE WHEN cni.kind = 'announcement'
                    THEN 'campus-announcement' ELSE 'campus-update' END,
                cni.title, cni.summary,
                'news', CAST(cnn.news_item_id AS VARCHAR(128)),
                '/news/' || CAST(cnn.news_item_id AS VARCHAR(128)),
                'news:' || CAST(cnn.news_item_id AS VARCHAR(128)),
                cnn.created_at, cnn.read_at
            FROM campus_news_notifications cnn
            JOIN campus_news_items cni ON cni.id = cnn.news_item_id
            WHERE cni.status = 'published'
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_recipient_created", table_name="notifications")
    op.drop_index(op.f("ix_notifications_recipient_id"), table_name="notifications")
    op.drop_table("notifications")
