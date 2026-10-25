"""Validate Phase 7 authentication requests before persistence is connected."""

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator

from app.core.validation import normalize_cuet_email, require_nonblank

GeneralRole = Literal["student", "teacher", "staff"]
USERNAME_PATTERN = re.compile(r"[A-Za-z0-9._-]{3,50}\Z")


class AuthRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class RegistrationRequest(AuthRequest):
    first_name: str = Field(alias="firstName")
    last_name: str = Field(alias="lastName")
    home_address: str = Field(alias="homeAddress")
    username: str
    email: str
    password: SecretStr
    role: GeneralRole
    university_id: str = Field(alias="universityId")

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return require_nonblank(value, field="Name", max_length=100)

    @field_validator("home_address")
    @classmethod
    def validate_address(cls, value: str) -> str:
        return require_nonblank(value, field="Home address", max_length=500)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        username = value.strip()
        if not USERNAME_PATTERN.fullmatch(username):
            raise ValueError(
                "Username must have 3-50 letters, numbers, dots, "
                "underscores, or hyphens"
            )
        return username

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_cuet_email(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: SecretStr) -> SecretStr:
        password = value.get_secret_value()
        if (
            len(password) < 8
            or len(password.encode("utf-8")) > 1024
            or not re.search(r"[a-z]", password)
            or not re.search(r"[A-Z]", password)
            or not re.search(r"[0-9]", password)
        ):
            raise ValueError(
                "Password must have at least 8 characters, including uppercase, "
                "lowercase, and a number"
            )
        return value

    @field_validator("university_id")
    @classmethod
    def validate_university_id(cls, value: str) -> str:
        # The final ERD will decide ID formats and whether each role gets a field.
        return require_nonblank(value, field="University ID", max_length=64)


class OtpVerificationRequest(AuthRequest):
    email: str
    otp: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_cuet_email(value)

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, value: str) -> str:
        if not re.fullmatch(r"[0-9]{6}", value):
            raise ValueError("Enter the 6-digit verification code")
        return value


class ResendOtpRequest(AuthRequest):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_cuet_email(value)


class GeneralLoginRequest(AuthRequest):
    identifier: str
    password: SecretStr

    @field_validator("identifier")
    @classmethod
    def validate_identifier(cls, value: str) -> str:
        identifier = require_nonblank(value, field="Identifier", max_length=254)
        return normalize_cuet_email(identifier) if "@" in identifier else identifier

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: SecretStr) -> SecretStr:
        password = value.get_secret_value()
        if not password or len(password.encode("utf-8")) > 1024:
            raise ValueError("Password must contain 1-1024 bytes")
        return value


class AdminLoginRequest(AuthRequest):
    admin_id: str = Field(alias="adminId")
    password: SecretStr

    @field_validator("admin_id")
    @classmethod
    def validate_admin_id(cls, value: str) -> str:
        return require_nonblank(value, field="Admin ID", max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: SecretStr) -> SecretStr:
        password = value.get_secret_value()
        if not password or len(password.encode("utf-8")) > 1024:
            raise ValueError("Password must contain 1-1024 bytes")
        return value


class ChallengeRequest(AuthRequest):
    challenge_id: str = Field(alias="challengeId", min_length=20, max_length=1024)


class ChallengeVerificationRequest(ChallengeRequest):
    otp: str

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, value: str) -> str:
        return OtpVerificationRequest.validate_otp(value)


class ResetPasswordRequest(AuthRequest):
    reset_token: SecretStr = Field(alias="resetToken")
    password: SecretStr

    @field_validator("reset_token")
    @classmethod
    def validate_token(cls, value: SecretStr) -> SecretStr:
        if not 20 <= len(value.get_secret_value()) <= 64:
            raise ValueError("Invalid password reset authorization")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: SecretStr) -> SecretStr:
        return RegistrationRequest.validate_password(value)
