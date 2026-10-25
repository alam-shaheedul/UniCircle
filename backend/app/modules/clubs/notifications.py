"""Idempotent event lifecycle job; run externally on a schedule."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.notifications import NotificationDraft, NotificationService
from app.db.models import ClubEvent, EventInterest, EventRegistration, Notification
from app.db.session import get_session_factory
from app.modules.notifications.repository import SqlNotificationRepository


def reconcile_event_notifications(db: Session, now: datetime | None = None) -> int:
    now = now or datetime.now(UTC)
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    created = 0
    service = NotificationService(SqlNotificationRepository(db))
    # A row lock serializes concurrent workers for each event on PostgreSQL.
    for event in db.scalars(
        select(ClubEvent).where(ClubEvent.starts_at <= now).with_for_update()
    ):
        kinds = ["started"]
        end = (
            event.ends_at.replace(tzinfo=UTC)
            if event.ends_at.tzinfo is None
            else event.ends_at
        )
        if end <= now:
            kinds.append("finished")
        recipients = set(
            db.scalars(
                select(EventInterest.user_id).where(EventInterest.event_id == event.id)
            )
        )
        recipients.update(
            db.scalars(
                select(EventRegistration.user_id).where(
                    EventRegistration.event_id == event.id
                )
            )
        )
        for recipient in recipients:
            for kind in kinds:
                dedupe_key = f"event:{event.id}:{kind}"
                exists = db.scalar(
                    select(Notification.id).where(
                        Notification.recipient_id == recipient,
                        Notification.dedupe_key == dedupe_key,
                    )
                )
                if exists is None:
                    service.publish(
                        NotificationDraft(
                            user_id=str(recipient),
                            kind=f"event-{kind}",
                            title=f"{event.title} has {kind}",
                            body=(
                                "The event is now underway."
                                if kind == "started"
                                else "The event has now finished."
                            ),
                            dedupe_key=dedupe_key,
                            link=f"/events/{event.id}",
                            related_object_type="event",
                            related_object_id=str(event.id),
                        )
                    )
                    created += 1
    db.commit()
    return created


if __name__ == "__main__":
    with get_session_factory()() as session:
        count = reconcile_event_notifications(session)
    print(f"Created {count} new event notifications.")
