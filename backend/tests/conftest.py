"""Reusable fixtures shared by Phase 6 and later feature tests."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import LOCAL_DATABASE_URL, Settings
from app.main import create_app
from tests.fakes import (
    FakeIdentityLookup,
    FakeNotificationRepository,
    FakeOtpStore,
    FakeVerificationEmailSender,
)


@pytest.fixture
def settings() -> Settings:
    return Settings(
        app_env="development",
        frontend_url="http://localhost:3000",
        database_url=LOCAL_DATABASE_URL,
        jwt_secret="j" * 48,
        otp_pepper="o" * 48,
        _env_file=None,
    )


@pytest.fixture
def client(settings: Settings):
    application = create_app(settings)
    with TestClient(application) as test_client:
        yield test_client


@pytest.fixture
def identity_lookup() -> FakeIdentityLookup:
    return FakeIdentityLookup()


@pytest.fixture
def otp_store() -> FakeOtpStore:
    return FakeOtpStore()


@pytest.fixture
def email_sender() -> FakeVerificationEmailSender:
    return FakeVerificationEmailSender()


@pytest.fixture
def notification_repository() -> FakeNotificationRepository:
    return FakeNotificationRepository()
