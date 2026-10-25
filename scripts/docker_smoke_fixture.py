"""Seed synthetic accounts/content only in a newly migrated, isolated smoke DB.

Piped to `compose exec -T backend python -`; never included in a runtime image.
No production auth dependency is overridden, and no real SMTP/Ollama is contacted.
"""

from datetime import UTC, datetime

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.models import User
from app.db.session import get_session_factory
from app.modules.campus.seed import seed_campus
from app.modules.clubs.seed import seed_clubs
from app.modules.directory.seed import seed_directory
from app.modules.transport.seed import seed_transport
from sqlalchemy import func, select
from sqlalchemy.engine import make_url

settings = get_settings()
if make_url(settings.database_url).database != "unicircle_compose_smoke":
    raise SystemExit("Refusing to create test accounts outside the Compose smoke DB.")
with get_session_factory()() as db:
    if db.scalar(select(func.count()).select_from(User)):
        raise SystemExit("Refusing to reuse a database that already contains accounts.")
    students = []
    for index in (1, 2, 3):
        student = User(
            username=f"docker.student{index}",
            email=f"docker{index}@student.cuet.ac.bd",
            password_hash=hash_password("ComposeTestPass123!"),
            role="student",
            university_id=f"docker-student-{index}",
            first_name="Docker",
            last_name=f"Student {index}",
            home_address="Synthetic smoke fixture",
            department_name="CSE",
            verified_at=datetime.now(UTC),
            is_active=True,
        )
        db.add(student)
        students.append(student)
    db.add(
        User(
            admin_id="docker-admin",
            password_hash=hash_password("ComposeAdminPass123!"),
            role="admin",
            verified_at=datetime.now(UTC),
            is_active=True,
        )
    )
    db.commit()
    seed_directory(db)
    seed_campus(db)
    seed_clubs(db, students[0].id)
    seed_transport(db)
print("Synthetic accounts and campus content seeded in isolated Compose DB.")
