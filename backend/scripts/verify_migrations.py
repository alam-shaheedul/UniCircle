"""Apply every Alembic revision in an isolated PostgreSQL schema and remove it."""

import os
import secrets
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import make_url

from app.core.config import get_settings

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    settings = get_settings()
    source_url = make_url(settings.database_url)
    if source_url.get_backend_name() != "postgresql":
        raise SystemExit("Migration verification requires PostgreSQL")

    schema = f"phase9_{secrets.token_hex(6)}"
    admin_engine = create_engine(source_url)
    with admin_engine.begin() as connection:
        connection.exec_driver_sql(f'CREATE SCHEMA "{schema}"')

    test_url = source_url.set(
        query={**source_url.query, "options": f"-csearch_path={schema}"}
    )
    previous_url = os.environ.get("DATABASE_URL")
    try:
        os.environ["DATABASE_URL"] = test_url.render_as_string(hide_password=False)
        get_settings.cache_clear()
        config = Config(str(BACKEND_ROOT / "alembic.ini"))
        command.upgrade(config, "head")
        verification_engine = create_engine(test_url)
        try:
            tables = set(inspect(verification_engine).get_table_names())
            required = {
                "users",
                "clubs",
                "club_events",
                "resource_requests",
                "transport_schedules",
                "forum_posts",
                "campus_news_items",
                "rag_sources",
                "notifications",
            }
            missing = required - tables
            if missing:
                raise RuntimeError(f"Migration did not create: {sorted(missing)}")
        finally:
            verification_engine.dispose()
    finally:
        if previous_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous_url
        get_settings.cache_clear()
        with admin_engine.begin() as connection:
            connection.exec_driver_sql(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
        admin_engine.dispose()

    print("Clean PostgreSQL migration verification passed.")


if __name__ == "__main__":
    main()
