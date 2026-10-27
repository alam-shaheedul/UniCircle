"""Notification ownership/deduplication and shared input bounds."""

import pytest
from pydantic import ValidationError

from app.core.notifications import NotificationDraft, NotificationService
from app.core.pagination import Pagination
from app.core.validation import normalize_cuet_email, require_nonblank
from tests.fakes import FakeNotificationRepository


def test_cuet_email_validation_and_normalization() -> None:
    assert normalize_cuet_email(" Anika@CUET.AC.BD ") == "anika@cuet.ac.bd"
    assert (
        normalize_cuet_email(" Anika@STUDENT.CUET.AC.BD ") == "anika@student.cuet.ac.bd"
    )
    with pytest.raises(ValueError, match="cuet.ac.bd"):
        normalize_cuet_email("anika@example.com")
    for address in (
        "anika@demo.cuet.ac.bd",
        "anika@student.cuet.ac.bd.example.com",
        "anika@fakecuet.ac.bd",
    ):
        with pytest.raises(ValueError, match="cuet.ac.bd"):
            normalize_cuet_email(address)
    with pytest.raises(ValueError, match="valid CUET email"):
        normalize_cuet_email("not an email")


def test_nonblank_validation_and_pagination_bounds() -> None:
    assert require_nonblank("  Campus  ", field="title", max_length=20) == "Campus"
    with pytest.raises(ValueError):
        require_nonblank("   ", field="title", max_length=20)
    with pytest.raises(ValidationError):
        Pagination(limit=101)
    with pytest.raises(ValidationError):
        Pagination(offset=-1)


def test_notification_deduplication_and_owner_scoping(
    notification_repository: FakeNotificationRepository,
) -> None:
    service = NotificationService(notification_repository)
    first = service.publish(
        NotificationDraft(
            user_id="user-1",
            kind="event_started",
            title="Event started",
            body="The event has begun.",
            dedupe_key="event-5:started:user-1",
            link="/events/event-5",
        )
    )
    duplicate = service.publish(
        NotificationDraft(
            user_id="user-1",
            kind="event_started",
            title="Event started",
            body="The event has begun.",
            dedupe_key="event-5:started:user-1",
            link="/events/event-5",
        )
    )
    other = service.publish(
        NotificationDraft(
            user_id="user-2",
            kind="announcement",
            title="Library hours",
            body="Updated hours are published.",
            dedupe_key="news-8:user-2",
        )
    )

    assert duplicate.id == first.id
    mine = service.list_mine("user-1", Pagination(limit=20, offset=0))
    assert mine.total == 1 and mine.items[0].id == first.id
    assert service.mark_mine_read("user-1", other.id) is None
    marked = service.mark_mine_read("user-1", first.id)
    assert marked is not None and marked.read_at is not None
    assert service.mark_mine_read("user-1", first.id).read_at == marked.read_at
    assert service.mark_all_mine_read("user-1") == 0
    assert service.mark_all_mine_read("user-2") == 1


def test_notification_updates_content_without_duplicate(
    notification_repository: FakeNotificationRepository,
) -> None:
    service = NotificationService(notification_repository)
    original = service.publish(
        NotificationDraft(
            user_id="user-1",
            kind="campus-update",
            title="Original title",
            body="Original summary",
            dedupe_key="news:8",
            link="/news/8",
            related_object_type="news",
            related_object_id="8",
        )
    )
    updated = service.publish(
        NotificationDraft(
            user_id="user-1",
            kind="campus-announcement",
            title="Updated title",
            body="Updated summary",
            dedupe_key="news:8",
            link="/news/8",
            related_object_type="news",
            related_object_id="8",
        )
    )
    assert updated.id == original.id
    assert updated.kind == "campus-announcement"
    assert updated.title == "Updated title"
    assert service.list_mine("user-1", Pagination()).total == 1


def test_notification_rejects_external_links_and_empty_content(
    notification_repository: FakeNotificationRepository,
) -> None:
    service = NotificationService(notification_repository)
    with pytest.raises(ValueError, match="internal paths"):
        service.publish(
            NotificationDraft(
                user_id="user-1",
                kind="announcement",
                title="External link",
                body="No external redirects.",
                dedupe_key="news-1:user-1",
                link="https://example.com",
            )
        )
    with pytest.raises(ValueError, match="title"):
        service.publish(
            NotificationDraft(
                user_id="user-1",
                kind="announcement",
                title=" ",
                body="Body",
                dedupe_key="news-2:user-1",
            )
        )
    with pytest.raises(ValueError, match="must be set together"):
        service.publish(
            NotificationDraft(
                user_id="user-1",
                kind="announcement",
                title="Incomplete reference",
                body="Both reference fields are required.",
                dedupe_key="news-3:user-1",
                related_object_type="news",
            )
        )
