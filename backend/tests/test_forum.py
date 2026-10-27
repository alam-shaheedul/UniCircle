"""Community forum persistence, validation, reporting, and moderation."""

import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.auth import AuthIdentity, get_current_user
from app.db.base import Base
from app.db.models import AdminAuditLog, ForumComment, ForumPost, ForumReport, User
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
    first = User(
        id=uuid.uuid4(),
        username="forum.alice",
        email="alice@student.cuet.ac.bd",
        password_hash="test",
        role="student",
        university_id="u2204001",
        first_name="Alice",
        last_name="Student",
        home_address="Private address",
        department_name="Computer Science & Engineering",
        verified_at=datetime.now(UTC),
        is_active=True,
    )
    second = User(
        id=uuid.uuid4(),
        username="forum.teacher",
        email="teacher@cuet.ac.bd",
        password_hash="test",
        role="teacher",
        university_id="teacher-1",
        first_name="Tania",
        last_name="Teacher",
        home_address="Private address",
        department_name="Electrical & Electronic Engineering",
        verified_at=datetime.now(UTC),
        is_active=True,
    )
    admin = User(
        id=uuid.uuid4(),
        admin_id="forum-admin",
        password_hash="test",
        role="admin",
        is_active=True,
    )
    db.add_all([first, second, admin])
    db.commit()
    current = {"user": first}
    app = create_app(settings)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: AuthIdentity(
        id=str(current["user"].id),
        role=current["user"].role,
        is_active=True,
        is_verified=True,
    )
    with TestClient(app) as client:
        yield client, db, first, second, admin, current
    db.close()
    engine.dispose()


def create_post(client: TestClient, body: str = "How can we improve campus life?"):
    return client.post("/api/v1/forum/posts", json={"body": body})


def test_text_only_posts_and_comments(stack):
    client, db, first, second, admin, current = stack
    assert create_post(client, "   ").status_code == 422
    assert (
        client.post(
            "/api/v1/forum/posts",
            json={"body": "Text", "image_url": "https://example.com/image.jpg"},
        ).status_code
        == 422
    )
    created = create_post(client, "  A constructive campus discussion.  ")
    assert created.status_code == 201
    post_id = created.json()["data"]["id"]
    assert created.json()["data"]["body"] == "A constructive campus discussion."
    assert created.json()["data"]["author"]["id"] == str(first.id)

    current["user"] = second
    comment = client.post(
        f"/api/v1/forum/posts/{post_id}/comments",
        json={"body": "  A helpful response.  "},
    )
    assert comment.status_code == 201
    assert comment.json()["data"]["body"] == "A helpful response."
    assert (
        client.post(
            f"/api/v1/forum/posts/{post_id}/comments",
            json={"body": "Text", "video": "not-allowed"},
        ).status_code
        == 422
    )
    listing = client.get("/api/v1/forum/posts")
    assert listing.status_code == 200
    assert listing.json()["data"]["total"] == 1
    assert (
        listing.json()["data"]["posts"][0]["comments"][0]["author"]["role"] == "teacher"
    )
    assert (
        len(client.get(f"/api/v1/forum/posts/{post_id}/comments").json()["data"]) == 1
    )
    assert db.scalar(select(func.count()).select_from(ForumPost)) == 1
    assert db.scalar(select(func.count()).select_from(ForumComment)) == 1

    current["user"] = admin
    assert create_post(client).status_code == 403


def test_report_review_and_soft_post_removal(stack):
    client, db, first, second, admin, current = stack
    first_post_id = create_post(client, "A post that can remain visible.").json()[
        "data"
    ]["id"]
    current["user"] = second
    reported = client.post(
        f"/api/v1/forum/posts/{first_post_id}/reports",
        json={"reason": "Please verify whether this information is accurate."},
    )
    assert reported.status_code == 201
    report_id = reported.json()["data"]["id"]
    assert (
        client.post(
            f"/api/v1/forum/posts/{first_post_id}/reports",
            json={"reason": "Duplicate report"},
        ).status_code
        == 409
    )
    assert client.get("/api/v1/admin/forum/reports").status_code == 403

    current["user"] = admin
    queue = client.get("/api/v1/admin/forum/reports?status=open")
    assert queue.status_code == 200
    assert queue.json()["data"][0]["postBody"] == "A post that can remain visible."
    assert client.get(f"/api/v1/admin/forum/reports/{report_id}").status_code == 200
    resolved = client.put(
        f"/api/v1/admin/forum/reports/{report_id}",
        json={"decision": "resolved"},
    )
    assert resolved.status_code == 200
    assert resolved.json()["data"]["status"] == "resolved"
    assert (
        client.put(
            f"/api/v1/admin/forum/reports/{report_id}",
            json={"decision": "resolved"},
        ).status_code
        == 200
    )

    current["user"] = first
    assert client.get(f"/api/v1/forum/posts/{first_post_id}").status_code == 200
    removed_post = create_post(client, "A reported post that will be removed.")
    removed_post_id = removed_post.json()["data"]["id"]
    client.post(
        f"/api/v1/forum/posts/{removed_post_id}/comments",
        json={"body": "This comment follows the post visibility."},
    )
    current["user"] = second
    removed_report = client.post(
        f"/api/v1/forum/posts/{removed_post_id}/reports",
        json={"reason": "This post violates the community standards."},
    )
    removed_report_id = removed_report.json()["data"]["id"]
    current["user"] = admin
    removed = client.put(
        f"/api/v1/admin/forum/reports/{removed_report_id}",
        json={"decision": "post-removed"},
    )
    assert removed.status_code == 200
    assert removed.json()["data"]["status"] == "post-removed"

    current["user"] = first
    assert client.get(f"/api/v1/forum/posts/{removed_post_id}").status_code == 404
    feed_ids = {
        item["id"] for item in client.get("/api/v1/forum/posts").json()["data"]["posts"]
    }
    assert removed_post_id not in feed_ids
    assert first_post_id in feed_ids
    assert db.get(ForumPost, uuid.UUID(removed_post_id)).removed_at is not None
    assert db.scalar(select(func.count()).select_from(ForumComment)) == 1
    assert db.get(ForumReport, uuid.UUID(removed_report_id)).reviewer_id == admin.id
    assert db.scalar(select(func.count()).select_from(AdminAuditLog)) == 2
