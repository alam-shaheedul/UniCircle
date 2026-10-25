"""Transactional PostgreSQL adapters for OTPs, users, and live sessions."""

import hashlib
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.auth import AuthIdentity
from app.core.otp import OtpChallenge, OtpCheckResult, digests_match
from app.db.models import AuthSession, OtpChallengeRecord, User


def session_digest(token_id: str) -> str:
    return hashlib.sha256(token_id.encode("utf-8")).hexdigest()


def as_utc(value: datetime) -> datetime:
    """SQLite-based tests can return naive timestamps; PostgreSQL returns UTC-aware."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


class DatabaseIdentityLookup:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, user_id: str, token_id: str) -> AuthIdentity | None:
        try:
            parsed_id = uuid.UUID(user_id)
        except ValueError:
            return None
        now = datetime.now(UTC)
        statement = (
            select(User)
            .join(AuthSession, AuthSession.user_id == User.id)
            .where(
                User.id == parsed_id,
                AuthSession.jti_digest == session_digest(token_id),
                AuthSession.revoked_at.is_(None),
                AuthSession.expires_at > now,
            )
        )
        user = self.db.scalar(statement)
        if user is None:
            return None
        return AuthIdentity(
            id=str(user.id),
            role=user.role,
            is_active=user.is_active,
            is_verified=user.verified_at is not None,
        )


def revoke_session(db: Session, token_id: str) -> None:
    db.execute(
        update(AuthSession)
        .where(AuthSession.jti_digest == session_digest(token_id))
        .values(revoked_at=datetime.now(UTC))
    )
    db.commit()


def revoke_user_sessions(db: Session, user_id: uuid.UUID) -> None:
    """Use in the same transaction that deactivates an account."""
    db.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


class DatabaseOtpStore:
    """User-row lock serializes challenge issuance and consumption per account."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def put_if_allowed(self, challenge: OtpChallenge, *, cooldown: timedelta) -> bool:
        user = self.db.scalar(
            select(User)
            .where(User.email == challenge.recipient, User.role != "admin")
            .with_for_update()
        )
        if user is None or user.verified_at is not None or not user.is_active:
            self.db.rollback()
            return False
        current = self.db.scalar(
            select(OtpChallengeRecord).where(
                OtpChallengeRecord.recipient_email == challenge.recipient,
                OtpChallengeRecord.purpose == challenge.purpose,
            )
        )
        if current and challenge.issued_at < as_utc(current.issued_at) + cooldown:
            self.db.rollback()
            return False
        if current is None:
            current = OtpChallengeRecord(
                id=challenge.id,
                user_id=user.id,
                recipient_email=challenge.recipient,
                purpose=challenge.purpose,
                digest=challenge.digest,
                attempts_remaining=challenge.attempts_remaining,
                issued_at=challenge.issued_at,
                expires_at=challenge.expires_at,
            )
            self.db.add(current)
        else:
            current.id = challenge.id
            current.digest = challenge.digest
            current.attempts_remaining = challenge.attempts_remaining
            current.issued_at = challenge.issued_at
            current.expires_at = challenge.expires_at
            current.consumed_at = None
        # Commit before SMTP, so a failed send can explicitly discard the row.
        self.db.commit()
        return True

    def check_and_consume(
        self, recipient: str, purpose: str, digest: str, *, now: datetime
    ) -> OtpCheckResult:
        user = self.db.scalar(
            select(User).where(User.email == recipient).with_for_update()
        )
        if user is None or user.verified_at is not None or not user.is_active:
            self.db.rollback()
            return OtpCheckResult.MISSING
        challenge = self.db.scalar(
            select(OtpChallengeRecord).where(
                OtpChallengeRecord.recipient_email == recipient,
                OtpChallengeRecord.purpose == purpose,
            )
        )
        if challenge is None or challenge.consumed_at is not None:
            self.db.rollback()
            return OtpCheckResult.MISSING
        if as_utc(challenge.expires_at) <= now:
            self.db.rollback()
            return OtpCheckResult.EXPIRED
        if challenge.attempts_remaining <= 0:
            self.db.rollback()
            return OtpCheckResult.RATE_LIMITED
        if not digests_match(challenge.digest, digest):
            challenge.attempts_remaining -= 1
            self.db.commit()
            return OtpCheckResult.INVALID
        challenge.consumed_at = now
        user.verified_at = now
        self.db.commit()
        return OtpCheckResult.VERIFIED

    def discard(self, challenge_id: str) -> None:
        challenge = self.db.get(OtpChallengeRecord, challenge_id)
        if challenge is not None:
            self.db.delete(challenge)
            self.db.commit()
