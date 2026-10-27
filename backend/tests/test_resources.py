"""Resource discovery, recipient decisions, and accepted-request chat."""

import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.auth import AuthIdentity, get_current_user
from app.db.base import Base
from app.db.models import Conversation, Message, ResourceRequest, User
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
    users = []
    for username in ("alice", "bob", "carol"):
        users.append(
            User(
                id=uuid.uuid4(),
                username=username,
                email=f"{username}@student.cuet.ac.bd",
                password_hash="test",
                role="student",
                university_id=f"id-{username}",
                first_name=username.title(),
                last_name="Student",
                home_address="Private address",
                phone="01700000000",
                verified_at=datetime.now(UTC),
                is_active=True,
            )
        )
    owner = User(
        id=uuid.uuid4(),
        admin_id="admin-resources",
        password_hash="test",
        role="admin",
        is_active=True,
    )
    db.add_all([*users, owner])
    db.commit()
    current = {"user": users[0]}
    app = create_app(settings)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: AuthIdentity(
        id=str(current["user"].id),
        role=current["user"].role,
        is_active=True,
        is_verified=True,
    )
    with TestClient(app) as client:
        yield client, db, users, owner, current
    db.close()
    engine.dispose()


def enable_profile(client: TestClient, *, categories=None):
    return client.patch(
        "/api/v1/resource-profile/me",
        json={
            "is_discoverable": True,
            "level": "Level 3",
            "hall": "Campus hall",
            "availability_note": "After class",
            "categories": categories or ["notebook"],
        },
    )


def send_request(client: TestClient, recipient: User, *, category="notebook"):
    return client.post(
        "/api/v1/resource-requests",
        json={
            "recipient_id": str(recipient.id),
            "category": category,
            "resource_name": "Course notebook",
            "description": "Can I borrow this for one evening?",
        },
    )


def test_discovery_is_opt_in_and_private(stack):
    client, _, users, owner, current = stack
    alice, bob, carol = users
    assert client.get("/api/v1/users/discover").json()["data"]["total"] == 0
    assert send_request(client, bob).status_code == 404
    current["user"] = bob
    assert enable_profile(client).status_code == 200
    current["user"] = carol
    assert enable_profile(client, categories=["bicycle"]).status_code == 200
    current["user"] = alice
    listing = client.get("/api/v1/users/discover?category=notebook&search=Bo&limit=1")
    assert listing.status_code == 200
    assert listing.json()["data"]["total"] == 1
    item = listing.json()["data"]["items"][0]
    assert item["userId"] == str(bob.id)
    assert "email" not in item and "phone" not in item and "homeAddress" not in item
    assert "mutualConnections" not in item
    assert (
        client.get("/api/v1/users/discover?search=Campus%20hall").json()["data"][
            "total"
        ]
        == 2
    )
    assert send_request(client, bob, category="bicycle").status_code == 422
    assert send_request(client, alice).status_code == 422
    current["user"] = owner
    assert client.get("/api/v1/users/discover").status_code == 403
    assert enable_profile(client).status_code == 403


def test_acceptance_unlocks_chat_for_only_two_participants(stack):
    client, db, users, _, current = stack
    alice, bob, carol = users
    current["user"] = bob
    enable_profile(client)
    current["user"] = alice
    response = send_request(client, bob)
    assert response.status_code == 201
    request_id = response.json()["data"]["id"]
    assert (
        client.get("/api/v1/resource-requests/mine?box=sent").json()["data"]["total"]
        == 1
    )
    assert (
        client.post(
            f"/api/v1/resource-requests/{request_id}/decision",
            json={"decision": "accepted"},
        ).status_code
        == 403
    )
    assert client.get("/api/v1/conversations").json()["data"]["total"] == 0
    current["user"] = carol
    assert client.get(f"/api/v1/resource-requests/{request_id}").status_code == 404
    current["user"] = bob
    assert (
        client.get("/api/v1/resource-requests/mine?box=received").json()["data"][
            "total"
        ]
        == 1
    )
    accepted = client.post(
        f"/api/v1/resource-requests/{request_id}/decision",
        json={"decision": "accepted"},
    )
    assert accepted.status_code == 200
    conversation_id = accepted.json()["data"]["conversationId"]
    assert conversation_id
    retry = client.post(
        f"/api/v1/resource-requests/{request_id}/decision",
        json={"decision": "accepted"},
    )
    assert retry.json()["data"]["conversationId"] == conversation_id
    assert (
        client.post(
            f"/api/v1/resource-requests/{request_id}/decision",
            json={"decision": "rejected"},
        ).status_code
        == 409
    )
    assert db.scalar(select(func.count()).select_from(Conversation)) == 1
    assert db.get(ResourceRequest, uuid.UUID(request_id)).responded_at is not None
    assert (
        client.post(
            f"/api/v1/conversations/{conversation_id}/messages",
            json={"body": "  Hello Alice  "},
        ).json()["data"]["body"]
        == "Hello Alice"
    )
    current["user"] = alice
    assert client.get("/api/v1/conversations").json()["data"]["total"] == 1
    assert (
        client.post(
            f"/api/v1/conversations/{conversation_id}/messages",
            json={"body": "I can collect it tomorrow."},
        ).status_code
        == 201
    )
    assert db.scalar(select(func.count()).select_from(Message)) == 2
    current["user"] = carol
    assert client.get("/api/v1/conversations").json()["data"]["total"] == 0
    assert (
        client.get(f"/api/v1/conversations/{conversation_id}/messages").status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/conversations/{conversation_id}/messages",
            json={"body": "intrusion"},
        ).status_code
        == 404
    )


def test_rejection_and_message_cursors(stack):
    client, _, users, _, current = stack
    alice, bob, _ = users
    current["user"] = bob
    enable_profile(client)
    current["user"] = alice
    rejected_id = send_request(client, bob).json()["data"]["id"]
    accepted_id = send_request(client, bob).json()["data"]["id"]
    current["user"] = bob
    rejected = client.post(
        f"/api/v1/resource-requests/{rejected_id}/decision",
        json={"decision": "rejected"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["data"]["conversationId"] is None
    assert (
        client.post(
            f"/api/v1/resource-requests/{rejected_id}/decision",
            json={"decision": "rejected"},
        ).status_code
        == 200
    )
    accepted = client.post(
        f"/api/v1/resource-requests/{accepted_id}/decision",
        json={"decision": "accepted"},
    )
    conversation_id = accepted.json()["data"]["conversationId"]
    sent = []
    for index in range(3):
        result = client.post(
            f"/api/v1/conversations/{conversation_id}/messages",
            json={"body": f"Message {index}"},
        )
        assert result.status_code == 201
        sent.append(result.json()["data"]["id"])
    latest = client.get(
        f"/api/v1/conversations/{conversation_id}/messages?limit=2"
    ).json()["data"]
    assert [item["id"] for item in latest["items"]] == sent[1:]
    assert latest["hasMore"] is True
    older = client.get(
        f"/api/v1/conversations/{conversation_id}/messages?before_id={sent[1]}&limit=2"
    ).json()["data"]
    assert [item["id"] for item in older["items"]] == sent[:1]
    newer = client.get(
        f"/api/v1/conversations/{conversation_id}/messages?after_id={sent[0]}&limit=2"
    ).json()["data"]
    assert [item["id"] for item in newer["items"]] == sent[1:]
    assert (
        client.get(
            f"/api/v1/conversations/{conversation_id}/messages?after_id={sent[0]}&before_id={sent[1]}"
        ).status_code
        == 422
    )
