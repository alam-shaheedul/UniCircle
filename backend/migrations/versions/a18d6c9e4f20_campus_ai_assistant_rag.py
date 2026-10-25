"""campus AI assistant RAG knowledge store

Revision ID: a18d6c9e4f20
Revises: 4f7a2c8d1b90
Create Date: 2026-09-26 18:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a18d6c9e4f20"
down_revision: str | None = "4f7a2c8d1b90"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column]:
    return [
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
    ]


def upgrade() -> None:
    op.create_table(
        "rag_sources",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("content_hash", sa.String(length=64)),
        sa.Column(
            "status", sa.String(length=16), server_default="active", nullable=False
        ),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column(
            "crawled_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("error_message", sa.String(length=500)),
        sa.Column("source_metadata", sa.JSON(), nullable=False),
        *timestamps(),
        sa.CheckConstraint(
            "status IN ('active','unchanged','failed')",
            name=op.f("ck_rag_sources_valid_status"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_rag_sources")),
        sa.UniqueConstraint("url", name=op.f("uq_rag_sources_url")),
    )
    op.create_index(
        op.f("ix_rag_sources_content_hash"), "rag_sources", ["content_hash"]
    )
    op.create_index(op.f("ix_rag_sources_status"), "rag_sources", ["status"])
    op.create_index(op.f("ix_rag_sources_crawled_at"), "rag_sources", ["crawled_at"])

    op.create_table(
        "rag_chunks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("embedding", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(
            ["source_id"],
            ["rag_sources.id"],
            ondelete="CASCADE",
            name=op.f("fk_rag_chunks_source_id_rag_sources"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_rag_chunks")),
        sa.UniqueConstraint("source_id", "chunk_index", name="uq_rag_chunk_position"),
    )
    op.create_index(op.f("ix_rag_chunks_source_id"), "rag_chunks", ["source_id"])
    op.create_index(op.f("ix_rag_chunks_content_hash"), "rag_chunks", ["content_hash"])

    op.create_table(
        "rag_query_audits",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("question_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("source_count", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
            name=op.f("fk_rag_query_audits_user_id_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_rag_query_audits")),
    )
    op.create_index(
        op.f("ix_rag_query_audits_user_id"), "rag_query_audits", ["user_id"]
    )
    op.create_index(
        op.f("ix_rag_query_audits_created_at"),
        "rag_query_audits",
        ["created_at"],
    )
    op.create_index(
        "ix_rag_query_rate_window",
        "rag_query_audits",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_rag_query_rate_window", table_name="rag_query_audits")
    op.drop_index(op.f("ix_rag_query_audits_created_at"), table_name="rag_query_audits")
    op.drop_index(op.f("ix_rag_query_audits_user_id"), table_name="rag_query_audits")
    op.drop_table("rag_query_audits")
    op.drop_index(op.f("ix_rag_chunks_content_hash"), table_name="rag_chunks")
    op.drop_index(op.f("ix_rag_chunks_source_id"), table_name="rag_chunks")
    op.drop_table("rag_chunks")
    op.drop_index(op.f("ix_rag_sources_crawled_at"), table_name="rag_sources")
    op.drop_index(op.f("ix_rag_sources_status"), table_name="rag_sources")
    op.drop_index(op.f("ix_rag_sources_content_hash"), table_name="rag_sources")
    op.drop_table("rag_sources")
