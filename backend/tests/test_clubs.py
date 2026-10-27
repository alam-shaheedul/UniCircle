"""Club permissions, approval, registration and lifecycle regression tests."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.auth import AuthIdentity, get_current_user
from app.db.base import Base
from app.db.models import (
    AdminAuditLog,
    Club,
    ClubAdmin,
    ClubCreationRequest,
    ClubEvent,
    ClubMember,
    ClubMembershipRequest,
    Notification,
    User,
)
from app.db.session import get_db
from app.main import create_app
from app.modules.clubs.notifications import reconcile_event_notifications
from app.modules.clubs.seed import seed_clubs


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
        username="first",
        email="u123@student.cuet.ac.bd",
        password_hash="test",
        role="student",
        university_id="u123",
        first_name="First",
        last_name="Student",
        home_address="Campus",
        verified_at=datetime.now(UTC),
        is_active=True,
    )
    second = User(
        id=uuid.uuid4(),
        username="second",
        email="u456@student.cuet.ac.bd",
        password_hash="test",
        role="student",
        university_id="u456",
        first_name="Second",
        last_name="Student",
        home_address="Campus",
        verified_at=datetime.now(UTC),
        is_active=True,
    )
    owner = User(
        id=uuid.uuid4(),
        admin_id="app-admin",
        password_hash="test",
        role="admin",
        is_active=True,
    )
    db.add_all([first, second, owner])
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
        yield client, db, first, second, owner, current
    db.close()
    engine.dispose()


def event_body(*, paid=False, start=None):
    start = start or datetime.now(UTC) + timedelta(days=1)
    return {
        "title": "Workshop",
        "category": "Learning",
        "summary": "Practice together",
        "location": "CUET",
        "starts_at": start.isoformat(),
        "ends_at": (start + timedelta(hours=2)).isoformat(),
        "registration_enabled": True,
        "is_paid": paid,
        "fee": 100 if paid else 0,
        "bkash_number": "01712345678" if paid else None,
    }


def test_seed_and_admin_permissions(stack):
    client, db, first, second, _, current = stack
    assert seed_clubs(db, first.id) == 10
    assert seed_clubs(db, first.id) == 10
    assert db.scalar(select(func.count()).select_from(ClubAdmin)) == 10
    assert len(client.get("/api/v1/clubs").json()["data"]) == 10
    club = "cuet-computer-club"
    assert client.get("/api/v1/clubs/administered").status_code == 200
    assert client.delete(f"/api/v1/clubs/{club}/admins/{first.id}").status_code == 409
    current["user"] = second
    assert (
        client.post(f"/api/v1/clubs/{club}/events", json=event_body()).status_code
        == 403
    )
    current["user"] = first
    assert (
        client.post(
            f"/api/v1/clubs/{club}/admins", json={"student_id": second.university_id}
        ).status_code
        == 200
    )
    assert (
        client.post(f"/api/v1/clubs/{club}/events", json=event_body()).status_code
        == 201
    )
    current["user"] = second
    assert (
        client.post(f"/api/v1/clubs/{club}/events", json=event_body()).status_code
        == 201
    )
    current["user"] = first
    assert client.delete(f"/api/v1/clubs/{club}/admins/{first.id}").status_code == 200
    current["user"] = second
    assert client.get("/api/v1/clubs/administered").json()["data"][0]["id"] == club
    other_club = "andromeda-space-robotics"
    other = client.get(f"/api/v1/clubs/{other_club}").json()["data"]
    assert (
        client.put(
            f"/api/v1/clubs/{other_club}",
            json={
                "name": other["name"],
                "short_name": other["shortName"],
                "category": other["category"],
                "tagline": other["tagline"],
                "description": other["description"],
                "activities": other["activities"],
            },
        ).status_code
        == 403
    )


def test_club_request_review_is_private_and_idempotent(stack):
    client, db, first, second, owner, current = stack
    proposal = {
        "name": "CUET Art Circle",
        "short_name": "CAC",
        "category": "Arts",
        "tagline": "Make art",
        "description": "Student artists",
        "purpose": "Give student artists a place to collaborate.",
        "activities": ["Workshops"],
    }
    response = client.post("/api/v1/clubs/requests", json=proposal)
    assert response.status_code == 201
    request_id = response.json()["data"]["id"]
    assert db.get(ClubCreationRequest, uuid.UUID(request_id)).status == "pending"
    mine = client.get("/api/v1/clubs/requests/mine").json()["data"]
    assert mine[0]["id"] == request_id and mine[0]["status"] == "pending"
    assert client.get("/api/v1/clubs/cuet-art-circle").status_code == 404
    rejected_proposal = {
        **proposal,
        "name": "CUET Music Circle",
        "short_name": "CMC",
        "tagline": "Make music",
        "description": "Student musicians",
        "purpose": "Give student musicians a place to collaborate.",
    }
    rejected_response = client.post("/api/v1/clubs/requests", json=rejected_proposal)
    assert rejected_response.status_code == 201
    rejected_request_id = rejected_response.json()["data"]["id"]
    current["user"] = second
    assert client.get("/api/v1/clubs/requests/mine").json()["data"] == []
    assert client.get("/api/v1/admin/club-requests").status_code == 403
    current["user"] = owner
    assert (
        client.get("/api/v1/admin/club-requests?status=pending").json()["data"]["total"]
        == 2
    )
    reviewed = client.post(
        f"/api/v1/admin/club-requests/{request_id}/review",
        json={"decision": "approved"},
    )
    assert reviewed.status_code == 200
    club_id = reviewed.json()["data"]["approvedClubId"]
    assert (
        client.post(
            f"/api/v1/admin/club-requests/{request_id}/review",
            json={"decision": "approved"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/api/v1/admin/club-requests/{request_id}/review",
            json={"decision": "rejected"},
        ).status_code
        == 409
    )
    assert (
        db.scalar(select(func.count()).select_from(Club).where(Club.id == club_id)) == 1
    )
    assert db.get(ClubAdmin, (club_id, first.id)) is not None
    history = client.get("/api/v1/admin/club-requests?status=approved")
    assert history.status_code == 200
    assert history.json()["data"]["total"] == 1
    assert history.json()["data"]["items"][0]["reviewerId"] == str(owner.id)
    rejected = client.post(
        f"/api/v1/admin/club-requests/{rejected_request_id}/review",
        json={"decision": "rejected", "note": "Scope needs revision."},
    )
    assert rejected.status_code == 200
    assert rejected.json()["data"]["status"] == "rejected"
    assert client.get("/api/v1/clubs/cuet-music-circle").status_code == 404
    audit = db.scalar(
        select(AdminAuditLog).where(AdminAuditLog.action == "club_request.approved")
    )
    assert audit is not None and audit.target_id == request_id


def test_paid_registration_and_event_notifications(stack):
    client, db, first, second, _, current = stack
    seed_clubs(db, first.id)
    club = "cuet-computer-club"
    event = client.post(f"/api/v1/clubs/{club}/events", json=event_body(paid=True))
    assert event.status_code == 201
    event_id = event.json()["data"]["id"]
    free_event = client.post(f"/api/v1/clubs/{club}/events", json=event_body())
    assert free_event.status_code == 201
    free_event_id = free_event.json()["data"]["id"]
    current["user"] = second
    body = {
        "participant_name": "Second Student",
        "email": second.email,
        "student_id": second.university_id,
        "department_name": "CSE",
    }
    assert (
        client.post(f"/api/v1/events/{event_id}/registrations", json=body).status_code
        == 422
    )
    body["bkash_trx_id"] = "ABC12345"
    registered = client.post(f"/api/v1/events/{event_id}/registrations", json=body)
    assert registered.status_code == 201
    assert registered.json()["data"]["paymentStatus"] == "pending_review"
    assert (
        client.post(f"/api/v1/events/{event_id}/registrations", json=body).status_code
        == 409
    )
    assert (
        client.get(f"/api/v1/events/{event_id}").json()["data"]["registeredCount"] == 1
    )
    free_registered = client.post(
        f"/api/v1/events/{free_event_id}/registrations",
        json=body | {"bkash_trx_id": None},
    )
    assert free_registered.status_code == 201
    assert free_registered.json()["data"]["paymentStatus"] == "not_required"
    assert (
        client.get(f"/api/v1/events/{free_event_id}").json()["data"]["registeredCount"]
        == 1
    )
    assert (
        client.post(
            f"/api/v1/events/{free_event_id}/registrations",
            json=body | {"bkash_trx_id": None},
        ).status_code
        == 409
    )
    assert client.get(f"/api/v1/events/{event_id}/registrations").status_code == 403
    assert (
        client.put(
            f"/api/v1/events/{event_id}/interest", json={"status": "going"}
        ).status_code
        == 200
    )
    assert (
        client.put(
            f"/api/v1/events/{event_id}/interest", json={"status": "going"}
        ).status_code
        == 200
    )
    assert reconcile_event_notifications(db, datetime.now(UTC)) == 0
    end = db.get(ClubEvent, uuid.UUID(event_id)).ends_at
    future = end.replace(tzinfo=UTC) + timedelta(seconds=1)
    assert reconcile_event_notifications(db, future) == 4
    assert reconcile_event_notifications(db, future) == 0
    assert (
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.related_object_type == "event")
        )
        == 4
    )
    event_notifications = client.get("/api/v1/notifications/me").json()["data"]
    assert {item["type"] for item in event_notifications} == {
        "event-started",
        "event-finished",
    }
    current["user"] = first
    assert (
        len(client.get(f"/api/v1/events/{event_id}/registrations").json()["data"]) == 1
    )
    registration_id = registered.json()["data"]["id"]
    reviewed = client.put(
        f"/api/v1/events/{event_id}/registrations/{registration_id}/payment",
        json={"status": "verified"},
    )
    assert reviewed.status_code == 200
    assert reviewed.json()["data"]["paymentStatus"] == "verified"


def test_notification_exact_start_end_boundaries(stack):
    client, db, first, _, _, _ = stack
    seed_clubs(db, first.id)
    start = datetime.now(UTC) + timedelta(days=2)
    response = client.post(
        "/api/v1/clubs/cuet-computer-club/events", json=event_body(start=start)
    )
    assert response.status_code == 201
    event_id = response.json()["data"]["id"]
    assert (
        client.put(
            f"/api/v1/events/{event_id}/interest", json={"status": "interested"}
        ).status_code
        == 200
    )
    assert reconcile_event_notifications(db, start - timedelta(microseconds=1)) == 0
    assert reconcile_event_notifications(db, start) == 1
    end = start + timedelta(hours=2)
    assert reconcile_event_notifications(db, end - timedelta(microseconds=1)) == 0
    assert reconcile_event_notifications(db, end) == 1
    assert reconcile_event_notifications(db, end) == 0


def test_membership_recruitment_approval_and_notification(stack):
    client, db, first, second, _, current = stack
    seed_clubs(db, first.id)
    club_id = "cuet-computer-club"
    settings = {
        "recruitment_open": True,
        "bkash_number": "01712345678",
        "nagad_number": "01812345678",
    }
    assert (
        client.put(
            f"/api/v1/clubs/{club_id}/membership-settings", json=settings
        ).status_code
        == 200
    )
    current["user"] = second
    club = client.get(f"/api/v1/clubs/{club_id}").json()["data"]
    assert club["isMember"] is False
    assert club["membershipRecruitment"]["fee"] == 200
    body = {
        "applicant_name": "Second Student",
        "email": second.email,
        "student_id": second.university_id,
        "department_name": "CSE",
        "phone": "01912345678",
        "motivation": "I want to learn, contribute, and volunteer in club activities.",
        "payment_method": "bkash",
        "transaction_id": "TRX123456",
    }
    submitted = client.post(f"/api/v1/clubs/{club_id}/membership-requests", json=body)
    assert submitted.status_code == 201
    request_id = submitted.json()["data"]["id"]
    assert (
        client.post(
            f"/api/v1/clubs/{club_id}/membership-requests", json=body
        ).status_code
        == 409
    )
    current["user"] = first
    queue = client.get(f"/api/v1/clubs/{club_id}/membership-requests")
    assert queue.status_code == 200
    assert queue.json()["data"][0]["transactionId"] == "TRX123456"
    approved = client.post(
        f"/api/v1/clubs/{club_id}/membership-requests/{request_id}/approve"
    )
    assert approved.status_code == 200
    assert db.get(ClubMember, (club_id, second.id)) is not None
    assert db.get(ClubMembershipRequest, uuid.UUID(request_id)).status == "approved"
    assert (
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.type == "club-membership-approved")
        )
        == 1
    )
    current["user"] = second
    updated = client.get(f"/api/v1/clubs/{club_id}").json()["data"]
    assert updated["isMember"] is True
    notifications = client.get("/api/v1/notifications/me").json()["data"]
    assert notifications[0]["type"] == "club-membership-approved"
    assert (
        client.put(f"/api/v1/notifications/{notifications[0]['id']}/read").status_code
        == 200
    )


def test_closed_recruitment_and_admin_removal(stack):
    client, db, first, second, _, current = stack
    seed_clubs(db, first.id)
    club_id = "cuet-computer-club"
    current["user"] = second
    assert (
        client.put(
            f"/api/v1/clubs/{club_id}/membership-settings",
            json={
                "recruitment_open": True,
                "bkash_number": "01712345678",
                "nagad_number": "01812345678",
            },
        ).status_code
        == 403
    )
    assert client.get(f"/api/v1/clubs/{club_id}/membership-requests").status_code == 403
    body = {
        "applicant_name": "Second Student",
        "email": second.email,
        "student_id": second.university_id,
        "department_name": "CSE",
        "phone": "01912345678",
        "motivation": "I want to learn, contribute, and volunteer in club activities.",
        "payment_method": "nagad",
        "transaction_id": "TRX987654",
    }
    assert (
        client.post(
            f"/api/v1/clubs/{club_id}/membership-requests", json=body
        ).status_code
        == 409
    )
    current["user"] = first
    client.put(
        f"/api/v1/clubs/{club_id}/membership-settings",
        json={
            "recruitment_open": True,
            "bkash_number": "01712345678",
            "nagad_number": "01812345678",
        },
    )
    current["user"] = second
    request_id = client.post(
        f"/api/v1/clubs/{club_id}/membership-requests", json=body
    ).json()["data"]["id"]
    current["user"] = first
    assert (
        client.delete(
            f"/api/v1/clubs/{club_id}/membership-requests/{request_id}"
        ).status_code
        == 204
    )
    assert db.get(ClubMembershipRequest, uuid.UUID(request_id)) is None
