"""community discussion forum

Revision ID: 9e4a2b1c7d30
Revises: 7b6f0c2d91aa
Create Date: 2026-09-24 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9e4a2b1c7d30"
down_revision: str | None = "7b6f0c2d91aa"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "forum_posts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("removed_at", sa.DateTime(timezone=True)),
        sa.Column("removed_by_user_id", sa.Uuid()),
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
            ["author_id"],
            ["users.id"],
            ondelete="CASCADE",
            name=op.f("fk_forum_posts_author_id_users"),
        ),
        sa.ForeignKeyConstraint(
            ["removed_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
            name=op.f("fk_forum_posts_removed_by_user_id_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_forum_posts")),
    )
    op.create_index(op.f("ix_forum_posts_author_id"), "forum_posts", ["author_id"])

    op.create_table(
        "forum_comments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("post_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
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
            ["author_id"],
            ["users.id"],
            ondelete="CASCADE",
            name=op.f("fk_forum_comments_author_id_users"),
        ),
        sa.ForeignKeyConstraint(
            ["post_id"],
            ["forum_posts.id"],
            ondelete="CASCADE",
            name=op.f("fk_forum_comments_post_id_forum_posts"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_forum_comments")),
    )
    op.create_index(
        op.f("ix_forum_comments_author_id"), "forum_comments", ["author_id"]
    )
    op.create_index(op.f("ix_forum_comments_post_id"), "forum_comments", ["post_id"])

    op.create_table(
        "forum_reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("post_id", sa.Uuid(), nullable=False),
        sa.Column("reporter_id", sa.Uuid(), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=False),
        sa.Column(
            "status", sa.String(length=20), server_default="open", nullable=False
        ),
        sa.Column("reviewer_id", sa.Uuid()),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
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
            "status IN ('open','resolved','post-removed')",
            name=op.f("ck_forum_reports_valid_status"),
        ),
        sa.ForeignKeyConstraint(
            ["post_id"],
            ["forum_posts.id"],
            ondelete="CASCADE",
            name=op.f("fk_forum_reports_post_id_forum_posts"),
        ),
        sa.ForeignKeyConstraint(
            ["reporter_id"],
            ["users.id"],
            ondelete="CASCADE",
            name=op.f("fk_forum_reports_reporter_id_users"),
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_id"],
            ["users.id"],
            ondelete="SET NULL",
            name=op.f("fk_forum_reports_reviewer_id_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_forum_reports")),
        sa.UniqueConstraint("post_id", "reporter_id", name="uq_forum_report_user"),
    )
    op.create_index(op.f("ix_forum_reports_post_id"), "forum_reports", ["post_id"])
    op.create_index(
        op.f("ix_forum_reports_reporter_id"), "forum_reports", ["reporter_id"]
    )
    op.create_index(op.f("ix_forum_reports_status"), "forum_reports", ["status"])


def downgrade() -> None:
    op.drop_index(op.f("ix_forum_reports_status"), table_name="forum_reports")
    op.drop_index(op.f("ix_forum_reports_reporter_id"), table_name="forum_reports")
    op.drop_index(op.f("ix_forum_reports_post_id"), table_name="forum_reports")
    op.drop_table("forum_reports")
    op.drop_index(op.f("ix_forum_comments_post_id"), table_name="forum_comments")
    op.drop_index(op.f("ix_forum_comments_author_id"), table_name="forum_comments")
    op.drop_table("forum_comments")
    op.drop_index(op.f("ix_forum_posts_author_id"), table_name="forum_posts")
    op.drop_table("forum_posts")
