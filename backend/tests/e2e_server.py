"""Disposable SQLite-backed ASGI app used only by Playwright journeys."""

import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.core.otp import OtpService
from app.core.security import hash_password
from app.db.base import Base
from app.db.models import ClubEvent, User
from app.db.session import get_db
from app.main import create_app
from app.modules.assistant.router import get_assistant_service
from app.modules.auth.persistence import DatabaseOtpStore
from app.modules.auth.service import AuthService, get_auth_service
from app.modules.campus.seed import seed_campus
from app.modules.clubs.seed import seed_clubs
from app.modules.directory.seed import seed_directory
from app.modules.transport.seed import seed_transport
from tests.fakes import FakeVerificationEmailSender

settings = Settings(
    app_env="testing",
    frontend_url="http://127.0.0.1:3215",
    database_url="postgresql+psycopg://e2e:e2e@localhost/e2e",
    jwt_secret="e2e-jwt-secret-" * 4,
    otp_pepper="e2e-otp-secret-" * 4,
    smtp_host="smtp.test.invalid",
    smtp_username="e2e",
    smtp_password="e2e-password",
    smtp_from_email="e2e@test.invalid",
    _env_file=None,
)
DATABASE_PATH = Path(__file__).with_name(".e2e-runtime.db")
DATABASE_PATH.unlink(missing_ok=True)
engine = create_engine(
    f"sqlite+pysqlite:///{DATABASE_PATH.as_posix()}",
    connect_args={"check_same_thread": False, "timeout": 30},
)
SessionLocal = sessionmaker(engine, expire_on_commit=False)
Base.metadata.create_all(engine)


def _user(*, admin: bool = False) -> User:
    if admin:
        return User(
            id=uuid.uuid4(),
            admin_id="e2e-admin",
            password_hash=hash_password("AdminPass123!"),
            role="admin",
            verified_at=datetime.now(UTC),
            is_active=True,
        )
    return User(
        id=uuid.uuid4(),
        username="e2e.student",
        email="e2e@student.cuet.ac.bd",
        password_hash=hash_password("StudentPass123!"),
        role="student",
        university_id="u-e2e-001",
        first_name="E2E",
        last_name="Student",
        home_address="CUET",
        department_name="CSE",
        verified_at=datetime.now(UTC),
        is_active=True,
    )


with SessionLocal() as seed_db:
    student = _user()
    seed_db.add_all([student, _user(admin=True)])
    seed_db.commit()
    seed_directory(seed_db)
    seed_campus(seed_db)
    seed_clubs(seed_db, student.id)
    event_start = datetime.now(UTC) + timedelta(days=2)
    seed_db.add(
        ClubEvent(
            club_id="cuet-computer-club",
            title="Phase 9 E2E Workshop",
            category="Workshop",
            summary="Controlled browser-test event.",
            location="CUET",
            starts_at=event_start,
            ends_at=event_start + timedelta(hours=2),
            registration_enabled=False,
            is_paid=False,
            fee=0,
        )
    )
    seed_db.commit()
    seed_transport(seed_db)


def e2e_db():
    with SessionLocal() as db:
        yield db


class FixedOtp(OtpService):
    """Only code generation/delivery are fake; actual persistence/policy is used."""

    @staticmethod
    def new_code() -> str:
        return "123456"


def e2e_auth_service(
    db: Annotated[Session, Depends(get_db)],
) -> AuthService:
    return AuthService(
        db,
        settings,
        FixedOtp(
            store=DatabaseOtpStore(db),
            sender=FakeVerificationEmailSender(),
            settings=settings,
        ),
    )


class FixedAssistant:
    def ask(self, user_id: str, question: str) -> dict:
        uuid.UUID(user_id)
        return {
            "answer": f"Controlled CUET answer for: {question}",
            "status": "answered",
        }


app = create_app(settings)
app.dependency_overrides[get_db] = e2e_db
app.dependency_overrides[get_auth_service] = e2e_auth_service
app.dependency_overrides[get_assistant_service] = lambda: FixedAssistant()
