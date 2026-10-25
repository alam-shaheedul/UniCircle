"""Real migrations and HTTP/database flows against disposable CI PostgreSQL.

These tests never fall back to DATABASE_URL or the developer's database. Each
test owns a newly generated schema, applies Alembic, and removes only that schema.
"""

import os
import secrets
from datetime import UTC, datetime
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.email import get_verification_email_sender
from app.core.security import hash_password
from app.db.base import Base
from app.db.models import Notification, User
from app.db.session import get_db
from app.main import create_app
from tests import test_auth_integration as auth_cases
from tests import test_email_auth_flows as recovery_cases
from tests.fakes import FakeVerificationEmailSender
from tests.test_news import payload

pytestmark = pytest.mark.integration
BACKEND_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def postgres_stack(monkeypatch):
    raw_url = os.environ.get("CI_TEST_DATABASE_URL")
    if not raw_url:
        pytest.skip("CI_TEST_DATABASE_URL is not set; disposable PostgreSQL required")
    source_url = make_url(raw_url)
    if (
        source_url.drivername != "postgresql+psycopg"
        or source_url.database != "unicircle_ci"
        or source_url.host not in {"127.0.0.1", "localhost", "postgres"}
    ):
        pytest.fail("CI_TEST_DATABASE_URL must target the disposable unicircle_ci DB")

    schema = f"ci_test_{secrets.token_hex(6)}"
    admin_engine = create_engine(source_url)
    test_url = source_url.set(
        query={**source_url.query, "options": f"-csearch_path={schema}"}
    )
    engine = create_engine(test_url)
    try:
        with admin_engine.begin() as connection:
            connection.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
        with monkeypatch.context() as patch:
            patch.setenv("DATABASE_URL", test_url.render_as_string(hide_password=False))
            get_settings.cache_clear()
            command.upgrade(Config(str(BACKEND_ROOT / "alembic.ini")), "head")
        get_settings.cache_clear()
        settings = Settings(
            app_env="testing",
            database_url=test_url.render_as_string(hide_password=False),
            jwt_secret="ci-test-jwt-secret-" + "j" * 48,
            otp_pepper="ci-test-otp-pepper-" + "o" * 48,
            smtp_host="smtp.test.invalid",
            smtp_username="test-user",
            smtp_password="test-password",
            smtp_from_email="noreply@unit.test",
            _env_file=None,
        )
        application = create_app(settings)
        sender = FakeVerificationEmailSender()

        def supply_db():
            # Unlike the SQLite stack, every HTTP request gets a new session.
            with Session(engine) as request_db:
                yield request_db

        application.dependency_overrides[get_db] = supply_db
        application.dependency_overrides[get_verification_email_sender] = lambda: sender
        with Session(engine) as db, TestClient(application) as client:
            yield client, db, sender
    finally:
        get_settings.cache_clear()
        engine.dispose()
        try:
            with admin_engine.begin() as connection:
                # schema is generated here, not read from user input/environment.
                connection.exec_driver_sql(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
        finally:
            admin_engine.dispose()


def test_all_models_have_migrated_tables_and_head_revision(postgres_stack):
    _, db, _ = postgres_stack
    tables = set(inspect(db.connection()).get_table_names())
    assert set(Base.metadata.tables) <= tables
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
        ScriptDirectory.from_config(config).get_current_head()
    )


def test_real_postgres_registration_otp_login_profile_and_logout(postgres_stack):
    auth_cases.test_registration_verification_login_logout_and_profile(postgres_stack)


def test_real_postgres_student_subdomain_registration(postgres_stack):
    auth_cases.test_student_subdomain_registration_otp_and_email_login(postgres_stack)


def test_real_postgres_password_recovery_and_session_revocation(postgres_stack):
    recovery_cases.test_reset_requires_code_single_use_grant_and_revokes_sessions(
        postgres_stack
    )


def test_real_jwt_authorization_news_and_notifications(postgres_stack):
    client, db, _ = postgres_stack
    student = User(
        username="ci.student",
        email="ci@student.cuet.ac.bd",
        university_id="ci-001",
        first_name="CI",
        last_name="Student",
        home_address="CUET",
        role="student",
        password_hash=hash_password("StrongPass123"),
        verified_at=datetime.now(UTC),
        is_active=True,
    )
    admin = User(
        admin_id="ci-admin",
        role="admin",
        password_hash=hash_password("StrongAdminPass123"),
        verified_at=datetime.now(UTC),
        is_active=True,
    )
    db.add_all([student, admin])
    db.commit()
    signed_in = client.post(
        "/api/v1/auth/login",
        json={"identifier": "ci.student", "password": "StrongPass123"},
    )
    assert signed_in.status_code == 200
    student_headers = {"Authorization": f"Bearer {signed_in.json()['data']['token']}"}
    signed_in = client.post(
        "/api/v1/auth/admin/login",
        json={"adminId": "ci-admin", "password": "StrongAdminPass123"},
    )
    assert signed_in.status_code == 200
    admin_headers = {"Authorization": f"Bearer {signed_in.json()['data']['token']}"}
    assert client.get("/api/v1/news").status_code == 401
    assert (
        client.post(
            "/api/v1/admin/news", headers=student_headers, json=payload()
        ).status_code
        == 403
    )
    created = client.post(
        "/api/v1/admin/news", headers=admin_headers, json=payload(status="draft")
    )
    assert created.status_code == 201
    item_id = created.json()["data"]["id"]
    assert client.get("/api/v1/news", headers=student_headers).json()["data"] == []
    for _ in range(2):
        published = client.put(
            f"/api/v1/admin/news/{item_id}/status",
            headers=admin_headers,
            json={"status": "published"},
        )
        assert published.status_code == 200
    assert (
        client.get(f"/api/v1/news/{item_id}", headers=student_headers).json()["data"][
            "id"
        ]
        == item_id
    )
    notifications = client.get(
        "/api/v1/notifications/me", headers=student_headers
    ).json()["data"]
    assert len(notifications) == 1  # duplicate publication must not double fan-out
    notification = notifications[0]
    assert notification["href"] == f"/news/{item_id}"
    assert notification["isRead"] is False
    assert (
        client.put(
            f"/api/v1/notifications/{notification['id']}/read", headers=student_headers
        ).status_code
        == 200
    )
    db.expire_all()
    persisted = db.scalar(
        select(Notification).where(Notification.recipient_id == student.id)
    )
    assert persisted.read_at is not None
