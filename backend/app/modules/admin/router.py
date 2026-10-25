"""Owner-protected inspection of the append-only App Admin audit trail."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.schemas import ApiResponse
from app.core.auth import AuthIdentity, get_current_admin
from app.db.models import AdminAuditLog, User
from app.db.session import get_db

router = APIRouter(tags=["admin"])
Db = Annotated[Session, Depends(get_db)]
CurrentAdmin = Annotated[AuthIdentity, Depends(get_current_admin)]


@router.get("/admin/audit-logs", response_model=ApiResponse[dict])
def list_admin_audit_logs(
    db: Db,
    _admin: CurrentAdmin,
    action: Annotated[str | None, Query(max_length=100)] = None,
    target_type: Annotated[str | None, Query(max_length=64)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ApiResponse[dict]:
    filters = []
    if action:
        filters.append(AdminAuditLog.action == action)
    if target_type:
        filters.append(AdminAuditLog.target_type == target_type)
    total = (
        db.scalar(select(func.count()).select_from(AdminAuditLog).where(*filters)) or 0
    )
    rows = db.execute(
        select(AdminAuditLog, User.admin_id)
        .join(User, User.id == AdminAuditLog.actor_id)
        .where(*filters)
        .order_by(AdminAuditLog.created_at.desc(), AdminAuditLog.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return ApiResponse(
        data={
            "items": [
                {
                    "id": str(item.id),
                    "actorId": str(item.actor_id),
                    "actorAdminId": admin_id,
                    "action": item.action,
                    "targetType": item.target_type,
                    "targetId": item.target_id,
                    "details": item.details,
                    "createdAt": item.created_at.isoformat(),
                }
                for item, admin_id in rows
            ],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    )
