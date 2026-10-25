"""Test-only stores; none of these are wired into the production application."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from threading import Lock

from app.core.auth import AuthIdentity
from app.core.notifications import NotificationDraft, NotificationRecord
from app.core.otp import OtpChallenge, OtpCheckResult, digests_match


class FakeIdentityLookup:
    def __init__(self) -> None:
        self.identities: dict[str, AuthIdentity] = {}

    def get_by_id(self, user_id: str, _token_id: str) -> AuthIdentity | None:
        return self.identities.get(user_id)


class FakeVerificationEmailSender:
    def __init__(self) -> None:
        self.sent: list[tuple[str, str, int]] = []
        self.should_fail = False

    def send_verification_code(
        self, recipient: str, code: str, expires_in_minutes: int
    ) -> None:
        if self.should_fail:
            raise RuntimeError("fake provider failure")
        self.sent.append((recipient, code, expires_in_minutes))

    def send_auth_code(
        self, recipient: str, code: str, expires_in_minutes: int, purpose: str
    ) -> None:
        self.send_verification_code(recipient, code, expires_in_minutes)


class FakeOtpStore:
    def __init__(self) -> None:
        self.challenges: dict[tuple[str, str], OtpChallenge] = {}
        self.last_issued: dict[tuple[str, str], datetime] = {}
        self.lock = Lock()

    def put_if_allowed(self, challenge: OtpChallenge, *, cooldown: timedelta) -> bool:
        key = (challenge.recipient, challenge.purpose)
        with self.lock:
            previous = self.last_issued.get(key)
            if previous and challenge.issued_at - previous < cooldown:
                return False
            self.challenges[key] = challenge
            self.last_issued[key] = challenge.issued_at
            return True

    def check_and_consume(
        self, recipient: str, purpose: str, digest: str, *, now: datetime
    ) -> OtpCheckResult:
        key = (recipient, purpose)
        with self.lock:
            challenge = self.challenges.get(key)
            if challenge is None:
                return OtpCheckResult.MISSING
            if now >= challenge.expires_at:
                self.challenges.pop(key)
                return OtpCheckResult.EXPIRED
            if challenge.attempts_remaining <= 0:
                return OtpCheckResult.RATE_LIMITED
            if digests_match(challenge.digest, digest):
                self.challenges.pop(key)
                return OtpCheckResult.VERIFIED
            remaining = challenge.attempts_remaining - 1
            self.challenges[key] = replace(challenge, attempts_remaining=remaining)
            return (
                OtpCheckResult.RATE_LIMITED
                if remaining == 0
                else OtpCheckResult.INVALID
            )

    def discard(self, challenge_id: str) -> None:
        with self.lock:
            for key, challenge in list(self.challenges.items()):
                if challenge.id == challenge_id:
                    self.challenges.pop(key)
                    self.last_issued.pop(key, None)


class FakeNotificationRepository:
    def __init__(self) -> None:
        self.records: dict[str, NotificationRecord] = {}
        self.dedupe: dict[tuple[str, str], str] = {}

    def create_once(self, draft: NotificationDraft) -> NotificationRecord:
        key = (draft.user_id, draft.dedupe_key)
        existing_id = self.dedupe.get(key)
        if existing_id:
            existing = self.records[existing_id]
            updated = NotificationRecord(
                **draft.__dict__,
                id=existing.id,
                created_at=existing.created_at,
                read_at=existing.read_at,
            )
            self.records[existing_id] = updated
            return updated
        record = NotificationRecord(
            **draft.__dict__,
            id=f"notification-{len(self.records) + 1}",
            created_at=datetime.now(UTC),
        )
        self.records[record.id] = record
        self.dedupe[key] = record.id
        return record

    def list_for_user(
        self, user_id: str, *, limit: int, offset: int
    ) -> tuple[list[NotificationRecord], int]:
        mine = [item for item in self.records.values() if item.user_id == user_id]
        mine.sort(
            key=lambda item: item.created_at or datetime.min.replace(tzinfo=UTC),
            reverse=True,
        )
        return mine[offset : offset + limit], len(mine)

    def mark_read(
        self, user_id: str, notification_id: str, *, now: datetime
    ) -> NotificationRecord | None:
        record = self.records.get(notification_id)
        if record is None or record.user_id != user_id:
            return None
        updated = replace(record, read_at=record.read_at or now)
        self.records[notification_id] = updated
        return updated

    def mark_all_read(self, user_id: str, *, now: datetime) -> int:
        updated = 0
        for notification_id, record in list(self.records.items()):
            if record.user_id == user_id and record.read_at is None:
                self.records[notification_id] = replace(record, read_at=now)
                updated += 1
        return updated
