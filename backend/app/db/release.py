"""Operator-controlled Neon migration preflight/apply. Never runs at startup."""

import argparse
import os
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from dotenv import dotenv_values
from sqlalchemy import create_engine, pool, text
from sqlalchemy.engine import URL, make_url

from app.core.config import get_settings

BACKEND_ROOT = Path(__file__).resolve().parents[2]
NEON_BRANCH = "br-silent-violet-b4vx6g0j"
NEON_HOST = "ep-shy-math-b4u27r4o.c-6.us-east-2.aws.neon.tech"
LOCK_ID = 3572204067


def direct_url(value: str | None) -> URL:
    """Reject wrong targets before connecting; never print a password-bearing URL."""
    try:
        url = make_url(value or "")
    except Exception:
        raise ValueError("A valid direct Neon connection is required") from None
    if (
        url.get_backend_name() != "postgresql"
        or url.host != NEON_HOST
        or url.database != "neondb"
        or not url.username
        or not url.password
        or url.query.get("sslmode") not in {"require", "verify-full"}
    ):
        raise ValueError("Expected the selected direct Neon endpoint with TLS")
    # Do not let URI options redirect migration writes into another schema.
    if set(url.query) - {"sslmode", "channel_binding"}:
        raise ValueError("Unexpected Neon connection options")
    return url.set(drivername="postgresql+psycopg")


def apply_guard(args, current: tuple[str, ...], head: str) -> None:
    if not args.apply:
        return
    if (
        args.confirm_branch != NEON_BRANCH
        or args.from_revision is None
        or current != (args.from_revision,)
        or args.to_revision != head
        or not args.backup_reference
        or not args.expand_only_confirmed
    ):
        raise ValueError(
            "Apply requires the exact branch/from/to revisions, a fresh backup "
            "reference and confirmation of backward-compatible migrations"
        )


def release(args) -> None:
    values = dotenv_values(BACKEND_ROOT.parent / ".env")
    raw = (
        os.environ.get("RELEASE_DATABASE_URL")
        or values.get("NEON_DATABASE_URL_UNPOOLED")
        or values.get("NEON_DATABASE_URL")
    )
    url = direct_url(raw)
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    script = ScriptDirectory.from_config(config)
    head = script.get_current_head()
    if not head:
        raise ValueError("Expected exactly one reviewed Alembic head")
    engine = create_engine(
        url, poolclass=pool.NullPool, connect_args={"connect_timeout": 10}
    )
    try:
        with engine.connect() as connection:
            branch = connection.scalar(text("SELECT current_setting('neon.branch_id')"))
            if branch != NEON_BRANCH:
                raise ValueError(
                    "Neon branch identity does not match the selected target"
                )
            locked = False
            try:
                if args.apply:
                    locked = bool(
                        connection.scalar(
                            text("SELECT pg_try_advisory_lock(:key)"), {"key": LOCK_ID}
                        )
                    )
                    if not locked:
                        raise ValueError(
                            "Another controlled migration is already running"
                        )
                current = MigrationContext.configure(connection).get_current_heads()
                if len(current) != 1 or script.get_revision(current[0]) is None:
                    raise ValueError("Expected one known existing database revision")
                apply_guard(args, current, head)
                print(f"Neon revision: {current[0]}; reviewed code head: {head}")
                if not args.apply:
                    if current != (head,):
                        raise ValueError(
                            "Pending migrations: review and apply before release"
                        )
                    print("Migration preflight passed; no database changes were made.")
                    return
                # Advisory lock stays held across Alembic's separate connection.
                previous = os.environ.get("DATABASE_URL")
                try:
                    os.environ["DATABASE_URL"] = url.render_as_string(
                        hide_password=False
                    )
                    get_settings.cache_clear()
                    command.upgrade(config, head)
                finally:
                    if previous is None:
                        os.environ.pop("DATABASE_URL", None)
                    else:
                        os.environ["DATABASE_URL"] = previous
                    get_settings.cache_clear()
                connection.rollback()
                if MigrationContext.configure(connection).get_current_heads() != (
                    head,
                ):
                    raise ValueError("Migration did not reach the reviewed head")
                print("Reviewed migrations applied and verified.")
            finally:
                if locked:
                    connection.execute(
                        text("SELECT pg_advisory_unlock(:key)"), {"key": LOCK_ID}
                    )
    finally:
        engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm-branch")
    parser.add_argument("--from-revision")
    parser.add_argument("--to-revision")
    parser.add_argument("--backup-reference")
    parser.add_argument("--expand-only-confirmed", action="store_true")
    args = parser.parse_args()
    try:
        release(args)
    except Exception:
        # SQLAlchemy/driver exceptions can contain connection details. Keep raw
        # errors out of operator logs; diagnose with protected tooling instead.
        raise SystemExit(
            "Migration preflight/apply failed. Check the target, revisions, backup "
            "and direct Neon connection. No deployment or rollback was attempted."
        ) from None


if __name__ == "__main__":
    main()
