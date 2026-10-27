"""Authenticated API for a user's consolidated notification inbox."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.schemas import ApiResponse
from app.core.auth import AuthIdentity, get_current_user
from app.core.errors import AppError
from app.core.notifications import NotificationRecord, NotificationService
from app.core.pagination import Pagination
from app.db.session import get_db
from app.modules.notifications.repository import SqlNotificationRepository

router = APIRouter(tags=["notifications"])
Db = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[AuthIdentity, Depends(get_current_user)]


def _service(db: Session) -> NotificationService:
    return NotificationService(SqlNotificationRepository(db))


def _data(item: NotificationRecord) -> dict:
    if item.created_at is None:
        raise RuntimeError("Persisted notification is missing created_at")
    result = {
        "id": item.id,
        "type": item.kind,
        "title": item.title,
        "message": item.body,
        "createdAt": item.created_at.isoformat(),
        "isRead": item.read_at is not None,
    }
    if item.link:
        result["href"] = item.link
    return result


@router.get("/notifications/me", response_model=ApiResponse[list[dict]])
def list_my_notifications(
    db: Db,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ApiResponse[list[dict]]:
    page = _service(db).list_mine(user.id, Pagination(limit=limit, offset=offset))
    return ApiResponse(data=[_data(item) for item in page.items])


@router.put("/notifications/read-all", response_model=ApiResponse[dict])
def mark_all_my_notifications_read(db: Db, user: CurrentUser) -> ApiResponse[dict]:
    updated = _service(db).mark_all_mine_read(user.id)
    db.commit()
    return ApiResponse(data={"updated": updated})


@router.put("/notifications/{notification_id}/read", response_model=ApiResponse[dict])
def mark_my_notification_read(
    notification_id: str, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    item = _service(db).mark_mine_read(user.id, notification_id)
    if item is None:
        raise AppError(
            status_code=404,
            code="notification_not_found",
            message="Notification not found.",
        )
    db.commit()
    return ApiResponse(
        data={
            "id": item.id,
            "readAt": item.read_at.isoformat() if item.read_at else None,
        }
    )
