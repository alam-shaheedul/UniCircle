"""Groq integration contract tests; no real API keys or network calls."""

from types import SimpleNamespace

import pytest
import requests
from pydantic import SecretStr, ValidationError

from app.core.config import LOCAL_DATABASE_URL, Settings
from app.core.errors import AppError
from app.modules.assistant.service import (
    SYSTEM_PROMPT,
    GroqChatProvider,
    create_chat_provider,
)


def groq_settings(settings, **updates):
    return settings.model_copy(
        update={"groq_api_key": SecretStr("test-only-private-key"), **updates}
    )


def stub_response(monkeypatch, payload, status=200):
    calls = []

    def post(url, **kwargs):
        calls.append((url, kwargs))
        return SimpleNamespace(status_code=status, json=lambda: payload)

    monkeypatch.setattr("app.modules.assistant.service.requests.post", post)
    return calls


def test_groq_sends_only_grounded_prompt_and_returns_final_content(
    settings, monkeypatch
):
    calls = stub_response(
        monkeypatch,
        {
            "choices": [
                {"message": {"content": " CUET is in Raozan. ", "reasoning": "private"}}
            ]
        },
    )
    provider = GroqChatProvider(groq_settings(settings))
    assert provider.answer(question="Where is CUET?", context="Raozan") == (
        "CUET is in Raozan."
    )
    url, kwargs = calls[0]
    assert url == GroqChatProvider.ENDPOINT
    assert kwargs["headers"]["Authorization"] == "Bearer test-only-private-key"
    body = kwargs["json"]
    assert body["model"] == "qwen/qwen3.8-27b"
    assert body["messages"] == [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": "CUET SOURCE EXCERPTS:\nRaozan\n\nQUESTION:\nWhere is CUET?",
        },
    ]
    assert body["max_completion_tokens"] == 512
    assert body["reasoning_effort"] == "none"
    assert body["reasoning_format"] == "hidden"
    assert kwargs["timeout"] == (5, 60)
    assert kwargs["allow_redirects"] is False
    assert "test-only-private-key" not in repr(provider)


def test_custom_groq_limits_are_used(settings, monkeypatch):
    calls = stub_response(monkeypatch, {"choices": [{"message": {"content": "CUET"}}]})
    provider = GroqChatProvider(
        groq_settings(settings, groq_timeout_seconds=30, groq_max_output_tokens=256)
    )
    provider.answer(question="CUET?", context="CUET")
    assert calls[0][1]["timeout"] == (5, 30)
    assert calls[0][1]["json"]["max_completion_tokens"] == 256


@pytest.mark.parametrize(
    ("upstream_status", "status", "code"),
    [
        (429, 429, "assistant_provider_rate_limited"),
        (401, 503, "assistant_not_configured"),
        (403, 503, "assistant_not_configured"),
        (404, 503, "assistant_not_configured"),
        (400, 503, "assistant_provider_failed"),
        (302, 503, "assistant_provider_failed"),
        (500, 503, "assistant_provider_failed"),
        (503, 503, "assistant_provider_failed"),
    ],
)
def test_upstream_errors_are_safe(settings, monkeypatch, upstream_status, status, code):
    stub_response(
        monkeypatch,
        {"error": {"message": "test-only-private-key and internal provider detail"}},
        upstream_status,
    )
    with pytest.raises(AppError) as caught:
        GroqChatProvider(groq_settings(settings)).answer(
            question="CUET?", context="CUET"
        )
    assert caught.value.status_code == status
    assert caught.value.code == code
    assert "private" not in caught.value.message


@pytest.mark.parametrize("problem", [requests.Timeout, requests.ConnectionError])
def test_network_failures_are_safe(settings, monkeypatch, problem):
    def fail(*args, **kwargs):
        raise problem("test-only-private-key must never reach API clients")

    monkeypatch.setattr("app.modules.assistant.service.requests.post", fail)
    with pytest.raises(AppError) as caught:
        GroqChatProvider(groq_settings(settings)).answer(
            question="CUET?", context="CUET"
        )
    assert caught.value.status_code == 503
    assert caught.value.code == "assistant_unavailable"
    assert "private" not in caught.value.message


@pytest.mark.parametrize(
    "payload",
    [None, {}, {"choices": []}, {"choices": [None]}]
    + [{"choices": [{"message": {"content": value}}]} for value in (None, [], "", " ")],
)
def test_malformed_and_empty_responses_are_safe(settings, monkeypatch, payload):
    stub_response(monkeypatch, payload)
    with pytest.raises(AppError) as caught:
        GroqChatProvider(groq_settings(settings)).answer(
            question="CUET?", context="CUET"
        )
    assert caught.value.code == "assistant_provider_failed"


def test_non_json_response_is_safe(settings, monkeypatch):
    def invalid_json():
        raise ValueError("private response body")

    monkeypatch.setattr(
        "app.modules.assistant.service.requests.post",
        lambda *args, **kwargs: SimpleNamespace(status_code=200, json=invalid_json),
    )
    with pytest.raises(AppError) as caught:
        GroqChatProvider(groq_settings(settings)).answer(
            question="CUET?", context="CUET"
        )
    assert caught.value.code == "assistant_provider_failed"


@pytest.mark.parametrize("key", [None, SecretStr(" "), SecretStr("replace-with-a-key")])
def test_explicit_groq_requires_key_without_local_fallback(settings, key):
    configured = settings.model_copy(
        update={"rag_chat_provider": "groq", "groq_api_key": key}
    )
    with pytest.raises(AppError) as caught:
        create_chat_provider(configured)
    assert caught.value.code == "assistant_not_configured"


def test_auto_uses_groq_with_key_and_local_without_key(settings, monkeypatch):
    local = object()
    monkeypatch.setattr(
        "app.modules.assistant.service.OllamaChatProvider", lambda _: local
    )
    assert isinstance(create_chat_provider(groq_settings(settings)), GroqChatProvider)
    assert (
        create_chat_provider(settings.model_copy(update={"groq_api_key": None}))
        is local
    )
    assert (
        create_chat_provider(groq_settings(settings, rag_chat_provider="ollama"))
        is local
    )


def test_dotenv_selects_groq_and_masks_key(tmp_path):
    # Never read the developer's real .env in tests.
    env_file = tmp_path / ".env"
    env_file.write_text("GROQ_API_KEY=test-only-private-key\n", encoding="utf-8")
    configured = Settings(
        app_env="development",
        database_url=LOCAL_DATABASE_URL,
        rag_chat_provider="auto",
        _env_file=env_file,
    )
    assert configured.assistant_chat_provider == "groq"
    assert "test-only-private-key" not in repr(configured)
    assert "test-only-private-key" not in configured.model_dump_json()


@pytest.mark.parametrize(
    "updates",
    [
        {"groq_timeout_seconds": 0},
        {"groq_max_output_tokens": 999999},
        {"groq_chat_model": ""},
        {"rag_chat_provider": "unknown"},
    ],
)
def test_invalid_groq_configuration_is_rejected(updates):
    with pytest.raises(ValidationError):
        Settings(database_url=LOCAL_DATABASE_URL, _env_file=None, **updates)
