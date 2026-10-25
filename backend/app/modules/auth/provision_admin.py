"""Explicit one-time App Admin provisioning; never seeds default credentials."""

import argparse
import getpass
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.security import hash_password
from app.db.models import User
from app.db.session import get_session_factory


def main() -> None:
    parser = argparse.ArgumentParser(description="Provision one UniCircle App Admin")
    parser.add_argument("--admin-id", required=True, help="Unique Admin login ID")
    args = parser.parse_args()
    admin_id = args.admin_id.strip()
    if not admin_id or len(admin_id) > 128:
        parser.error("Admin ID must contain 1 to 128 characters")
    password = getpass.getpass("New Admin password: ")
    confirm = getpass.getpass("Confirm password: ")
    if len(password) < 12 or password != confirm:
        parser.error("Passwords must match and contain at least 12 characters")
    with get_session_factory()() as db:
        if db.scalar(
            select(User.id).where(func.lower(User.admin_id) == admin_id.casefold())
        ):
            parser.error("This Admin ID already exists")
        db.add(
            User(
                admin_id=admin_id,
                password_hash=hash_password(password),
                role="admin",
                verified_at=datetime.now(UTC),
                is_active=True,
            )
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            parser.error("This Admin ID already exists")
    print("App Admin provisioned. Keep the password private.")


if __name__ == "__main__":
    main()
