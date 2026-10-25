"""Repository-level secret, CORS, and privacy regression checks."""

import subprocess
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.config import Settings

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def git(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *arguments],
        cwd=REPOSITORY_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


def test_real_environment_file_is_ignored_and_not_tracked():
    assert git("check-ignore", "-q", ".env").returncode == 0
    assert git("ls-files", "--error-unmatch", ".env").returncode != 0
    example = (REPOSITORY_ROOT / ".env.example").read_text(encoding="utf-8")
    assert "replace-with-a-long-random-secret" in example
    assert "SMTP_PASSWORD=replace-me" in example


def test_production_rejects_placeholder_secrets_and_uses_narrow_cors():
    with pytest.raises(ValidationError):
        Settings(
            app_env="production",
            frontend_url="https://unicircle.example",
            database_url="postgresql+psycopg://user:pass@db/unicircle",
            jwt_secret="replace-with-a-long-random-secret",
            otp_pepper="replace-with-a-different-long-random-secret",
            _env_file=None,
        )

    settings = Settings(
        app_env="testing",
        frontend_url="https://unicircle.example",
        database_url="postgresql+psycopg://user:pass@db/unicircle_test",
        jwt_secret="j" * 48,
        otp_pepper="o" * 48,
        _env_file=None,
    )
    assert settings.cors_origins == ["https://unicircle.example"]
    assert "*" not in settings.cors_origins
