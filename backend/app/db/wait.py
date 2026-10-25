"""Bounded PostgreSQL readiness gate for container startup and release commands."""

import argparse
import logging
import os
import sys
import time

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.pool import NullPool

from app.core.config import Settings, get_settings
from app.core.logging import configure_logging

logger = logging.getLogger(__name__)


class DatabaseStartupTimeout(RuntimeError):
    """PostgreSQL did not accept an authenticated query within the startup window."""


def wait_for_database(settings: Settings) -> None:
    """Probe using real credentials; never log the connection URL or exception."""
    engine = create_engine(
        settings.database_url,
        poolclass=NullPool,
        hide_parameters=True,
        connect_args={
            "connect_timeout": min(3, settings.database_startup_timeout_seconds)
        },
    )
    deadline = time.monotonic() + settings.database_startup_timeout_seconds
    try:
        while time.monotonic() < deadline:
            try:
                with engine.connect() as connection:
                    connection.execute(text("SELECT 1"))
                logger.info("PostgreSQL is ready.")
                return
            except OperationalError:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                logger.info("Waiting for PostgreSQL readiness; retrying.")
                time.sleep(min(settings.database_startup_retry_seconds, remaining))
        raise DatabaseStartupTimeout(
            "PostgreSQL was not ready before startup timed out."
        )
    finally:
        engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--exec-api",
        action="store_true",
        help="Start production Uvicorn after readiness.",
    )
    args = parser.parse_args()
    settings = get_settings()
    configure_logging(settings)
    try:
        wait_for_database(settings)
    except DatabaseStartupTimeout:
        logger.error("PostgreSQL startup timed out; API was not started.")
        return 1
    if args.exec_api:
        # Replace this process so Docker termination signals reach Uvicorn directly.
        os.execv(
            sys.executable,
            [
                sys.executable,
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "0.0.0.0",
                "--port",
                "8000",
                "--no-server-header",
            ],
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
