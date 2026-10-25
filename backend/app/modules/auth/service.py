"""Registration, verification, login, and durable abuse controls."""

import hashlib
import hmac
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.email import EmailDeliveryError
from app.core.errors import AppError
from app.core.otp import OtpCheckResult, OtpCooldownError, OtpService, get_otp_service
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.db.models import AuthRateLimit, AuthSession, User
from app.db.session import get_db
from app.modules.auth.persistence import as_utc, session_digest
from app.modules.auth.registration import prepare_registration
from app.modules.auth.schemas import RegistrationRequest

_DUMMY_HASH = hash_password("not-an-account-password-8972")


def _unavailable(name: str) -> AppError:
    return AppError(
        status_code=503,
        code="authentication_unavailable",
        message=f"{name} is not configured yet.",
    )


def _invalid_credentials() -> AppError:
    return AppError(
        status_code=401,
        code="invalid_credentials",
        message="The credentials are incorrect or the account is unavailable.",
    )


class AuthService:
    def __init__(self, db: Session, settings: Settings, otp: OtpService) -> None:
        self.db = db
        self.settings = settings
        self.otp = otp

    def _limit_one(
        self, scope: str, value: str, *, allowed: int, window: timedelta
    ) -> None:
        try:
            key = self.settings.require_jwt_key()
        except ValueError as exc:
            raise _unavailable("JWT signing") from exc
        digest = hmac.new(
            key, f"{scope}:{value.casefold()}".encode(), hashlib.sha256
        ).hexdigest()
        now = datetime.now(UTC)
        for _ in range(2):
            row = self.db.scalar(
                select(AuthRateLimit)
                .where(AuthRateLimit.scope == scope, AuthRateLimit.key_digest == digest)
                .with_for_update()
            )
            if row is None:
                self.db.add(
                    AuthRateLimit(
                        scope=scope,
                        key_digest=digest,
                        window_started_at=now,
                        attempt_count=1,
                    )
                )
                try:
                    self.db.commit()
                    return
                except IntegrityError:
                    self.db.rollback()
                    continue
            elif as_utc(row.window_started_at) + window <= now:
                row.window_started_at = now
                row.attempt_count = 1
                self.db.commit()
                return
            elif row.attempt_count < allowed:
                row.attempt_count += 1
                self.db.commit()
                return
            else:
                self.db.rollback()
                raise AppError(
                    status_code=429,
                    code="rate_limited",
                    message="Too many attempts. Please try again later.",
                )
        raise AppError(
            status_code=503,
            code="rate_limit_unavailable",
            message="Please try again shortly.",
        )

    def limit(self, action: str, identifier: str, network: str) -> None:
        # A generous network ceiling avoids blocking a whole campus behind one NAT.
        self._limit_one(
            f"{action}:network", network, allowed=500, window=timedelta(minutes=15)
        )
        self._limit_one(
            f"{action}:identity", identifier, allowed=10, window=timedelta(minutes=15)
        )

    def register(self, request: RegistrationRequest, network: str) -> str:
        self.limit("register", request.email, network)
        try:
            self.settings.require_otp_key()
            self.settings.require_smtp_configuration()
        except ValueError as exc:
            raise _unavailable("Email verification") from exc
        prepared = prepare_registration(request)
        exists = self.db.scalar(
            select(User).where(
                (func.lower(User.username) == prepared.username.casefold())
                | (func.lower(User.email) == prepared.email)
                | (
                    (User.role == prepared.role)
                    & (User.university_id == prepared.university_id)
                )
            )
        )
        if exists is not None:
            # Recover a pending sign-up if SMTP/the browser response failed.
            # Never overwrite an existing account or resume with a wrong password.
            if (
                exists.is_active
                and exists.verified_at is None
                and exists.email == prepared.email
                and exists.username.casefold() == prepared.username.casefold()
                and exists.role == prepared.role
                and exists.university_id == prepared.university_id
                and verify_password(
                    request.password.get_secret_value(), exists.password_hash
                )
            ):
                self.resend(prepared.email, network)
                return prepared.email
            raise AppError(
                status_code=409,
                code="account_conflict",
                message="An account already uses these details.",
            )
        self.db.add(
            User(
                first_name=prepared.first_name,
                last_name=prepared.last_name,
                home_address=prepared.home_address,
                username=prepared.username,
                email=prepared.email,
                password_hash=prepared.password_hash,
                role=prepared.role,
                university_id=prepared.university_id,
                is_active=True,
            )
        )
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise AppError(
                status_code=409,
                code="account_conflict",
                message="An account already uses these details.",
            ) from exc
        try:
            self.otp.issue_email_verification(prepared.email)
        except (EmailDeliveryError, OSError, ValueError) as exc:
            raise AppError(
                status_code=503,
                code="email_unavailable",
                message=(
                    "Account created, but the verification email could not be sent. "
                    "Please request another code."
                ),
            ) from exc
        return prepared.email

    def resend(self, email: str, network: str) -> None:
        self.limit("resend", email, network)
        user = self.db.scalar(select(User).where(User.email == email))
        if user is None or user.verified_at is not None or not user.is_active:
            return
        try:
            self.otp.issue_email_verification(email)
        except (OtpCooldownError, EmailDeliveryError, OSError, ValueError):
            # A generic response avoids disclosing whether an email has an account.
            return

    def verify(self, email: str, code: str, network: str) -> None:
        self.limit("verify", email, network)
        try:
            result = self.otp.verify_email(email, code)
        except ValueError as exc:
            raise _unavailable("Email verification") from exc
        if result == OtpCheckResult.VERIFIED:
            return
        if result == OtpCheckResult.EXPIRED:
            code_name, message = (
                "expired_otp",
                "This code has expired. Request a new one.",
            )
        elif result == OtpCheckResult.RATE_LIMITED:
            code_name, message = "otp_attempts_exceeded", "Request a new code."
        else:
            code_name, message = "invalid_otp", "The verification code is invalid."
        raise AppError(status_code=400, code=code_name, message=message)

    def login(
        self, identifier: str, password: str, network: str, *, admin: bool
    ) -> tuple[str, User, datetime]:
        self.limit("admin_login" if admin else "login", identifier, network)
        normalized = identifier.casefold()
        if admin:
            user = self.db.scalar(
                select(User)
                .where(func.lower(User.admin_id) == normalized, User.role == "admin")
                .with_for_update()
            )
        else:
            user = self.db.scalar(
                select(User)
                .where(
                    User.role != "admin",
                    (func.lower(User.username) == normalized)
                    | (func.lower(User.email) == normalized),
                )
                .with_for_update()
            )
        password_valid = verify_password(
            password, user.password_hash if user else _DUMMY_HASH
        )
        if (
            user is None
            or not password_valid
            or not user.is_active
            or user.verified_at is None
        ):
            raise _invalid_credentials()
        try:
            token = create_access_token(str(user.id), self.settings)
            claims = decode_access_token(token, self.settings)
        except ValueError as exc:
            raise _unavailable("JWT signing") from exc
        now = datetime.now(UTC)
        self.db.add(
            AuthSession(
                user_id=user.id,
                jti_digest=session_digest(claims.token_id),
                issued_at=now,
                expires_at=claims.expires_at,
            )
        )
        self.db.commit()
        return token, user, claims.expires_at


def get_auth_service(
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    otp: Annotated[OtpService, Depends(get_otp_service)],
) -> AuthService:
    return AuthService(db, settings, otp)
