"""Authentication API; JWTs are intended for the trusted Next.js BFF."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.schemas import ApiResponse
from app.core.auth import AuthIdentity, get_current_user, get_token_claims
from app.core.errors import AppError
from app.core.security import AccessTokenClaims
from app.core.validation import require_nonblank
from app.db.models import User
from app.db.session import get_db
from app.modules.auth.email_flows import EmailCodeFlows
from app.modules.auth.persistence import revoke_session
from app.modules.auth.schemas import (
    AdminLoginRequest,
    ChallengeVerificationRequest,
    GeneralLoginRequest,
    OtpVerificationRequest,
    RegistrationRequest,
    ResendOtpRequest,
    ResetPasswordRequest,
)
from app.modules.auth.service import AuthService, get_auth_service

router = APIRouter(prefix="/auth", tags=["authentication"])
profile_router = APIRouter(prefix="/users", tags=["profile"])


class RegistrationResponse(BaseModel):
    email: str


class GeneralSessionUser(BaseModel):
    id: str
    role: Literal["student", "teacher", "staff"]
    firstName: str
    lastName: str
    displayName: str
    username: str
    email: str
    universityId: str
    homeAddress: str
    department: str | None = None
    phone: str | None = None
    bio: str | None = None
    memberSince: datetime


class AdminSessionUser(BaseModel):
    id: str
    role: Literal["admin"] = "admin"
    adminId: str
    displayName: str
    memberSince: datetime


SessionUserResponse = GeneralSessionUser | AdminSessionUser


class LoginResponse(BaseModel):
    token: str = Field(description="BFF-only token; never expose to browser JavaScript")
    expiresAt: datetime
    user: SessionUserResponse


class UpdateProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    firstName: str
    lastName: str
    username: str
    department: str
    phone: str = ""
    homeAddress: str
    bio: str = ""

    @field_validator("firstName", "lastName")
    @classmethod
    def name(cls, value: str) -> str:
        return require_nonblank(value, field="Name", max_length=100)

    @field_validator("username")
    @classmethod
    def username_value(cls, value: str) -> str:
        return RegistrationRequest.validate_username(value)

    @field_validator("department")
    @classmethod
    def department_value(cls, value: str) -> str:
        return require_nonblank(value, field="Department", max_length=100)

    @field_validator("homeAddress")
    @classmethod
    def address(cls, value: str) -> str:
        return require_nonblank(value, field="Home address", max_length=500)

    @field_validator("phone")
    @classmethod
    def phone_value(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) > 40:
            raise ValueError("Phone must be at most 40 characters")
        return normalized

    @field_validator("bio")
    @classmethod
    def bio_value(cls, value: str) -> str:
        if len(value) > 240:
            raise ValueError("Bio must be at most 240 characters")
        return value.strip()


def session_user(user: User) -> SessionUserResponse:
    if user.role == "admin":
        if user.admin_id is None:
            raise RuntimeError("Admin account is missing its ID")
        return AdminSessionUser(
            id=str(user.id),
            adminId=user.admin_id,
            displayName=user.admin_id,
            memberSince=user.created_at,
        )
    if not all(
        (
            user.first_name,
            user.last_name,
            user.username,
            user.email,
            user.university_id,
            user.home_address,
        )
    ):
        raise RuntimeError("General account is missing required fields")
    return GeneralSessionUser(
        id=str(user.id),
        role=user.role,
        firstName=user.first_name,
        lastName=user.last_name,
        displayName=f"{user.first_name} {user.last_name}",
        username=user.username,
        email=user.email,
        universityId=user.university_id,
        homeAddress=user.home_address,
        department=user.department_name,
        phone=user.phone,
        bio=user.bio,
        memberSince=user.created_at,
    )


def network_identity(request: Request) -> str:
    # Only the transport peer is trusted; arbitrary forwarded headers are not.
    return request.client.host if request.client else "unknown"


@router.post(
    "/register",
    response_model=ApiResponse[RegistrationResponse],
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: RegistrationRequest,
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> ApiResponse[RegistrationResponse]:
    email = service.register(payload, network_identity(request))
    return ApiResponse(data=RegistrationResponse(email=email))


@router.post("/verify-otp", status_code=status.HTTP_204_NO_CONTENT)
def verify_otp(
    payload: OtpVerificationRequest,
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> None:
    service.verify(payload.email, payload.otp, network_identity(request))


@router.post("/resend-otp", status_code=status.HTTP_204_NO_CONTENT)
def resend_otp(
    payload: ResendOtpRequest,
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> None:
    service.resend(payload.email, network_identity(request))


@router.post("/login", response_model=ApiResponse[LoginResponse])
def login(
    payload: GeneralLoginRequest,
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> ApiResponse[LoginResponse]:
    token, user, expires_at = service.login(
        payload.identifier,
        payload.password.get_secret_value(),
        network_identity(request),
        admin=False,
    )
    return ApiResponse(
        data=LoginResponse(token=token, expiresAt=expires_at, user=session_user(user))
    )


@router.post("/forgot-password", response_model=ApiResponse[dict])
def forgot_password(
    payload: ResendOtpRequest,
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> ApiResponse[dict]:
    return ApiResponse(
        data=EmailCodeFlows(service).forgot_password(
            payload.email, network_identity(request)
        )
    )


@router.post("/password-reset/verify-otp", response_model=ApiResponse[dict])
def verify_reset_code(
    payload: ChallengeVerificationRequest,
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> ApiResponse[dict]:
    return ApiResponse(
        data=EmailCodeFlows(service).verify(
            payload.challenge_id,
            payload.otp,
            "password_reset",
            network_identity(request),
        )
    )


@router.post("/password-reset/resend-otp", response_model=ApiResponse[dict])
def resend_reset_code(
    payload: ResendOtpRequest,
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> ApiResponse[dict]:
    return ApiResponse(
        data=EmailCodeFlows(service).forgot_password(
            payload.email, network_identity(request)
        )
    )


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> None:
    EmailCodeFlows(service).reset_password(
        payload.reset_token.get_secret_value(),
        payload.password.get_secret_value(),
        network_identity(request),
    )


@router.post("/admin/login", response_model=ApiResponse[LoginResponse])
def admin_login(
    payload: AdminLoginRequest,
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> ApiResponse[LoginResponse]:
    token, user, expires_at = service.login(
        payload.admin_id,
        payload.password.get_secret_value(),
        network_identity(request),
        admin=True,
    )
    return ApiResponse(
        data=LoginResponse(token=token, expiresAt=expires_at, user=session_user(user))
    )


@router.get("/me", response_model=ApiResponse[SessionUserResponse])
def me(
    identity: Annotated[AuthIdentity, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ApiResponse[SessionUserResponse]:
    user = db.get(User, UUID(identity.id))
    if user is None:
        raise AppError(status_code=401, code="unauthorized", message="Session expired.")
    return ApiResponse(data=session_user(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    _identity: Annotated[AuthIdentity, Depends(get_current_user)],
    claims: Annotated[AccessTokenClaims, Depends(get_token_claims)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    revoke_session(db, claims.token_id)


@profile_router.patch("/me", response_model=ApiResponse[GeneralSessionUser])
def update_my_profile(
    payload: UpdateProfileRequest,
    identity: Annotated[AuthIdentity, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ApiResponse[GeneralSessionUser]:
    if identity.role == "admin":
        raise AppError(
            status_code=403,
            code="forbidden",
            message="Admin profile is managed separately.",
        )
    user = db.get(User, UUID(identity.id))
    if user is None:
        raise AppError(status_code=401, code="unauthorized", message="Session expired.")
    duplicate = db.scalar(
        select(User.id).where(
            func.lower(User.username) == payload.username.casefold(),
            User.id != user.id,
        )
    )
    if duplicate is not None:
        raise AppError(
            status_code=409,
            code="account_conflict",
            message="Username is already in use.",
        )
    user.first_name = payload.firstName
    user.last_name = payload.lastName
    user.username = payload.username
    user.department_name = payload.department
    user.phone = payload.phone or None
    user.home_address = payload.homeAddress
    user.bio = payload.bio or None
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError(
            status_code=409,
            code="account_conflict",
            message="Username is already in use.",
        ) from exc
    return ApiResponse(data=session_user(user))
