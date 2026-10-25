"""TLS-only SMTP delivery for CUET account verification messages."""

import smtplib
import ssl
from email.message import EmailMessage
from typing import Annotated, Protocol

from email_validator import EmailNotValidError, validate_email
from fastapi import Depends

from app.core.config import Settings, get_settings
from app.core.validation import normalize_cuet_email


class EmailDeliveryError(Exception):
    """Delivery failed; no provider details should be returned to a user."""


class VerificationEmailSender(Protocol):
    def send_verification_code(
        self, recipient: str, code: str, expires_in_minutes: int
    ) -> None: ...

    def send_auth_code(
        self, recipient: str, code: str, expires_in_minutes: int, purpose: str
    ) -> None: ...


class SmtpVerificationEmailSender:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def send_verification_code(
        self, recipient: str, code: str, expires_in_minutes: int
    ) -> None:
        self.send_auth_code(recipient, code, expires_in_minutes, "email_verification")

    def send_auth_code(
        self, recipient: str, code: str, expires_in_minutes: int, purpose: str
    ) -> None:
        recipient = normalize_cuet_email(recipient)
        host, port, username, password, sender, tls_mode = (
            self.settings.require_smtp_configuration()
        )
        try:
            sender = validate_email(sender, check_deliverability=False).normalized
        except EmailNotValidError as exc:
            raise ValueError("SMTP_FROM_EMAIL is invalid") from exc

        message = EmailMessage()
        message["From"] = sender
        message["To"] = recipient
        action = {
            "email_verification": "verification",
            "password_reset": "password reset",
        }[purpose]
        message["Subject"] = f"Your UniCircle {action} code"
        message.set_content(
            f"Your UniCircle {action} code is {code}. "
            f"It expires in {expires_in_minutes} minutes. "
            "Never share this code. If you did not request this, ignore this message."
        )
        context = ssl.create_default_context()
        try:
            if tls_mode == "ssl":
                with smtplib.SMTP_SSL(host, port, timeout=10, context=context) as smtp:
                    smtp.login(username, password)
                    smtp.send_message(message)
            else:
                with smtplib.SMTP(host, port, timeout=10) as smtp:
                    smtp.ehlo()
                    smtp.starttls(context=context)
                    smtp.ehlo()
                    smtp.login(username, password)
                    smtp.send_message(message)
        except (OSError, smtplib.SMTPException) as exc:
            raise EmailDeliveryError("Verification email could not be sent") from exc


def get_verification_email_sender(
    settings: Annotated[Settings, Depends(get_settings)],
) -> VerificationEmailSender:
    return SmtpVerificationEmailSender(settings)
