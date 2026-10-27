"""Scoped resource discovery, request, and REST chat endpoints."""

import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.api.schemas import ApiResponse
from app.core.auth import AuthIdentity, get_current_user
from app.core.errors import AppError
from app.db.models import (
    Conversation,
    Message,
    ResourceProfile,
    ResourceProfileCategory,
    ResourceRequest,
    User,
)
from app.db.session import get_db
from app.modules.resources.schemas import (
    Category,
    MessageIn,
    RequestDecisionIn,
    ResourceProfileIn,
    ResourceRequestIn,
)

router = APIRouter(tags=["resources-chat"])
Db = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[AuthIdentity, Depends(get_current_user)]


def fail(status: int, code: str, message: str) -> None:
    raise AppError(status_code=status, code=code, message=message)


def user_id(user: AuthIdentity) -> uuid.UUID:
    if user.role == "admin":
        fail(
            403, "general_user_required", "A verified General User account is required."
        )
    return uuid.UUID(user.id)


def profile_data(db: Session, profile: ResourceProfile | None, person: User) -> dict:
    categories = (
        db.scalars(
            select(ResourceProfileCategory.category)
            .where(ResourceProfileCategory.user_id == person.id)
            .order_by(ResourceProfileCategory.category)
        ).all()
        if profile
        else []
    )
    return {
        "userId": str(person.id),
        "name": f"{person.first_name or ''} {person.last_name or ''}".strip(),
        "username": person.username,
        "department": person.department_name or "",
        "isDiscoverable": profile.is_discoverable if profile else False,
        "level": profile.level if profile else None,
        "hall": profile.hall if profile else None,
        "availabilityNote": profile.availability_note if profile else None,
        "categories": categories,
    }


def request_data(db: Session, item: ResourceRequest) -> dict:
    conversation = db.scalar(
        select(Conversation).where(Conversation.resource_request_id == item.id)
    )
    return {
        "id": str(item.id),
        "requesterId": str(item.requester_id),
        "recipientId": str(item.recipient_id),
        "category": item.category,
        "resourceName": item.resource_name,
        "description": item.description,
        "status": item.status,
        "createdAt": item.created_at.isoformat(),
        "respondedAt": item.responded_at.isoformat() if item.responded_at else None,
        "conversationId": str(conversation.id) if conversation else None,
    }


def conversation_data(
    db: Session, conversation: Conversation, viewer_id: uuid.UUID
) -> dict:
    request = db.get(ResourceRequest, conversation.resource_request_id)
    other_id = (
        request.recipient_id
        if request.requester_id == viewer_id
        else request.requester_id
    )
    other = db.get(User, other_id)
    return {
        "id": str(conversation.id),
        "requestId": str(request.id),
        "otherUserId": str(other_id),
        "otherUserName": f"{other.first_name or ''} {other.last_name or ''}".strip()
        if other
        else "Unknown user",
        "resourceName": request.resource_name,
        "lastActivityAt": conversation.last_activity_at.isoformat(),
    }


def message_data(message: Message) -> dict:
    return {
        "id": str(message.id),
        "conversationId": str(message.conversation_id),
        "senderId": str(message.sender_id),
        "body": message.body,
        "sentAt": message.sent_at.isoformat(),
    }


def conversation_for_user(
    db: Session, conversation_id: uuid.UUID, viewer_id: uuid.UUID
) -> Conversation:
    conversation = db.get(Conversation, conversation_id)
    if conversation is None:
        fail(404, "conversation_not_found", "Conversation not found.")
    request = db.get(ResourceRequest, conversation.resource_request_id)
    if request is None or viewer_id not in (request.requester_id, request.recipient_id):
        fail(404, "conversation_not_found", "Conversation not found.")
    if request.status != "accepted":
        fail(409, "chat_not_available", "Chat is available only for accepted requests.")
    return conversation


@router.get("/resource-profile/me", response_model=ApiResponse[dict])
def my_resource_profile(db: Db, user: CurrentUser) -> ApiResponse[dict]:
    person = db.get(User, user_id(user))
    return ApiResponse(
        data=profile_data(db, db.get(ResourceProfile, person.id), person)
    )


@router.patch("/resource-profile/me", response_model=ApiResponse[dict])
def update_resource_profile(
    body: ResourceProfileIn, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    ident = user_id(user)
    person = db.get(User, ident)
    profile = db.get(ResourceProfile, ident)
    if profile is None:
        profile = ResourceProfile(user_id=ident)
        db.add(profile)
        db.flush()
    profile.is_discoverable = body.is_discoverable
    profile.level = body.level
    profile.hall = body.hall
    profile.availability_note = body.availability_note
    profile.updated_at = datetime.now(UTC)
    existing = db.scalars(
        select(ResourceProfileCategory).where(ResourceProfileCategory.user_id == ident)
    ).all()
    for item in existing:
        db.delete(item)
    db.flush()
    for category in body.categories:
        db.add(ResourceProfileCategory(user_id=ident, category=category))
    db.commit()
    return ApiResponse(data=profile_data(db, profile, person))


@router.get("/users/discover", response_model=ApiResponse[dict])
def discover_users(
    db: Db,
    user: CurrentUser,
    category: Category | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ApiResponse[dict]:
    viewer_id = user_id(user)
    query = (
        select(User, ResourceProfile)
        .join(ResourceProfile, ResourceProfile.user_id == User.id)
        .where(
            User.id != viewer_id,
            User.role != "admin",
            User.is_active.is_(True),
            User.verified_at.is_not(None),
            ResourceProfile.is_discoverable.is_(True),
        )
    )
    if category is not None:
        query = query.join(
            ResourceProfileCategory, ResourceProfileCategory.user_id == User.id
        ).where(ResourceProfileCategory.category == category)
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(User.username).like(term),
                func.lower(User.first_name).like(term),
                func.lower(User.last_name).like(term),
                func.lower(User.department_name).like(term),
                func.lower(ResourceProfile.hall).like(term),
            )
        )
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.execute(
        query.order_by(User.username, User.id).offset(offset).limit(limit)
    ).all()
    return ApiResponse(
        data={
            "items": [profile_data(db, profile, person) for person, profile in rows],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    )


@router.post("/resource-requests", response_model=ApiResponse[dict], status_code=201)
def send_resource_request(
    body: ResourceRequestIn, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    requester_id = user_id(user)
    if requester_id == body.recipient_id:
        fail(422, "self_request", "You cannot send a resource request to yourself.")
    recipient = db.get(User, body.recipient_id)
    profile = db.get(ResourceProfile, body.recipient_id)
    if (
        recipient is None
        or recipient.role == "admin"
        or not recipient.is_active
        or recipient.verified_at is None
        or profile is None
        or not profile.is_discoverable
    ):
        fail(
            404,
            "recipient_not_found",
            "This user is not available for resource requests.",
        )
    advertised = db.get(ResourceProfileCategory, (body.recipient_id, body.category))
    if advertised is None:
        fail(
            422,
            "category_unavailable",
            "The recipient does not list this resource category.",
        )
    item = ResourceRequest(
        requester_id=requester_id,
        recipient_id=body.recipient_id,
        category=body.category,
        resource_name=body.resource_name,
        description=body.description,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ApiResponse(data=request_data(db, item))


@router.get("/resource-requests/mine", response_model=ApiResponse[dict])
def my_resource_requests(
    db: Db,
    user: CurrentUser,
    box: Literal["sent", "received", "all"] = "all",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ApiResponse[dict]:
    ident = user_id(user)
    query = select(ResourceRequest)
    if box == "sent":
        query = query.where(ResourceRequest.requester_id == ident)
    elif box == "received":
        query = query.where(ResourceRequest.recipient_id == ident)
    else:
        query = query.where(
            or_(
                ResourceRequest.requester_id == ident,
                ResourceRequest.recipient_id == ident,
            )
        )
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(
        query.order_by(ResourceRequest.created_at.desc(), ResourceRequest.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return ApiResponse(
        data={
            "items": [request_data(db, item) for item in items],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    )


@router.get("/resource-requests/{request_id}", response_model=ApiResponse[dict])
def get_resource_request(
    request_id: uuid.UUID, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    ident = user_id(user)
    item = db.get(ResourceRequest, request_id)
    if item is None or ident not in (item.requester_id, item.recipient_id):
        fail(404, "request_not_found", "Resource request not found.")
    return ApiResponse(data=request_data(db, item))


@router.post(
    "/resource-requests/{request_id}/decision", response_model=ApiResponse[dict]
)
def decide_resource_request(
    request_id: uuid.UUID, body: RequestDecisionIn, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    ident = user_id(user)
    item = db.scalar(
        select(ResourceRequest)
        .where(ResourceRequest.id == request_id)
        .with_for_update()
    )
    if item is None:
        fail(404, "request_not_found", "Resource request not found.")
    if ident != item.recipient_id:
        fail(403, "recipient_required", "Only the recipient may decide this request.")
    if item.status != "pending":
        if item.status != body.decision:
            fail(
                409,
                "already_decided",
                "This request has already been decided differently.",
            )
        return ApiResponse(data=request_data(db, item))
    item.status = body.decision
    item.responded_at = datetime.now(UTC)
    if body.decision == "accepted":
        db.add(
            Conversation(
                resource_request_id=item.id, last_activity_at=item.responded_at
            )
        )
    db.commit()
    return ApiResponse(data=request_data(db, item))


@router.get("/conversations", response_model=ApiResponse[dict])
def list_conversations(
    db: Db,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ApiResponse[dict]:
    ident = user_id(user)
    query = (
        select(Conversation)
        .join(ResourceRequest, Conversation.resource_request_id == ResourceRequest.id)
        .where(
            ResourceRequest.status == "accepted",
            or_(
                ResourceRequest.requester_id == ident,
                ResourceRequest.recipient_id == ident,
            ),
        )
    )
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(
        query.order_by(Conversation.last_activity_at.desc(), Conversation.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return ApiResponse(
        data={
            "items": [conversation_data(db, item, ident) for item in items],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    )


@router.get(
    "/conversations/{conversation_id}/messages", response_model=ApiResponse[dict]
)
def message_history(
    conversation_id: uuid.UUID,
    db: Db,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    before_id: uuid.UUID | None = None,
    after_id: uuid.UUID | None = None,
) -> ApiResponse[dict]:
    ident = user_id(user)
    conversation_for_user(db, conversation_id, ident)
    if before_id and after_id:
        fail(422, "invalid_cursor", "Use either before_id or after_id, not both.")
    query = select(Message).where(Message.conversation_id == conversation_id)
    cursor_id = before_id or after_id
    if cursor_id:
        cursor = db.get(Message, cursor_id)
        if cursor is None or cursor.conversation_id != conversation_id:
            fail(422, "invalid_cursor", "Message cursor is not in this conversation.")
        if before_id:
            query = query.where(
                or_(
                    Message.sent_at < cursor.sent_at,
                    and_(Message.sent_at == cursor.sent_at, Message.id < cursor.id),
                )
            )
        else:
            query = query.where(
                or_(
                    Message.sent_at > cursor.sent_at,
                    and_(Message.sent_at == cursor.sent_at, Message.id > cursor.id),
                )
            )
    if after_id:
        rows = db.scalars(
            query.order_by(Message.sent_at, Message.id).limit(limit + 1)
        ).all()
        has_more = len(rows) > limit
        items = rows[:limit]
    else:
        rows = db.scalars(
            query.order_by(Message.sent_at.desc(), Message.id.desc()).limit(limit + 1)
        ).all()
        has_more = len(rows) > limit
        items = list(reversed(rows[:limit]))
    return ApiResponse(
        data={
            "items": [message_data(item) for item in items],
            "hasMore": has_more,
            "oldestId": str(items[0].id) if items else None,
            "newestId": str(items[-1].id) if items else None,
        }
    )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=ApiResponse[dict],
    status_code=201,
)
def send_message(
    conversation_id: uuid.UUID, body: MessageIn, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    ident = user_id(user)
    conversation = conversation_for_user(db, conversation_id, ident)
    sent_at = datetime.now(UTC)
    message = Message(
        conversation_id=conversation_id,
        sender_id=ident,
        body=body.body,
        sent_at=sent_at,
    )
    db.add(message)
    conversation.last_activity_at = sent_at
    db.commit()
    return ApiResponse(data=message_data(message))
