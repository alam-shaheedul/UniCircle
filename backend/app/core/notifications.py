"""Shared validation and owner-scoped notification behavior."""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from app.core.pagination import Page, Pagination
from app.core.validation import require_nonblank


@dataclass(frozen=True)
class NotificationDraft:
    user_id: str
    kind: str
    title: str
    body: str
    dedupe_key: str
    link: str | None = None
    related_object_type: str | None = None
    related_object_id: str | None = None


@dataclass(frozen=True)
class NotificationRecord(NotificationDraft):
    id: str = ""
    created_at: datetime | None = None
    read_at: datetime | None = None


class NotificationRepository(Protocol):
    """Implementations must enforce user ownership and unique dedupe keys."""

    def create_once(self, draft: NotificationDraft) -> NotificationRecord: ...

    def list_for_user(
        self, user_id: str, *, limit: int, offset: int
    ) -> tuple[list[NotificationRecord], int]: ...

    def mark_read(
        self, user_id: str, notification_id: str, *, now: datetime
    ) -> NotificationRecord | None: ...

    def mark_all_read(self, user_id: str, *, now: datetime) -> int: ...


class NotificationService:
    def __init__(self, repository: NotificationRepository) -> None:
        self.repository = repository

    def publish(self, draft: NotificationDraft) -> NotificationRecord:
        user_id = require_nonblank(draft.user_id, field="user_id", max_length=128)
        kind = require_nonblank(draft.kind, field="kind", max_length=64)
        title = require_nonblank(draft.title, field="title", max_length=160)
        body = require_nonblank(draft.body, field="body", max_length=1000)
        dedupe_key = require_nonblank(
            draft.dedupe_key, field="dedupe_key", max_length=200
        )
        related_object_type = (
            require_nonblank(
                draft.related_object_type,
                field="related_object_type",
                max_length=64,
            )
            if draft.related_object_type is not None
            else None
        )
        related_object_id = (
            require_nonblank(
                draft.related_object_id,
                field="related_object_id",
                max_length=128,
            )
            if draft.related_object_id is not None
            else None
        )
        if (related_object_type is None) != (related_object_id is None):
            raise ValueError(
                "Notification related_object_type and related_object_id "
                "must be set together"
            )
        if draft.link and (
            not draft.link.startswith("/") or draft.link.startswith("//")
        ):
            raise ValueError("Notification links must be internal paths")
        return self.repository.create_once(
            NotificationDraft(
                user_id=user_id,
                kind=kind,
                title=title,
                body=body,
                dedupe_key=dedupe_key,
                link=draft.link,
                related_object_type=related_object_type,
                related_object_id=related_object_id,
            )
        )

    def list_mine(
        self, user_id: str, pagination: Pagination
    ) -> Page[NotificationRecord]:
        user_id = require_nonblank(user_id, field="user_id", max_length=128)
        items, total = self.repository.list_for_user(
            user_id, limit=pagination.limit, offset=pagination.offset
        )
        return Page[NotificationRecord](
            items=items,
            total=total,
            limit=pagination.limit,
            offset=pagination.offset,
        )

    def mark_mine_read(
        self, user_id: str, notification_id: str
    ) -> NotificationRecord | None:
        user_id = require_nonblank(user_id, field="user_id", max_length=128)
        notification_id = require_nonblank(
            notification_id, field="notification_id", max_length=128
        )
        return self.repository.mark_read(
            user_id, notification_id, now=datetime.now(UTC)
        )

    def mark_all_mine_read(self, user_id: str) -> int:
        user_id = require_nonblank(user_id, field="user_id", max_length=128)
        return self.repository.mark_all_read(user_id, now=datetime.now(UTC))
