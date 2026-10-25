"""Cross-feature App Admin authorization and audit integration."""

import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.auth import AuthIdentity, get_current_user
from app.db.base import Base
from app.db.models import AdminAuditLog, User
from app.db.session import get_db
from app.main import create_app


@pytest.fixture
def stack(settings):
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    db = Session(engine, expire_on_commit=False)
    student = User(
        id=uuid.uuid4(),
        username="admin-test-student",
        email="admin-test@student.cuet.ac.bd",
        password_hash="test",
        role="student",
        university_id="admin-test-001",
        first_name="Admin",
        last_name="Test",
        home_address="CUET",
        verified_at=datetime.now(UTC),
        is_active=True,
    )
    admin = User(
        id=uuid.uuid4(),
        admin_id="integration-admin",
        password_hash="test",
        role="admin",
        verified_at=datetime.now(UTC),
        is_active=True,
    )
    db.add_all([student, admin])
    db.commit()
    current = {"user": student}
    app = create_app(settings)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: AuthIdentity(
        id=str(current["user"].id),
        role=current["user"].role,
        is_active=True,
        is_verified=True,
    )
    with TestClient(app) as client:
        yield client, db, student, admin, current
    db.close()
    engine.dispose()


def test_general_user_cannot_access_any_admin_workspace_api(stack):
    client, _, _, _, _ = stack
    paths = (
        "/api/v1/admin/transport",
        "/api/v1/admin/club-requests",
        "/api/v1/admin/forum/reports",
        "/api/v1/admin/news",
        "/api/v1/admin/assistant/knowledge",
        "/api/v1/admin/audit-logs",
    )
    for path in paths:
        response = client.get(path)
        assert response.status_code == 403, path


def test_sensitive_admin_mutation_is_audited_and_audit_is_admin_only(stack):
    client, db, student, admin, current = stack
    current["user"] = admin
    created = client.post(
        "/api/v1/admin/news",
        json={
            "type": "announcement",
            "title": "Audit integration notice",
            "summary": "A safe summary without secrets.",
            "content": ["Administrative publishing integration test."],
            "audience": "CUET community",
            "status": "draft",
        },
    )
    assert created.status_code == 201
    item_id = created.json()["data"]["id"]
    assert db.scalar(select(func.count()).select_from(AdminAuditLog)) == 1

    listing = client.get("/api/v1/admin/audit-logs?action=news.created")
    assert listing.status_code == 200
    audit = listing.json()["data"]["items"][0]
    assert audit["actorAdminId"] == "integration-admin"
    assert audit["targetId"] == item_id
    assert audit["details"] == {"type": "announcement", "status": "draft"}

    current["user"] = student
    assert client.get("/api/v1/admin/audit-logs").status_code == 403
