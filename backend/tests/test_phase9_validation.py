"""Cross-feature unit validation that complements endpoint integration tests."""

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.db.models import ClubEvent
from app.modules.clubs.router import event_state
from app.modules.clubs.schemas import EventIn
from app.modules.transport.schemas import BusIn


def test_event_time_classification_boundaries():
    now = datetime(2026, 9, 29, 12, 0, tzinfo=UTC)
    event = ClubEvent(
        starts_at=now + timedelta(minutes=1),
        ends_at=now + timedelta(hours=1),
    )
    assert event_state(event, now) == "upcoming"
    event.starts_at = now
    assert event_state(event, now) == "ongoing"
    event.ends_at = now
    assert event_state(event, now) == "finished"


def test_paid_event_and_bus_type_validation():
    starts = datetime.now(UTC) + timedelta(days=1)
    base = {
        "title": "Workshop",
        "category": "Academic",
        "summary": "A workshop",
        "location": "CUET",
        "starts_at": starts,
        "ends_at": starts + timedelta(hours=2),
    }
    with pytest.raises(ValidationError, match="Paid registration requires"):
        EventIn(**base, registration_enabled=True, is_paid=True, fee=200)
    with pytest.raises(ValidationError):
        BusIn(name="Tista", bus_type="private", registration="CUET-01")
