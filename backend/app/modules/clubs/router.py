"""Authenticated club/event APIs. Mutations own a single database transaction."""

import re
import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.schemas import ApiResponse
from app.core.audit import record_admin_action
from app.core.auth import AuthIdentity, get_current_admin, get_current_user
from app.core.errors import AppError
from app.core.notifications import NotificationDraft, NotificationService
from app.db.models import (
    Club,
    ClubAdmin,
    ClubCreationRequest,
    ClubEvent,
    ClubMember,
    ClubMembershipRequest,
    EventInterest,
    EventRegistration,
    User,
)
from app.db.session import get_db
from app.modules.clubs.schemas import (
    AdminIn,
    ClubRequestIn,
    ClubUpdateIn,
    EventIn,
    InterestIn,
    MembershipRequestIn,
    MembershipSettingsIn,
    PaymentReviewIn,
    RegistrationIn,
    ReviewIn,
)
from app.modules.notifications.repository import SqlNotificationRepository

router = APIRouter(tags=["clubs-events"])
Db = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[AuthIdentity, Depends(get_current_user)]
CurrentAdmin = Annotated[AuthIdentity, Depends(get_current_admin)]


def fail(status: int, code: str, message: str) -> None:
    raise AppError(status_code=status, code=code, message=message)


def uid(user: AuthIdentity) -> uuid.UUID:
    return uuid.UUID(user.id)


def student(user: AuthIdentity) -> None:
    if user.role != "student":
        fail(403, "student_required", "A verified student account is required.")


def club_or_404(db: Session, club_id: str, *, lock: bool = False) -> Club:
    query = select(Club).where(Club.id == club_id)
    club = db.scalar(query.with_for_update() if lock else query)
    if club is None:
        fail(404, "club_not_found", "Club not found.")
    return club


def event_or_404(db: Session, event_id: uuid.UUID) -> ClubEvent:
    event = db.get(ClubEvent, event_id)
    if event is None:
        fail(404, "event_not_found", "Event not found.")
    return event


def club_admin(db: Session, club_id: str, user: AuthIdentity) -> None:
    student(user)
    club_or_404(db, club_id)
    if db.get(ClubAdmin, (club_id, uid(user))) is None:
        fail(403, "club_admin_required", "Club Admin access is required.")


def display_user(db: Session, user_id: uuid.UUID) -> dict:
    person = db.get(User, user_id)
    return {
        "userId": str(user_id),
        "name": f"{person.first_name} {person.last_name}".strip()
        if person
        else "Unknown student",
        "studentId": person.university_id if person else "",
        "department": person.department_name or "" if person else "",
    }


def membership_request_data(db: Session, item: ClubMembershipRequest) -> dict:
    return {
        "id": str(item.id),
        "clubId": item.club_id,
        "userId": str(item.user_id),
        "applicantName": item.applicant_name,
        "email": item.email,
        "studentId": item.student_id,
        "departmentName": item.department_name,
        "phone": item.phone,
        "motivation": item.motivation,
        "paymentMethod": item.payment_method,
        "transactionId": item.transaction_id,
        "fee": item.fee,
        "status": item.status,
        "submittedAt": item.created_at.isoformat(),
        "reviewedAt": item.reviewed_at.isoformat() if item.reviewed_at else None,
    }


def club_data(db: Session, club: Club, user: AuthIdentity) -> dict:
    admin_ids = db.scalars(
        select(ClubAdmin.user_id).where(ClubAdmin.club_id == club.id)
    ).all()
    member_count = (
        db.scalar(
            select(func.count())
            .select_from(ClubMember)
            .where(ClubMember.club_id == club.id)
        )
        or 0
    )
    membership = (
        db.get(ClubMember, (club.id, uid(user))) if user.role == "student" else None
    )
    membership_request = (
        db.scalar(
            select(ClubMembershipRequest).where(
                ClubMembershipRequest.club_id == club.id,
                ClubMembershipRequest.user_id == uid(user),
            )
        )
        if user.role == "student"
        else None
    )
    is_club_admin = user.role == "student" and uid(user) in admin_ids
    pending_count = 0
    if is_club_admin:
        pending_count = (
            db.scalar(
                select(func.count())
                .select_from(ClubMembershipRequest)
                .where(
                    ClubMembershipRequest.club_id == club.id,
                    ClubMembershipRequest.status == "pending",
                )
            )
            or 0
        )
    return {
        "id": club.id,
        "name": club.name,
        "shortName": club.short_name,
        "category": club.category,
        "tagline": club.tagline,
        "description": club.description,
        "activities": club.activities,
        "memberCount": member_count,
        "adminCount": len(admin_ids),
        "adminUserIds": [str(admin_id) for admin_id in admin_ids],
        "adminUsers": [display_user(db, admin_id) for admin_id in admin_ids],
        "isAdmin": is_club_admin,
        "isMember": membership is not None,
        "membershipRequestStatus": (
            membership_request.status if membership_request else None
        ),
        "pendingMembershipRequestCount": pending_count,
        "membershipRecruitment": {
            "open": club.membership_recruitment_open,
            "fee": club.membership_fee,
            "bkashNumber": club.membership_bkash_number,
            "nagadNumber": club.membership_nagad_number,
        },
    }


def event_state(event: ClubEvent, now: datetime | None = None) -> str:
    now = now or datetime.now(UTC)
    start = (
        event.starts_at.replace(tzinfo=UTC)
        if event.starts_at.tzinfo is None
        else event.starts_at
    )
    end = (
        event.ends_at.replace(tzinfo=UTC)
        if event.ends_at.tzinfo is None
        else event.ends_at
    )
    return "upcoming" if now < start else "ongoing" if now < end else "finished"


def event_data(db: Session, event: ClubEvent, user: AuthIdentity) -> dict:
    count = (
        db.scalar(
            select(func.count())
            .select_from(EventRegistration)
            .where(EventRegistration.event_id == event.id)
        )
        or 0
    )
    going_count = (
        db.scalar(
            select(func.count())
            .select_from(EventInterest)
            .where(EventInterest.event_id == event.id, EventInterest.status == "going")
        )
        or 0
    )
    interest = (
        db.get(EventInterest, (event.id, uid(user))) if user.role == "student" else None
    )
    registration = (
        db.scalar(
            select(EventRegistration).where(
                EventRegistration.event_id == event.id,
                EventRegistration.user_id == uid(user),
            )
        )
        if user.role == "student"
        else None
    )
    return {
        "id": str(event.id),
        "clubId": event.club_id,
        "title": event.title,
        "category": event.category,
        "summary": event.summary,
        "location": event.location,
        "startsAt": event.starts_at.isoformat(),
        "endsAt": event.ends_at.isoformat(),
        "status": event_state(event),
        "registrationEnabled": event.registration_enabled,
        "registrationClosesAt": event.registration_closes_at.isoformat()
        if event.registration_closes_at
        else None,
        "isPaid": event.is_paid,
        "fee": event.fee,
        "bkashNumber": event.bkash_number,
        "registeredCount": count,
        "goingCount": going_count,
        "myInterest": interest.status if interest else "none",
        "myRegistration": {
            "id": str(registration.id),
            "paymentStatus": registration.payment_status,
        }
        if registration
        else None,
    }


def request_data(db: Session, item: ClubCreationRequest) -> dict:
    requester = db.get(User, item.requester_id)
    return {
        "id": str(item.id),
        "requesterId": str(item.requester_id),
        "requesterName": (
            f"{requester.first_name} {requester.last_name}".strip()
            if requester
            else "Unknown student"
        ),
        "requesterStudentId": requester.university_id if requester else "",
        "name": item.name,
        "shortName": item.short_name,
        "category": item.category,
        "tagline": item.tagline,
        "description": item.description,
        "purpose": item.purpose,
        "activities": item.activities,
        "status": item.status,
        "approvedClubId": item.approved_club_id,
        "reviewerId": str(item.reviewer_id) if item.reviewer_id else None,
        "reviewedAt": item.reviewed_at.isoformat() if item.reviewed_at else None,
        "reviewNote": item.review_note,
        "createdAt": item.created_at.isoformat(),
    }


@router.get("/clubs", response_model=ApiResponse[list[dict]])
def list_clubs(db: Db, user: CurrentUser) -> ApiResponse[list[dict]]:
    return ApiResponse(
        data=[
            club_data(db, club, user)
            for club in db.scalars(select(Club).order_by(Club.name))
        ]
    )


@router.get("/clubs/administered", response_model=ApiResponse[list[dict]])
def administered_clubs(db: Db, user: CurrentUser) -> ApiResponse[list[dict]]:
    student(user)
    clubs = db.scalars(
        select(Club)
        .join(ClubAdmin)
        .where(ClubAdmin.user_id == uid(user))
        .order_by(Club.name)
    ).all()
    return ApiResponse(data=[club_data(db, club, user) for club in clubs])


@router.get("/clubs/requests/mine", response_model=ApiResponse[list[dict]])
def my_requests(db: Db, user: CurrentUser) -> ApiResponse[list[dict]]:
    student(user)
    records = db.scalars(
        select(ClubCreationRequest)
        .where(ClubCreationRequest.requester_id == uid(user))
        .order_by(ClubCreationRequest.created_at.desc())
    ).all()
    return ApiResponse(data=[request_data(db, item) for item in records])


@router.post("/clubs/requests", response_model=ApiResponse[dict], status_code=201)
def submit_request(body: ClubRequestIn, db: Db, user: CurrentUser) -> ApiResponse[dict]:
    student(user)
    item = ClubCreationRequest(requester_id=uid(user), **body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return ApiResponse(data=request_data(db, item))


@router.get("/admin/club-requests", response_model=ApiResponse[dict])
def review_queue(
    db: Db,
    _admin: CurrentAdmin,
    status: Literal["pending", "approved", "rejected"] | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ApiResponse[dict]:
    query = select(ClubCreationRequest)
    if status:
        query = query.where(ClubCreationRequest.status == status)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    records = db.scalars(
        query.order_by(ClubCreationRequest.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    return ApiResponse(
        data={
            "items": [request_data(db, item) for item in records],
            "total": total,
            "page": page,
            "size": size,
        }
    )


@router.post(
    "/admin/club-requests/{request_id}/review", response_model=ApiResponse[dict]
)
def review_request(
    request_id: uuid.UUID, body: ReviewIn, db: Db, admin: CurrentAdmin
) -> ApiResponse[dict]:
    item = db.scalar(
        select(ClubCreationRequest)
        .where(ClubCreationRequest.id == request_id)
        .with_for_update()
    )
    if item is None:
        fail(404, "request_not_found", "Club request not found.")
    if item.status != "pending":
        if item.status != body.decision:
            fail(
                409,
                "already_reviewed",
                "This request has already been reviewed differently.",
            )
        return ApiResponse(data=request_data(db, item))
    if body.decision == "approved":
        slug = re.sub(r"[^a-z0-9]+", "-", item.name.lower()).strip("-")[:48].strip("-")
        club_id = f"{slug}-{str(item.id)[:8]}"
        db.add(
            Club(
                id=club_id,
                name=item.name,
                short_name=item.short_name,
                category=item.category,
                tagline=item.tagline,
                description=item.description,
                activities=item.activities,
            )
        )
        db.flush()
        db.add_all(
            [
                ClubMember(club_id=club_id, user_id=item.requester_id),
                ClubAdmin(club_id=club_id, user_id=item.requester_id),
            ]
        )
        item.approved_club_id = club_id
    item.status = body.decision
    item.reviewer_id = uid(admin)
    item.reviewed_at = datetime.now(UTC)
    item.review_note = body.note
    record_admin_action(
        db,
        admin,
        action=f"club_request.{body.decision}",
        target_type="club_creation_request",
        target_id=str(item.id),
        details={"approvedClubId": item.approved_club_id},
    )
    db.commit()
    db.refresh(item)
    return ApiResponse(data=request_data(db, item))


@router.get("/clubs/{club_id}", response_model=ApiResponse[dict])
def get_club(club_id: str, db: Db, user: CurrentUser) -> ApiResponse[dict]:
    return ApiResponse(data=club_data(db, club_or_404(db, club_id), user))


@router.get("/clubs/{club_id}/members", response_model=ApiResponse[dict])
def get_members(club_id: str, db: Db, _user: CurrentUser) -> ApiResponse[dict]:
    club_or_404(db, club_id)
    ids = db.scalars(
        select(ClubMember.user_id).where(ClubMember.club_id == club_id)
    ).all()
    admin_ids = set(
        db.scalars(select(ClubAdmin.user_id).where(ClubAdmin.club_id == club_id)).all()
    )
    return ApiResponse(
        data={
            "total": len(ids),
            "members": [
                {**display_user(db, ident), "isAdmin": ident in admin_ids}
                for ident in ids
            ],
        }
    )


@router.put("/clubs/{club_id}/membership-settings", response_model=ApiResponse[dict])
def update_membership_settings(
    club_id: str, body: MembershipSettingsIn, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    club_admin(db, club_id, user)
    club = club_or_404(db, club_id)
    club.membership_recruitment_open = body.recruitment_open
    club.membership_bkash_number = body.bkash_number
    club.membership_nagad_number = body.nagad_number
    club.membership_fee = 200
    db.commit()
    return ApiResponse(data=club_data(db, club, user))


@router.post(
    "/clubs/{club_id}/membership-requests",
    response_model=ApiResponse[dict],
    status_code=201,
)
def submit_membership_request(
    club_id: str, body: MembershipRequestIn, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    student(user)
    club = club_or_404(db, club_id)
    user_id = uid(user)
    if db.get(ClubMember, (club_id, user_id)) is not None:
        fail(409, "already_a_member", "You are already a member of this club.")
    if not club.membership_recruitment_open:
        fail(409, "recruitment_closed", "This club is not recruiting members now.")
    if not club.membership_bkash_number or not club.membership_nagad_number:
        fail(409, "payment_accounts_missing", "Club payment accounts are unavailable.")
    existing = db.scalar(
        select(ClubMembershipRequest).where(
            ClubMembershipRequest.club_id == club_id,
            ClubMembershipRequest.user_id == user_id,
        )
    )
    if existing is not None:
        fail(409, "membership_request_exists", "A membership request already exists.")
    account = db.get(User, user_id)
    if account is None:
        fail(404, "user_not_found", "Student account not found.")
    if body.email.lower() != (account.email or "").lower():
        fail(422, "email_mismatch", "Use the CUET email from your account.")
    if body.student_id != account.university_id:
        fail(422, "student_id_mismatch", "Use the student ID from your account.")
    item = ClubMembershipRequest(
        club_id=club_id,
        user_id=user_id,
        fee=200,
        **body.model_dump(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ApiResponse(data=membership_request_data(db, item))


@router.get(
    "/clubs/{club_id}/membership-requests", response_model=ApiResponse[list[dict]]
)
def list_membership_requests(
    club_id: str, db: Db, user: CurrentUser
) -> ApiResponse[list[dict]]:
    club_admin(db, club_id, user)
    items = db.scalars(
        select(ClubMembershipRequest)
        .where(
            ClubMembershipRequest.club_id == club_id,
            ClubMembershipRequest.status == "pending",
        )
        .order_by(ClubMembershipRequest.created_at)
    ).all()
    return ApiResponse(data=[membership_request_data(db, item) for item in items])


@router.post(
    "/clubs/{club_id}/membership-requests/{request_id}/approve",
    response_model=ApiResponse[dict],
)
def approve_membership_request(
    club_id: str, request_id: uuid.UUID, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    club_admin(db, club_id, user)
    item = db.scalar(
        select(ClubMembershipRequest)
        .where(
            ClubMembershipRequest.id == request_id,
            ClubMembershipRequest.club_id == club_id,
        )
        .with_for_update()
    )
    if item is None:
        fail(404, "membership_request_not_found", "Membership request not found.")
    if item.status != "pending":
        fail(409, "membership_request_reviewed", "This request was already reviewed.")
    if db.get(ClubMember, (club_id, item.user_id)) is None:
        db.add(ClubMember(club_id=club_id, user_id=item.user_id))
    item.status = "approved"
    item.reviewer_id = uid(user)
    item.reviewed_at = datetime.now(UTC)
    club = club_or_404(db, club_id)
    NotificationService(SqlNotificationRepository(db)).publish(
        NotificationDraft(
            user_id=str(item.user_id),
            kind="club-membership-approved",
            title=f"Welcome to {club.name}",
            body="Your membership request was approved by the club admin.",
            dedupe_key=f"membership-approved:{item.id}",
            link=f"/clubs/{club_id}",
            related_object_type="club",
            related_object_id=club_id,
        )
    )
    db.commit()
    return ApiResponse(
        data={
            "request": membership_request_data(db, item),
            "club": club_data(db, club_or_404(db, club_id), user),
        }
    )


@router.delete("/clubs/{club_id}/membership-requests/{request_id}", status_code=204)
def remove_membership_request(
    club_id: str, request_id: uuid.UUID, db: Db, user: CurrentUser
) -> None:
    club_admin(db, club_id, user)
    item = db.get(ClubMembershipRequest, request_id)
    if item is None or item.club_id != club_id:
        fail(404, "membership_request_not_found", "Membership request not found.")
    if item.status != "pending":
        fail(409, "membership_request_reviewed", "Approved requests cannot be removed.")
    db.delete(item)
    db.commit()


@router.delete("/clubs/{club_id}/members/me", response_model=ApiResponse[dict])
def leave_club(club_id: str, db: Db, user: CurrentUser) -> ApiResponse[dict]:
    student(user)
    club = club_or_404(db, club_id)
    if db.get(ClubAdmin, (club_id, uid(user))) is not None:
        fail(
            409, "admin_cannot_leave", "A Club Admin must first transfer admin access."
        )
    membership = db.get(ClubMember, (club_id, uid(user)))
    if membership:
        db.delete(membership)
        db.commit()
    return ApiResponse(data=club_data(db, club, user))


@router.put("/clubs/{club_id}", response_model=ApiResponse[dict])
def update_club(
    club_id: str, body: ClubUpdateIn, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    club_admin(db, club_id, user)
    club = club_or_404(db, club_id)
    for key, value in body.model_dump().items():
        setattr(club, key, value)
    db.commit()
    return ApiResponse(data=club_data(db, club, user))


@router.post("/clubs/{club_id}/admins", response_model=ApiResponse[dict])
def add_admin(
    club_id: str, body: AdminIn, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    club_admin(db, club_id, user)
    if body.student_id:
        target = db.scalar(
            select(User).where(
                User.role == "student", User.university_id == body.student_id.strip()
            )
        )
    else:
        try:
            target_id = uuid.UUID(body.user_id or "")
        except ValueError:
            fail(422, "invalid_user_id", "User ID must be a UUID.")
        target = db.get(User, target_id)
    if (
        target is None
        or target.role != "student"
        or not target.is_active
        or target.verified_at is None
    ):
        fail(
            422, "invalid_club_admin", "Club Admin must be an active, verified student."
        )
    target_id = target.id
    if db.get(ClubMember, (club_id, target_id)) is None:
        db.add(ClubMember(club_id=club_id, user_id=target_id))
    if db.get(ClubAdmin, (club_id, target_id)) is None:
        db.add(ClubAdmin(club_id=club_id, user_id=target_id))
    db.commit()
    return ApiResponse(data=club_data(db, club_or_404(db, club_id), user))


@router.delete("/clubs/{club_id}/admins/{target_id}", response_model=ApiResponse[dict])
def remove_admin(
    club_id: str, target_id: uuid.UUID, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    student(user)
    club = club_or_404(db, club_id, lock=True)
    club_admin(db, club_id, user)
    target = db.get(ClubAdmin, (club_id, target_id))
    if target is None:
        fail(404, "club_admin_not_found", "Club Admin not found.")
    count = (
        db.scalar(
            select(func.count())
            .select_from(ClubAdmin)
            .where(ClubAdmin.club_id == club_id)
        )
        or 0
    )
    if count <= 1:
        fail(409, "last_club_admin", "A club must retain at least one admin.")
    db.delete(target)
    db.commit()
    return ApiResponse(data=club_data(db, club, user))


@router.get("/clubs/{club_id}/events", response_model=ApiResponse[list[dict]])
def club_events(club_id: str, db: Db, user: CurrentUser) -> ApiResponse[list[dict]]:
    club_or_404(db, club_id)
    items = db.scalars(
        select(ClubEvent)
        .where(ClubEvent.club_id == club_id)
        .order_by(ClubEvent.starts_at.desc())
    ).all()
    return ApiResponse(data=[event_data(db, item, user) for item in items])


@router.get("/events", response_model=ApiResponse[list[dict]])
def list_events(
    db: Db,
    user: CurrentUser,
    status: Literal["ongoing", "upcoming", "finished"] | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> ApiResponse[list[dict]]:
    now = datetime.now(UTC)
    query = select(ClubEvent)
    if status == "upcoming":
        query = query.where(ClubEvent.starts_at > now).order_by(ClubEvent.starts_at)
    elif status == "ongoing":
        query = query.where(
            ClubEvent.starts_at <= now, ClubEvent.ends_at > now
        ).order_by(ClubEvent.ends_at)
    elif status == "finished":
        query = query.where(ClubEvent.ends_at <= now).order_by(ClubEvent.ends_at.desc())
    else:
        query = query.order_by(ClubEvent.starts_at.desc())
    return ApiResponse(
        data=[event_data(db, item, user) for item in db.scalars(query.limit(limit))]
    )


@router.get("/events/{event_id}", response_model=ApiResponse[dict])
def get_event(event_id: uuid.UUID, db: Db, user: CurrentUser) -> ApiResponse[dict]:
    return ApiResponse(data=event_data(db, event_or_404(db, event_id), user))


@router.post(
    "/clubs/{club_id}/events", response_model=ApiResponse[dict], status_code=201
)
def create_event(
    club_id: str, body: EventIn, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    club_admin(db, club_id, user)
    item = ClubEvent(club_id=club_id, **body.model_dump())
    db.add(item)
    db.commit()
    return ApiResponse(data=event_data(db, item, user))


@router.put("/events/{event_id}", response_model=ApiResponse[dict])
def update_event(
    event_id: uuid.UUID, body: EventIn, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    item = event_or_404(db, event_id)
    club_admin(db, item.club_id, user)
    has_registrations = db.scalar(
        select(func.count())
        .select_from(EventRegistration)
        .where(EventRegistration.event_id == item.id)
    )
    if has_registrations and (
        not body.registration_enabled
        or body.is_paid != item.is_paid
        or body.fee != item.fee
        or body.bkash_number != item.bkash_number
    ):
        fail(
            409,
            "registrations_exist",
            "Registration terms cannot change after students register.",
        )
    for key, value in body.model_dump().items():
        setattr(item, key, value)
    db.commit()
    return ApiResponse(data=event_data(db, item, user))


@router.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: uuid.UUID, db: Db, user: CurrentUser) -> None:
    item = event_or_404(db, event_id)
    club_admin(db, item.club_id, user)
    if db.scalar(
        select(func.count())
        .select_from(EventRegistration)
        .where(EventRegistration.event_id == item.id)
    ):
        fail(409, "registrations_exist", "Events with registrations cannot be deleted.")
    db.delete(item)
    db.commit()


@router.put("/events/{event_id}/interest", response_model=ApiResponse[dict])
def set_interest(
    event_id: uuid.UUID, body: InterestIn, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    student(user)
    event = event_or_404(db, event_id)
    existing = db.get(EventInterest, (event_id, uid(user)))
    if body.status == "none":
        if existing:
            db.delete(existing)
    elif existing:
        existing.status = body.status
    else:
        db.add(EventInterest(event_id=event_id, user_id=uid(user), status=body.status))
    db.commit()
    return ApiResponse(data=event_data(db, event, user))


@router.post(
    "/events/{event_id}/registrations",
    response_model=ApiResponse[dict],
    status_code=201,
)
def register_event(
    event_id: uuid.UUID, body: RegistrationIn, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    student(user)
    event = event_or_404(db, event_id)
    now = datetime.now(UTC)
    close = event.registration_closes_at or event.starts_at
    close = close.replace(tzinfo=UTC) if close.tzinfo is None else close
    if (
        not event.registration_enabled
        or now >= close
        or event_state(event, now) == "finished"
    ):
        fail(409, "registration_closed", "Registration is closed for this event.")
    person = db.get(User, uid(user))
    if (
        not person
        or body.email.lower() != (person.email or "").lower()
        or body.student_id.lower() != (person.university_id or "").lower()
    ):
        fail(
            422,
            "identity_mismatch",
            "CUET email and student ID must match your verified account.",
        )
    if event.is_paid and not body.bkash_trx_id:
        fail(422, "transaction_required", "A bKash transaction ID is required.")
    if not event.is_paid and body.bkash_trx_id:
        fail(
            422,
            "transaction_not_allowed",
            "Free events do not accept a transaction ID.",
        )
    existing = db.scalar(
        select(EventRegistration).where(
            EventRegistration.event_id == event_id,
            EventRegistration.user_id == uid(user),
        )
    )
    if existing:
        fail(409, "already_registered", "You are already registered for this event.")
    record = EventRegistration(
        event_id=event_id,
        user_id=uid(user),
        payment_status="pending_review" if event.is_paid else "not_required",
        **body.model_dump(),
    )
    db.add(record)
    db.commit()
    return ApiResponse(
        data={
            "id": str(record.id),
            "paymentStatus": record.payment_status,
            "registeredCount": db.scalar(
                select(func.count())
                .select_from(EventRegistration)
                .where(EventRegistration.event_id == event_id)
            ),
        }
    )


@router.get("/events/{event_id}/registrations", response_model=ApiResponse[list[dict]])
def list_registrations(
    event_id: uuid.UUID, db: Db, user: CurrentUser
) -> ApiResponse[list[dict]]:
    event = event_or_404(db, event_id)
    if user.role != "admin":
        club_admin(db, event.club_id, user)
    records = db.scalars(
        select(EventRegistration)
        .where(EventRegistration.event_id == event_id)
        .order_by(EventRegistration.created_at)
    ).all()
    return ApiResponse(
        data=[
            {
                "id": str(item.id),
                "userId": str(item.user_id),
                "participantName": item.participant_name,
                "email": item.email,
                "studentId": item.student_id,
                "departmentName": item.department_name,
                "bkashTrxId": item.bkash_trx_id,
                "paymentStatus": item.payment_status,
            }
            for item in records
        ]
    )


@router.put(
    "/events/{event_id}/registrations/{registration_id}/payment",
    response_model=ApiResponse[dict],
)
def review_payment(
    event_id: uuid.UUID,
    registration_id: uuid.UUID,
    body: PaymentReviewIn,
    db: Db,
    user: CurrentUser,
) -> ApiResponse[dict]:
    event = event_or_404(db, event_id)
    if user.role != "admin":
        club_admin(db, event.club_id, user)
    record = db.get(EventRegistration, registration_id)
    if record is None or record.event_id != event_id:
        fail(404, "registration_not_found", "Registration not found.")
    if not event.is_paid:
        fail(409, "free_registration", "Free registrations have no payment to review.")
    record.payment_status = body.status
    db.commit()
    return ApiResponse(
        data={"id": str(record.id), "paymentStatus": record.payment_status}
    )


@router.get(
    "/events/{event_id}/registrations/me", response_model=ApiResponse[dict | None]
)
def my_registration(
    event_id: uuid.UUID, db: Db, user: CurrentUser
) -> ApiResponse[dict | None]:
    student(user)
    event_or_404(db, event_id)
    record = db.scalar(
        select(EventRegistration).where(
            EventRegistration.event_id == event_id,
            EventRegistration.user_id == uid(user),
        )
    )
    return ApiResponse(
        data={"id": str(record.id), "paymentStatus": record.payment_status}
        if record
        else None
    )
