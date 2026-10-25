"""Purpose-bound email challenges and single-use password-reset grants.

Uses the existing OTP table: no migration or production data rewrite is needed.
The Next.js BFF keeps challenge IDs and reset grants in HttpOnly cookies.
"""

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy import delete, select

from app.core.email import EmailDeliveryError
from app.core.errors import AppError
from app.core.security import hash_password
from app.core.validation import normalize_cuet_email
from app.db.models import OtpChallengeRecord, User
from app.modules.auth.persistence import as_utc, revoke_user_sessions
from app.modules.auth.service import AuthService, _unavailable


class EmailCodeFlows:
    def __init__(self, auth: AuthService) -> None:
        self.auth = auth
        self.db = auth.db
        self.settings = auth.settings

    def _digest(self, purpose: str, challenge_id: str, code: str) -> str:
        return hmac.new(
            self.settings.require_otp_key(),
            f"{purpose}:{challenge_id}:{code}".encode(),
            hashlib.sha256,
        ).hexdigest()

    def _lock_user(self, user_id) -> User | None:
        return self.db.scalar(
            select(User)
            .where(User.id == user_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    @staticmethod
    def _eligible(user: User | None) -> bool:
        return bool(user and user.is_active and user.role != "admin" and user.email)

    def forgot_password(self, email: str, network: str) -> dict:
        self.auth.limit("password_recovery", email, network)
        # Same response shape for unknown, inactive and provisioned-admin accounts.
        fallback = {
            "flow": "reset",
            "email": email,
            "expiresAt": datetime.now(UTC)
            + timedelta(minutes=self.settings.otp_expiry_minutes),
        }
        try:
            self.settings.require_otp_key()
            self.settings.require_smtp_configuration()
        except ValueError as exc:
            raise _unavailable("Password recovery email delivery") from exc
        # Issue the same stateless, nonce-randomized ticket for every address.
        # Repeated requests must not reveal account existence via ID/expiry reuse.
        fallback["challengeId"] = jwt.encode(
            {
                "sub": email,
                "iss": "unicircle-password-recovery",
                "aud": "password-recovery",
                "iat": datetime.now(UTC),
                "exp": fallback["expiresAt"],
                "jti": secrets.token_urlsafe(32),
            },
            self._ticket_key(),
            algorithm="HS256",
        )
        user = self.db.scalar(select(User).where(User.email == email).with_for_update())
        if not self._eligible(user):
            self.db.rollback()
            return fallback
        try:
            self._issue(user, "password_reset")
        except (AppError, EmailDeliveryError, OSError, ValueError):
            # Provider/account details must not disclose which addresses exist.
            return fallback
        return fallback

    def _ticket_key(self) -> bytes:
        return hmac.new(
            self.settings.require_otp_key(),
            b"unicircle-password-recovery-ticket",
            hashlib.sha256,
        ).digest()

    def _recovery_challenge(self, ticket: str):
        try:
            claims = jwt.decode(
                ticket,
                self._ticket_key(),
                algorithms=["HS256"],
                issuer="unicircle-password-recovery",
                audience="password-recovery",
                options={"require": ["sub", "exp", "iat", "jti"]},
            )
            email = normalize_cuet_email(claims["sub"])
        except (jwt.InvalidTokenError, ValueError, TypeError, KeyError):
            raise AppError(
                status_code=400,
                code="invalid_otp",
                message="The code is incorrect or has expired. Request a new code.",
            ) from None
        user = self.db.scalar(select(User).where(User.email == email).with_for_update())
        row = self.db.scalar(
            select(OtpChallengeRecord)
            .where(
                OtpChallengeRecord.recipient_email == email,
                OtpChallengeRecord.purpose == "password_reset",
            )
            .execution_options(populate_existing=True)
        )
        if not self._eligible(user) or row is None or row.consumed_at is not None:
            self.db.rollback()
            raise AppError(
                status_code=400,
                code="invalid_otp",
                message="The code is incorrect or has expired. Request a new code.",
            )
        return user, row

    def _issue(self, user: User, purpose: str) -> dict:
        """Caller holds the user lock; commit before SMTP, discard failed sends."""
        now = datetime.now(UTC)
        row = self.db.scalar(
            select(OtpChallengeRecord).where(
                OtpChallengeRecord.user_id == user.id,
                OtpChallengeRecord.purpose == purpose,
            )
        )
        cooldown = timedelta(seconds=self.settings.otp_resend_cooldown_seconds)
        if row and now < as_utc(row.issued_at) + cooldown:
            if row.consumed_at is not None or row.attempts_remaining <= 0:
                self.db.rollback()
                raise AppError(
                    status_code=429,
                    code="rate_limited",
                    message="Please wait before requesting another code.",
                )
            result = self._response(row)
            self.db.rollback()
            return result
        code = self.auth.otp.new_code()
        # A new issue invalidates both the previous code and its challenge ID.
        challenge_id = secrets.token_urlsafe(32)
        if row is None:
            row = OtpChallengeRecord(
                id=challenge_id,
                user_id=user.id,
                recipient_email=user.email,
                purpose=purpose,
            )
            self.db.add(row)
        row.id = challenge_id
        row.digest = self._digest(purpose, challenge_id, code)
        row.issued_at = now
        row.expires_at = now + timedelta(minutes=self.settings.otp_expiry_minutes)
        row.attempts_remaining = self.settings.otp_max_attempts
        row.consumed_at = None
        result = self._response(row)
        issued_digest = row.digest
        self.db.execute(
            delete(OtpChallengeRecord).where(
                OtpChallengeRecord.user_id == user.id,
                OtpChallengeRecord.purpose == "password_reset_grant",
            )
        )
        self.db.commit()
        try:
            self.auth.otp.sender.send_auth_code(
                user.email, code, self.settings.otp_expiry_minutes, purpose
            )
        except Exception:
            # Match the exact challenge; never discard a newer concurrent issue.
            self.db.execute(
                delete(OtpChallengeRecord).where(
                    OtpChallengeRecord.id == challenge_id,
                    OtpChallengeRecord.digest == issued_digest,
                )
            )
            self.db.commit()
            raise
        return result

    @staticmethod
    def _response(row: OtpChallengeRecord) -> dict:
        return {
            "flow": "reset",
            "email": row.recipient_email,
            "challengeId": row.id,
            "expiresAt": as_utc(row.expires_at),
        }

    def _challenge(self, challenge_id: str, purpose: str):
        user_id = self.db.scalar(
            select(OtpChallengeRecord.user_id).where(
                OtpChallengeRecord.id == challenge_id,
                OtpChallengeRecord.purpose == purpose,
            )
        )
        user = self._lock_user(user_id) if user_id else None
        row = self.db.scalar(
            select(OtpChallengeRecord)
            .where(
                OtpChallengeRecord.id == challenge_id,
                OtpChallengeRecord.purpose == purpose,
            )
            .execution_options(populate_existing=True)
        )
        if not self._eligible(user) or row is None or row.consumed_at is not None:
            self.db.rollback()
            raise AppError(
                status_code=400,
                code="invalid_otp",
                message="The code is incorrect or has expired. Request a new code.",
            )
        return user, row

    def verify(self, challenge_id: str, code: str, purpose: str, network: str):
        self.auth.limit(f"{purpose}_verify", challenge_id, network)
        user, row = self._recovery_challenge(challenge_id)
        now = datetime.now(UTC)
        if as_utc(row.expires_at) <= now:
            self.db.rollback()
            raise AppError(
                status_code=400,
                code="invalid_otp",
                message="The code is incorrect or has expired. Request a new code.",
            )
        if row.attempts_remaining <= 0:
            self.db.rollback()
            raise AppError(
                status_code=400,
                code="invalid_otp",
                message="The code is incorrect or has expired. Request a new code.",
            )
        if not hmac.compare_digest(row.digest, self._digest(purpose, row.id, code)):
            row.attempts_remaining -= 1
            self.db.commit()
            raise AppError(
                status_code=400,
                code="invalid_otp",
                message="The code is incorrect or has expired. Request a new code.",
            )
        row.consumed_at = now
        token = secrets.token_urlsafe(32)
        self.db.execute(
            delete(OtpChallengeRecord).where(
                OtpChallengeRecord.user_id == user.id,
                OtpChallengeRecord.purpose == "password_reset_grant",
            )
        )
        expires_at = now + timedelta(minutes=10)
        digest = hashlib.sha256(token.encode()).hexdigest()
        self.db.add(
            OtpChallengeRecord(
                id=digest,
                user_id=user.id,
                recipient_email=user.email,
                purpose="password_reset_grant",
                digest=digest,
                issued_at=now,
                expires_at=expires_at,
                attempts_remaining=0,
            )
        )
        self.db.commit()
        return {"resetToken": token, "expiresAt": expires_at}

    def reset_password(self, token: str, password: str, network: str) -> None:
        digest = hashlib.sha256(token.encode()).hexdigest()
        self.auth.limit("password_reset", digest, network)
        user, grant = self._challenge(digest, "password_reset_grant")
        if as_utc(grant.expires_at) <= datetime.now(UTC):
            self.db.rollback()
            raise AppError(
                status_code=400,
                code="expired_otp",
                message="Password reset expired. Request another code.",
            )
        user.password_hash = hash_password(password)
        user.verified_at = user.verified_at or datetime.now(UTC)
        revoke_user_sessions(self.db, user.id)
        self.db.execute(
            delete(OtpChallengeRecord).where(OtpChallengeRecord.user_id == user.id)
        )
        self.db.commit()
