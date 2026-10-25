"""Privacy-minimal audit recording for sensitive App Admin mutations."""

import uuid
from collections.abc import Mapping

from sqlalchemy.orm import Session

from app.core.auth import AuthIdentity
from app.db.models import AdminAuditLog


def record_admin_action(
    db: Session,
    actor: AuthIdentity,
    *,
    action: str,
    target_type: str,
    target_id: str,
    details: Mapping[str, str | int | bool | None] | None = None,
) -> AdminAuditLog:
    """Add an audit row to the caller's transaction without committing it."""

    if actor.role != "admin":
        raise ValueError("Only an App Admin can create an Admin audit record")
    item = AdminAuditLog(
        actor_id=uuid.UUID(actor.id),
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=dict(details or {}),
    )
    db.add(item)
    return item
