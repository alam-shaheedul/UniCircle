"""Real password/session logic with isolated DB and captured SMTP messages."""

from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy import select

from app.core.email import EmailDeliveryError
from app.core.security import hash_password, verify_password
from app.db.models import AuthSession, OtpChallengeRecord, User
from tests.test_auth_integration import auth_stack as auth_fixture
from tests.test_auth_requests import registration_payload

auth_stack = auth_fixture


def add_student(db):
    user = User(
        username="otp.student",
        email="otp@student.cuet.ac.bd",
        role="student",
        university_id="otp-001",
        first_name="OTP",
        last_name="Student",
        home_address="CUET",
        password_hash=hash_password("OriginalPass123"),
        verified_at=datetime.now(UTC),
        is_active=True,
    )
    db.add(user)
    db.commit()
    return user


def login(client, password="OriginalPass123"):
    return client.post(
        "/api/v1/auth/login",
        json={
            "identifier": "otp.student",
            "password": password,
        },
    )


def verify(client, challenge, code):
    return client.post(
        "/api/v1/auth/password-reset/verify-otp",
        json={
            "challengeId": challenge["challengeId"],
            "otp": code,
        },
    )


def recovery(client, email="otp@student.cuet.ac.bd"):
    response = client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert response.status_code == 200
    return response.json()["data"]


def test_reset_requires_code_single_use_grant_and_revokes_sessions(auth_stack):
    client, db, sender = auth_stack
    user = add_student(db)
    signed_in = login(client)
    assert signed_in.status_code == 200
    assert not sender.sent  # normal sign-in is still password-only
    old_headers = {"Authorization": f"Bearer {signed_in.json()['data']['token']}"}
    challenge = recovery(client)
    code = sender.sent[-1][1]
    wrong = "000000" if code != "000000" else "111111"
    assert verify(client, challenge, wrong).status_code == 400
    assert (
        client.post(
            "/api/v1/auth/verify-otp",
            json={
                "email": user.email,
                "otp": code,
            },
        ).status_code
        == 400
    )
    verified = verify(client, challenge, code)
    assert verified.status_code == 200
    grant = verified.json()["data"]["resetToken"]
    stored = db.scalar(
        select(OtpChallengeRecord).where(
            OtpChallengeRecord.purpose == "password_reset_grant",
        )
    )
    assert len(grant) >= 32 and grant != stored.digest and grant != stored.id
    assert verify(client, challenge, code).status_code == 400
    assert (
        client.post(
            "/api/v1/auth/reset-password",
            json={
                "resetToken": grant,
                "password": "weak",
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/auth/reset-password",
            json={
                "resetToken": grant,
                "password": "ChangedPass456",
            },
        ).status_code
        == 204
    )
    db.refresh(user)
    assert verify_password("ChangedPass456", user.password_hash)
    assert not verify_password("OriginalPass123", user.password_hash)
    assert client.get("/api/v1/auth/me", headers=old_headers).status_code == 401
    assert db.scalar(select(OtpChallengeRecord)) is None
    assert (
        client.post(
            "/api/v1/auth/reset-password",
            json={
                "resetToken": grant,
                "password": "ReplayPass123",
            },
        ).status_code
        == 400
    )
    assert login(client).status_code == 401
    assert login(client, "ChangedPass456").status_code == 200


def test_expiry_resend_cooldown_and_attempt_limits(auth_stack):
    client, db, sender = auth_stack
    add_student(db)
    challenge = recovery(client)
    code = sender.sent[-1][1]
    row = db.scalar(
        select(OtpChallengeRecord).where(OtpChallengeRecord.purpose == "password_reset")
    )
    endpoint = "/api/v1/auth/password-reset/resend-otp"
    client.post(endpoint, json={"email": challenge["email"]})
    assert len(sender.sent) == 1
    row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db.commit()
    assert verify(client, challenge, code).json()["error"]["code"] == "invalid_otp"
    row.issued_at = datetime.now(UTC) - timedelta(minutes=2)
    db.commit()
    resent = client.post(endpoint, json={"email": challenge["email"]})
    assert resent.status_code == 200
    challenge = resent.json()["data"]
    row = db.scalar(
        select(OtpChallengeRecord).where(OtpChallengeRecord.purpose == "password_reset")
    )
    assert len(sender.sent) == 2
    if sender.sent[-1][1] != code:
        assert verify(client, challenge, code).status_code == 400
    wrong = "000000" if sender.sent[-1][1] != "000000" else "111111"
    for _ in range(5):
        assert verify(client, challenge, wrong).status_code == 400
    assert (
        verify(client, challenge, sender.sent[-1][1]).json()["error"]["code"]
        == "invalid_otp"
    )
    db.refresh(row)
    assert row.attempts_remaining == 0


def test_recovery_does_not_disclose_accounts_in_request_or_resend(auth_stack):
    client, db, sender = auth_stack
    add_student(db)
    known = recovery(client)
    unknown = recovery(client, "unknown@student.cuet.ac.bd")
    assert known.keys() == unknown.keys()
    assert known["flow"] == unknown["flow"] == "reset"
    assert len(sender.sent) == 1
    # Tickets are randomized even during the mail cooldown for known accounts.
    assert recovery(client)["challengeId"] != known["challengeId"]
    assert recovery(client, unknown["email"])["challengeId"] != unknown["challengeId"]
    # An altered or unrelated authentication JWT cannot authorize recovery.
    invalid = {
        **known,
        "challengeId": jwt.encode(
            {"sub": known["email"]}, "wrong-key-" * 8, algorithm="HS256"
        ),
    }
    assert verify(client, invalid, sender.sent[-1][1]).status_code == 400
    for item in [known, unknown]:
        response = client.post(
            "/api/v1/auth/password-reset/resend-otp",
            json={
                "email": item["email"],
            },
        )
        assert response.status_code == 200
        assert response.json()["data"]["flow"] == "reset"
        assert set(response.json()["data"]) == {
            "flow",
            "email",
            "challengeId",
            "expiresAt",
        }


def test_expired_reset_grant_and_deactivated_user_cannot_reset(auth_stack):
    client, db, sender = auth_stack
    user = add_student(db)
    challenge = recovery(client)
    token = verify(client, challenge, sender.sent[-1][1]).json()["data"]["resetToken"]
    grant = db.scalar(
        select(OtpChallengeRecord).where(
            OtpChallengeRecord.purpose == "password_reset_grant",
        )
    )
    grant.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db.commit()
    request = {"resetToken": token, "password": "ChangedPass456"}
    assert client.post("/api/v1/auth/reset-password", json=request).status_code == 400
    grant.expires_at = datetime.now(UTC) + timedelta(minutes=5)
    user.is_active = False
    db.commit()
    assert client.post("/api/v1/auth/reset-password", json=request).status_code == 400
    db.refresh(user)
    assert verify_password("OriginalPass123", user.password_hash)


def test_failed_recovery_delivery_discards_code_and_hides_provider_details(
    auth_stack, monkeypatch
):
    client, db, sender = auth_stack
    add_student(db)

    def fail(*args):
        raise EmailDeliveryError("private SMTP details")

    monkeypatch.setattr(sender, "send_auth_code", fail)
    assert recovery(client)["flow"] == "reset"
    assert db.scalar(select(OtpChallengeRecord)) is None
    assert db.scalar(select(AuthSession)) is None


def test_registration_and_reset_codes_are_not_interchangeable(auth_stack):
    client, db, sender = auth_stack
    assert (
        client.post("/api/v1/auth/register", json=registration_payload()).status_code
        == 201
    )
    registration_code = sender.sent[-1][1]
    challenge = recovery(client, "anika@cuet.ac.bd")
    reset_code = sender.sent[-1][1]
    if registration_code != reset_code:
        assert verify(client, challenge, registration_code).status_code == 400
        assert (
            client.post(
                "/api/v1/auth/verify-otp",
                json={
                    "email": "anika@cuet.ac.bd",
                    "otp": reset_code,
                },
            ).status_code
            == 400
        )
    assert verify(client, challenge, reset_code).status_code == 200


def test_repeated_pending_registration_resumes_without_replacing_account(auth_stack):
    client, db, sender = auth_stack
    payload = registration_payload()
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    user = db.scalar(select(User))
    user_id, password_hash = user.id, user.password_hash
    wrong = {**payload, "password": "DifferentPass123"}
    assert client.post("/api/v1/auth/register", json=wrong).status_code == 409
    resumed = client.post("/api/v1/auth/register", json=payload)
    assert resumed.status_code == 201
    assert resumed.json()["data"]["email"] == "anika@cuet.ac.bd"
    db.refresh(user)
    assert user.id == user_id and user.password_hash == password_hash
    assert len(sender.sent) == 1  # existing code retained during resend cooldown
    assert (
        client.post(
            "/api/v1/auth/verify-otp",
            json={
                "email": user.email,
                "otp": sender.sent[-1][1],
            },
        ).status_code
        == 204
    )
    assert client.post("/api/v1/auth/register", json=payload).status_code == 409
