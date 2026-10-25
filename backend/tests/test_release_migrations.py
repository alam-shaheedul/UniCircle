"""Offline tests for production migration guards; never connect to Neon."""

from types import SimpleNamespace

import pytest

from app.db.release import NEON_BRANCH, NEON_HOST, apply_guard, direct_url


def url(**updates):
    values = {
        "host": NEON_HOST,
        "database": "neondb",
        "scheme": "postgresql",
        "query": "sslmode=require",
    }
    values.update(updates)
    return (
        f"{values['scheme']}://operator:test-only-password@{values['host']}/"
        f"{values['database']}?{values['query']}"
    )


def test_direct_endpoint_is_normalized_without_exposing_password():
    parsed = direct_url(url())
    assert parsed.drivername == "postgresql+psycopg"
    assert "test-only-password" not in str(parsed)


@pytest.mark.parametrize(
    "value",
    [
        None,
        "not-a-url",
        url(host=NEON_HOST.replace(".c-6", "-pooler.c-6")),
        url(host="another.neon.tech"),
        url(database="other"),
        url(query="sslmode=disable"),
        url(query="sslmode=require&options=-csearch_path=other"),
        url(scheme="mysql"),
    ],
)
def test_rejects_unsafe_targets_without_leaking_credentials(value):
    with pytest.raises(ValueError) as caught:
        direct_url(value)
    assert "test-only-password" not in str(caught.value)


def arguments(**updates):
    return SimpleNamespace(
        **{
            "apply": True,
            "confirm_branch": NEON_BRANCH,
            "from_revision": "old",
            "to_revision": "new",
            "backup_reference": "reviewed-snapshot-id",
            "expand_only_confirmed": True,
            **updates,
        }
    )


def test_apply_requires_explicit_operator_confirmations():
    apply_guard(arguments(), ("old",), "new")


@pytest.mark.parametrize(
    "updates",
    [
        {"confirm_branch": "wrong"},
        {"from_revision": None},
        {"from_revision": "wrong"},
        {"to_revision": "wrong"},
        {"backup_reference": ""},
        {"expand_only_confirmed": False},
    ],
)
def test_missing_confirmations_block_writes(updates):
    with pytest.raises(ValueError):
        apply_guard(arguments(**updates), ("old",), "new")


def test_read_only_preflight_needs_no_apply_confirmation():
    apply_guard(arguments(apply=False), ("old",), "new")
