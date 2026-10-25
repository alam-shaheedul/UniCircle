"""End-to-end auth routes with a transactional test database and fake mailer."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import Settings
from app.core.email import EmailDeliveryError, get_verification_email_sender
from app.core.security import hash_password
from app.db.base import Base
from app.db.models import OtpChallengeRecord, User
from app.db.session import get_db
from app.main import create_app
from tests.fakes import FakeVerificationEmailSender
from tests.test_auth_requests import registration_payload


@pytest.fixture
def auth_stack(
    settings: Settings,
) -> Iterator[tuple[TestClient, Session, FakeVerificationEmailSender]]:
    settings.smtp_host = "smtp.test.invalid"
    settings.smtp_username = "test-user"
    settings.smtp_password = SecretStr("test-password")
    settings.smtp_from_email = "noreply@unit.test"
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    db = Session(engine, expire_on_commit=False)
    sender = FakeVerificationEmailSender()
    application = create_app(settings)

    def supply_db() -> Iterator[Session]:
        yield db

    application.dependency_overrides[get_db] = supply_db
    application.dependency_overrides[get_verification_email_sender] = lambda: sender
    with TestClient(application) as client:
        yield client, db, sender
    db.close()
    engine.dispose()


def test_registration_verification_login_logout_and_profile(auth_stack) -> None:
    client, db, sender = auth_stack
    registered = client.post("/api/v1/auth/register", json=registration_payload())
    assert registered.status_code == 201
    assert registered.json()["data"] == {"email": "anika@cuet.ac.bd"}
    assert len(sender.sent) == 1
    code = sender.sent[0][1]
    user = db.scalar(select(User).where(User.email == "anika@cuet.ac.bd"))
    assert user is not None and user.verified_at is None
    assert user.password_hash != "StrongPass123"
    assert code not in db.scalar(select(OtpChallengeRecord)).digest

    login = {"identifier": "ANIKA_01", "password": "StrongPass123"}
    assert client.post("/api/v1/auth/login", json=login).status_code == 401
    assert (
        client.post(
            "/api/v1/auth/verify-otp", json={"email": user.email, "otp": "000000"}
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/v1/auth/verify-otp", json={"email": user.email, "otp": code}
        ).status_code
        == 204
    )
    assert (
        client.post(
            "/api/v1/auth/verify-otp", json={"email": user.email, "otp": code}
        ).status_code
        == 400
    )

    signed_in = client.post("/api/v1/auth/login", json=login)
    assert signed_in.status_code == 200
    token = signed_in.json()["data"]["token"]
    assert signed_in.json()["data"]["user"]["role"] == "student"
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    updated = client.patch(
        "/api/v1/users/me",
        headers=headers,
        json={
            "firstName": "Anika",
            "lastName": "Rahman",
            "username": "anika_new",
            "department": "CSE",
            "phone": "01700000000",
            "homeAddress": "CUET Campus",
            "bio": "Hello CUET",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["data"]["username"] == "anika_new"
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_student_subdomain_registration_otp_and_email_login(auth_stack) -> None:
    client, db, sender = auth_stack
    email = "anika@student.cuet.ac.bd"
    registration = client.post(
        "/api/v1/auth/register",
        json=registration_payload(
            email="Anika@STUDENT.CUET.AC.BD",
            username="anika_student",
            universityId="2204001",
        ),
    )
    assert registration.status_code == 201
    assert registration.json()["data"] == {"email": email}
    assert sender.sent[0][0] == email
    assert db.scalar(select(User).where(User.email == email)).verified_at is None

    verified = client.post(
        "/api/v1/auth/verify-otp", json={"email": email, "otp": sender.sent[0][1]}
    )
    assert verified.status_code == 204
    signed_in = client.post(
        "/api/v1/auth/login",
        json={"identifier": "ANIKA@STUDENT.CUET.AC.BD", "password": "StrongPass123"},
    )
    assert signed_in.status_code == 200
    assert signed_in.json()["data"]["user"]["email"] == email


def test_duplicate_cuet_account_resend_and_one_time_challenge(auth_stack) -> None:
    client, db, sender = auth_stack
    assert (
        client.post("/api/v1/auth/register", json=registration_payload()).status_code
        == 201
    )
    assert (
        client.post(
            "/api/v1/auth/register",
            json=registration_payload(email="ANIKA@cuet.ac.bd", username="another"),
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/api/v1/auth/register",
            json=registration_payload(email="not@cuet.example"),
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/auth/resend-otp", json={"email": "unknown@cuet.ac.bd"}
        ).status_code
        == 204
    )
    assert (
        client.post(
            "/api/v1/auth/resend-otp", json={"email": "anika@cuet.ac.bd"}
        ).status_code
        == 204
    )
    assert len(sender.sent) == 1  # cooldown

    challenge = db.scalar(select(OtpChallengeRecord))
    challenge.issued_at = datetime.now(UTC) - timedelta(minutes=2)
    db.commit()
    assert (
        client.post(
            "/api/v1/auth/resend-otp", json={"email": "anika@cuet.ac.bd"}
        ).status_code
        == 204
    )
    assert len(sender.sent) == 2
    newest = sender.sent[-1][1]
    assert (
        client.post(
            "/api/v1/auth/verify-otp",
            json={"email": "anika@cuet.ac.bd", "otp": newest},
        ).status_code
        == 204
    )


def test_admin_login_is_provisioned_and_separate(auth_stack) -> None:
    client, db, _sender = auth_stack
    admin = User(
        admin_id="admin-001",
        password_hash=hash_password("StrongAdminPass123"),
        role="admin",
        is_active=True,
        verified_at=datetime.now(UTC),
    )
    db.add(admin)
    db.commit()
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"identifier": "admin-001", "password": "StrongAdminPass123"},
        ).status_code
        == 401
    )
    signed_in = client.post(
        "/api/v1/auth/admin/login",
        json={"adminId": "admin-001", "password": "StrongAdminPass123"},
    )
    assert signed_in.status_code == 200
    profile = signed_in.json()["data"]["user"]
    assert profile["adminId"] == "admin-001"
    assert "email" not in profile and "universityId" not in profile
    token = signed_in.json()["data"]["token"]
    admin.is_active = False
    db.commit()
    assert (
        client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
        ).status_code
        == 401
    )


def test_failed_delivery_can_be_retried_without_orphaned_code(
    auth_stack, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, db, sender = auth_stack
    original_send = sender.send_verification_code

    def failed_send(_recipient: str, _code: str, _minutes: int) -> None:
        raise EmailDeliveryError("private provider detail")

    monkeypatch.setattr(sender, "send_verification_code", failed_send)
    response = client.post("/api/v1/auth/register", json=registration_payload())
    assert response.status_code == 503
    assert "private provider detail" not in response.text
    assert db.scalar(select(User).where(User.email == "anika@cuet.ac.bd"))
    assert db.scalar(select(OtpChallengeRecord)) is None

    monkeypatch.setattr(sender, "send_verification_code", original_send)
    assert (
        client.post(
            "/api/v1/auth/resend-otp", json={"email": "anika@cuet.ac.bd"}
        ).status_code
        == 204
    )
    assert len(sender.sent) == 1


def test_expired_code_and_attempt_limit(auth_stack) -> None:
    client, db, sender = auth_stack
    assert (
        client.post("/api/v1/auth/register", json=registration_payload()).status_code
        == 201
    )
    code = sender.sent[-1][1]
    challenge = db.scalar(select(OtpChallengeRecord))
    challenge.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db.commit()
    expired = client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "anika@cuet.ac.bd", "otp": code},
    )
    assert expired.status_code == 400
    assert expired.json()["error"]["code"] == "expired_otp"

    challenge.issued_at = datetime.now(UTC) - timedelta(minutes=2)
    db.commit()
    client.post("/api/v1/auth/resend-otp", json={"email": "anika@cuet.ac.bd"})
    for _ in range(5):
        assert (
            client.post(
                "/api/v1/auth/verify-otp",
                json={"email": "anika@cuet.ac.bd", "otp": "000000"},
            ).status_code
            == 400
        )
    blocked = client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "anika@cuet.ac.bd", "otp": sender.sent[-1][1]},
    )
    assert blocked.json()["error"]["code"] == "otp_attempts_exceeded"
