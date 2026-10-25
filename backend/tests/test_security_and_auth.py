"""Password, JWT, and server-side identity/role checks."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient

from app.core.auth import (
    AuthIdentity,
    get_current_admin,
    get_current_user,
    get_identity_lookup,
)
from app.core.config import Settings
from app.core.security import (
    InvalidAccessToken,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.main import create_app
from tests.fakes import FakeIdentityLookup


def test_password_hash_round_trip_and_invalid_hash() -> None:
    encoded = hash_password("a unique secret phrase")
    assert encoded.startswith("$argon2")
    assert "a unique secret phrase" not in encoded
    assert verify_password("a unique secret phrase", encoded)
    assert not verify_password("wrong", encoded)
    assert not verify_password("anything", "not-a-supported-hash")


def test_access_token_requires_valid_claims_and_no_role_claim(
    settings: Settings,
) -> None:
    token = create_access_token("user-123", settings)
    claims = decode_access_token(token, settings)
    assert claims.subject == "user-123"
    assert claims.token_id
    assert claims.expires_at > datetime.now(UTC)
    unverified_payload = jwt.decode(token, options={"verify_signature": False})
    assert "role" not in unverified_payload
    assert set(("sub", "iss", "aud", "iat", "nbf", "exp", "jti")) <= set(
        unverified_payload
    )


def test_expired_or_wrong_audience_token_is_rejected(settings: Settings) -> None:
    token = create_access_token("user-123", settings)
    payload = jwt.decode(token, options={"verify_signature": False})
    payload["exp"] = datetime.now(UTC) - timedelta(seconds=1)
    expired = jwt.encode(payload, settings.require_jwt_key(), algorithm="HS256")
    with pytest.raises(InvalidAccessToken):
        decode_access_token(expired, settings)

    payload["exp"] = datetime.now(UTC) + timedelta(minutes=30)
    payload["aud"] = "other-app"
    wrong_audience = jwt.encode(payload, settings.require_jwt_key(), algorithm="HS256")
    with pytest.raises(InvalidAccessToken):
        decode_access_token(wrong_audience, settings)


def test_token_operations_fail_without_configured_secret() -> None:
    settings = Settings(jwt_secret=None, _env_file=None)
    with pytest.raises(ValueError, match="JWT_SECRET"):
        create_access_token("user-123", settings)


def _protected_app(settings: Settings, identities: FakeIdentityLookup):
    application = create_app(settings)
    application.dependency_overrides[get_identity_lookup] = lambda: identities

    @application.get("/test/me")
    def me(identity: Annotated[AuthIdentity, Depends(get_current_user)]) -> dict:
        return {"id": identity.id, "role": identity.role}

    @application.get("/test/admin")
    def admin(identity: Annotated[AuthIdentity, Depends(get_current_admin)]) -> dict:
        return {"id": identity.id}

    return application


def test_protected_routes_check_live_identity_and_admin_role(
    settings: Settings, identity_lookup: FakeIdentityLookup
) -> None:
    identity_lookup.identities["student-1"] = AuthIdentity(
        id="student-1", role="student", is_active=True, is_verified=True
    )
    identity_lookup.identities["admin-1"] = AuthIdentity(
        id="admin-1", role="admin", is_active=True, is_verified=True
    )
    application = _protected_app(settings, identity_lookup)
    student_headers = {
        "Authorization": f"Bearer {create_access_token('student-1', settings)}"
    }
    admin_headers = {
        "Authorization": f"Bearer {create_access_token('admin-1', settings)}"
    }
    with TestClient(application) as client:
        missing = client.get("/test/me")
        student = client.get("/test/me", headers=student_headers)
        forbidden = client.get("/test/admin", headers=student_headers)
        admin = client.get("/test/admin", headers=admin_headers)
        identity_lookup.identities["student-1"] = AuthIdentity(
            id="student-1", role="student", is_active=False, is_verified=True
        )
        disabled = client.get("/test/me", headers=student_headers)

    assert missing.status_code == 401
    assert missing.headers["www-authenticate"] == "Bearer"
    assert student.json() == {"id": "student-1", "role": "student"}
    assert forbidden.status_code == 403
    assert forbidden.json()["error"]["code"] == "forbidden"
    assert admin.json() == {"id": "admin-1"}
    assert disabled.status_code == 401


def test_identity_dependency_fails_closed_for_unknown_subject(
    settings: Settings,
) -> None:
    application = create_app(settings)

    @application.get("/test/me")
    def me(identity: Annotated[AuthIdentity, Depends(get_current_user)]) -> dict:
        return {"id": identity.id}

    headers = {"Authorization": f"Bearer {create_access_token('someone', settings)}"}
    with TestClient(application) as client:
        response = client.get("/test/me", headers=headers)

    assert response.status_code == 401
