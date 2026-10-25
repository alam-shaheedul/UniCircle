"""OTP expiry, replay, rate limits, and TLS-only email delivery."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage

import pytest

from app.core.config import Settings
from app.core.email import SmtpVerificationEmailSender
from app.core.otp import OtpCheckResult, OtpCooldownError, OtpService
from tests.fakes import FakeOtpStore, FakeVerificationEmailSender


def make_otp_service(
    settings: Settings, store: FakeOtpStore, sender: FakeVerificationEmailSender
) -> OtpService:
    return OtpService(store=store, sender=sender, settings=settings)


def test_otp_is_hashed_expires_and_cannot_be_replayed(
    settings: Settings,
    otp_store: FakeOtpStore,
    email_sender: FakeVerificationEmailSender,
) -> None:
    service = make_otp_service(settings, otp_store, email_sender)
    expires_at = service.issue_email_verification("Anika@CUET.ac.bd")
    recipient, code, ttl = email_sender.sent[0]
    challenge = otp_store.challenges[(recipient, service.PURPOSE)]

    assert recipient == "anika@cuet.ac.bd"
    assert len(code) == 6 and code.isdigit()
    assert ttl == settings.otp_expiry_minutes
    assert code not in challenge.digest
    assert expires_at > datetime.now(UTC)
    assert service.verify_email(
        recipient, "111111" if code != "111111" else "222222"
    ) == (OtpCheckResult.INVALID)
    assert service.verify_email(recipient, code) == OtpCheckResult.VERIFIED
    assert service.verify_email(recipient, code) == OtpCheckResult.MISSING


def test_otp_resend_cooldown_and_attempt_limit(
    settings: Settings,
    otp_store: FakeOtpStore,
    email_sender: FakeVerificationEmailSender,
) -> None:
    service = make_otp_service(settings, otp_store, email_sender)
    service.issue_email_verification("anika@cuet.ac.bd")
    with pytest.raises(OtpCooldownError):
        service.issue_email_verification("anika@cuet.ac.bd")

    correct_code = email_sender.sent[0][1]
    wrong_code = "999999" if correct_code != "999999" else "888888"
    for _ in range(settings.otp_max_attempts - 1):
        assert service.verify_email("anika@cuet.ac.bd", wrong_code) == (
            OtpCheckResult.INVALID
        )
    assert service.verify_email("anika@cuet.ac.bd", wrong_code) == (
        OtpCheckResult.RATE_LIMITED
    )
    assert service.verify_email("anika@cuet.ac.bd", correct_code) == (
        OtpCheckResult.RATE_LIMITED
    )


def test_expired_otp_and_failed_delivery(
    settings: Settings,
    otp_store: FakeOtpStore,
    email_sender: FakeVerificationEmailSender,
) -> None:
    service = make_otp_service(settings, otp_store, email_sender)
    email_sender.should_fail = True
    with pytest.raises(RuntimeError, match="fake provider failure"):
        service.issue_email_verification("anika@cuet.ac.bd")
    assert not otp_store.challenges

    email_sender.should_fail = False
    service.issue_email_verification("anika@cuet.ac.bd")
    key = ("anika@cuet.ac.bd", service.PURPOSE)
    otp_store.challenges[key] = replace(
        otp_store.challenges[key], expires_at=datetime.now(UTC) - timedelta(seconds=1)
    )
    assert service.verify_email(key[0], email_sender.sent[0][1]) == (
        OtpCheckResult.EXPIRED
    )


def test_otp_rejects_non_cuet_email(
    settings: Settings,
    otp_store: FakeOtpStore,
    email_sender: FakeVerificationEmailSender,
) -> None:
    service = make_otp_service(settings, otp_store, email_sender)
    with pytest.raises(ValueError, match="cuet.ac.bd"):
        service.issue_email_verification("person@gmail.com")


class FakeSmtpConnection:
    events: list[str] = []
    message: EmailMessage | None = None

    def __init__(self, *args, **kwargs) -> None:
        self.events.append("connect")

    def __enter__(self):
        return self

    def __exit__(self, *args) -> None:
        self.events.append("close")

    def ehlo(self) -> None:
        self.events.append("ehlo")

    def starttls(self, *, context) -> None:
        self.events.append("starttls")

    def login(self, username: str, password: str) -> None:
        self.events.append("login")

    def send_message(self, message: EmailMessage) -> None:
        self.events.append("send")
        type(self).message = message


@pytest.mark.parametrize("purpose", ["email_verification", "password_reset"])
def test_smtp_sender_upgrades_to_tls_before_authentication(
    settings: Settings, monkeypatch: pytest.MonkeyPatch, purpose: str
) -> None:
    FakeSmtpConnection.events = []
    FakeSmtpConnection.message = None
    monkeypatch.setattr("app.core.email.smtplib.SMTP", FakeSmtpConnection)
    configured = settings.model_copy(
        update={
            "smtp_host": "mail.cuet.ac.bd",
            "smtp_username": "sender",
            "smtp_password": settings.jwt_secret,
            "smtp_from_email": "noreply@cuet.ac.bd",
        }
    )
    sender = SmtpVerificationEmailSender(configured)
    sender.send_auth_code("anika@cuet.ac.bd", "123456", 10, purpose)

    assert FakeSmtpConnection.events.index(
        "starttls"
    ) < FakeSmtpConnection.events.index("login")
    assert FakeSmtpConnection.message is not None
    assert FakeSmtpConnection.message["To"] == "anika@cuet.ac.bd"
    assert "123456" in FakeSmtpConnection.message.get_content()
    assert ("password reset" in FakeSmtpConnection.message["Subject"]) == (
        purpose == "password_reset"
    )


def test_smtp_sender_fails_closed_without_credentials(settings: Settings) -> None:
    sender = SmtpVerificationEmailSender(settings)
    with pytest.raises(ValueError, match="SMTP configuration"):
        sender.send_verification_code("anika@cuet.ac.bd", "123456", 10)
