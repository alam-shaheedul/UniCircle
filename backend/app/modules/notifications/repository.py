"""SQLAlchemy implementation of the shared notification repository."""

import uuid
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.notifications import NotificationDraft, NotificationRecord
from app.db.models import Notification


def _uuid(value: str) -> uuid.UUID:
    return uuid.UUID(value)


def _record(item: Notification) -> NotificationRecord:
    return NotificationRecord(
        user_id=str(item.recipient_id),
        kind=item.type,
        title=item.title,
        body=item.message,
        dedupe_key=item.dedupe_key,
        link=item.href,
        related_object_type=item.related_object_type,
        related_object_id=item.related_object_id,
        id=str(item.id),
        created_at=item.created_at,
        read_at=item.read_at,
    )


class SqlNotificationRepository:
    """All reads and writes are scoped by the authenticated recipient."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create_once(self, draft: NotificationDraft) -> NotificationRecord:
        recipient_id = _uuid(draft.user_id)
        item = self.db.scalar(
            select(Notification).where(
                Notification.recipient_id == recipient_id,
                Notification.dedupe_key == draft.dedupe_key,
            )
        )
        if item is None:
            item = Notification(
                recipient_id=recipient_id,
                type=draft.kind,
                title=draft.title,
                message=draft.body,
                dedupe_key=draft.dedupe_key,
                href=draft.link,
                related_object_type=draft.related_object_type,
                related_object_id=draft.related_object_id,
            )
            self.db.add(item)
            self.db.flush()
        else:
            # Re-publishing is idempotent, but current content stays in sync when
            # an announcement is edited before users read it.
            item.type = draft.kind
            item.title = draft.title
            item.message = draft.body
            item.href = draft.link
            item.related_object_type = draft.related_object_type
            item.related_object_id = draft.related_object_id
        return _record(item)

    def list_for_user(
        self, user_id: str, *, limit: int, offset: int
    ) -> tuple[list[NotificationRecord], int]:
        recipient_id = _uuid(user_id)
        predicate = Notification.recipient_id == recipient_id
        total = (
            self.db.scalar(
                select(func.count()).select_from(Notification).where(predicate)
            )
            or 0
        )
        items = self.db.scalars(
            select(Notification)
            .where(predicate)
            .order_by(Notification.created_at.desc(), Notification.id.desc())
            .limit(limit)
            .offset(offset)
        ).all()
        return [_record(item) for item in items], total

    def mark_read(
        self, user_id: str, notification_id: str, *, now: datetime
    ) -> NotificationRecord | None:
        try:
            item_id = _uuid(notification_id)
            recipient_id = _uuid(user_id)
        except ValueError:
            return None
        item = self.db.scalar(
            select(Notification).where(
                Notification.id == item_id,
                Notification.recipient_id == recipient_id,
            )
        )
        if item is None:
            return None
        if item.read_at is None:
            item.read_at = now
            self.db.flush()
        return _record(item)

    def mark_all_read(self, user_id: str, *, now: datetime) -> int:
        result = self.db.execute(
            update(Notification)
            .where(
                Notification.recipient_id == _uuid(user_id),
                Notification.read_at.is_(None),
            )
            .values(read_at=now)
        )
        return int(result.rowcount or 0)
