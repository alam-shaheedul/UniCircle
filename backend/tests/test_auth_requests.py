"""The backend enforces the current frontend authentication input contract."""

import pytest
from pydantic import ValidationError

from app.core.security import verify_password
from app.modules.auth.registration import prepare_registration
from app.modules.auth.schemas import (
    AdminLoginRequest,
    GeneralLoginRequest,
    OtpVerificationRequest,
    RegistrationRequest,
    ResendOtpRequest,
)


def registration_payload(**changes: str) -> dict[str, str]:
    payload = {
        "firstName": "Anika",
        "lastName": "Rahman",
        "homeAddress": "Chattogram",
        "username": "anika_01",
        "email": "Anika@CUET.ac.bd",
        "password": "StrongPass123",
        "role": "student",
        "universityId": "2204001",
    }
    payload.update(changes)
    return payload


def test_registration_accepts_current_frontend_fields_and_prepares_hash() -> None:
    request = RegistrationRequest.model_validate(registration_payload())
    pending = prepare_registration(request)
    assert pending.email == "anika@cuet.ac.bd"
    assert pending.username == "anika_01"
    assert pending.role == "student"
    assert pending.university_id == "2204001"
    assert not pending.is_verified
    assert pending.password_hash != "StrongPass123"
    assert verify_password("StrongPass123", pending.password_hash)
    assert "StrongPass123" not in repr(request)


def test_student_subdomain_registration_and_otp_requests() -> None:
    email = "anika@student.cuet.ac.bd"
    request = RegistrationRequest.model_validate(
        registration_payload(email=" Anika@STUDENT.CUET.AC.BD ")
    )
    assert request.email == email
    assert OtpVerificationRequest(email=email, otp="123456").email == email
    assert ResendOtpRequest(email=email).email == email
    assert (
        GeneralLoginRequest(identifier=email, password="any-password").identifier
        == email
    )


@pytest.mark.parametrize("role", ["student", "teacher", "staff"])
def test_registration_allows_only_general_roles(role: str) -> None:
    request = RegistrationRequest.model_validate(registration_payload(role=role))
    assert request.role == role


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("email", "anika@example.com"),
        ("email", "anika@other.cuet.ac.bd"),
        ("email", "anika@student.cuet.ac.bd.evil.example"),
        ("role", "admin"),
        ("universityId", "  "),
        ("username", "invalid name"),
        ("password", "weakpassword"),
        ("firstName", " "),
        ("homeAddress", " "),
    ],
)
def test_registration_rejects_invalid_input(field: str, value: str) -> None:
    with pytest.raises(ValidationError):
        RegistrationRequest.model_validate(registration_payload(**{field: value}))


def test_registration_rejects_unexpected_fields() -> None:
    with pytest.raises(ValidationError):
        RegistrationRequest.model_validate(
            registration_payload(isVerified="true", isAdmin="true")
        )


def test_otp_and_resend_require_cuet_email_and_exact_code() -> None:
    verified = OtpVerificationRequest.model_validate(
        {"email": "Anika@CUET.AC.BD", "otp": "001234"}
    )
    assert verified.email == "anika@cuet.ac.bd"
    assert verified.otp == "001234"
    assert ResendOtpRequest(email="anika@cuet.ac.bd").email == verified.email
    with pytest.raises(ValidationError):
        OtpVerificationRequest(email="anika@cuet.ac.bd", otp="12345")
    with pytest.raises(ValidationError):
        ResendOtpRequest(email="anika@example.com")


def test_general_and_admin_login_inputs_are_separate() -> None:
    general = GeneralLoginRequest(
        identifier="Anika@CUET.AC.BD", password="any-password"
    )
    admin = AdminLoginRequest.model_validate(
        {"adminId": "admin-001", "password": "another-password"}
    )
    assert general.identifier == "anika@cuet.ac.bd"
    assert admin.admin_id == "admin-001"
    assert "another-password" not in repr(admin)
    with pytest.raises(ValidationError):
        AdminLoginRequest.model_validate(
            {"identifier": "anika", "password": "any-password"}
        )
