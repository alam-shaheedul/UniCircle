"""Authenticated community discussion and App Admin moderation endpoints."""

import uuid
from collections import defaultdict
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.schemas import ApiResponse
from app.core.audit import record_admin_action
from app.core.auth import AuthIdentity, get_current_admin, get_current_user
from app.core.errors import AppError
from app.db.models import ForumComment, ForumPost, ForumReport, User
from app.db.session import get_db
from app.modules.forum.schemas import CommentIn, ModerationIn, PostIn, ReportIn

router = APIRouter(tags=["community-forum"])
Db = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[AuthIdentity, Depends(get_current_user)]
CurrentAdmin = Annotated[AuthIdentity, Depends(get_current_admin)]


def fail(status: int, code: str, message: str) -> None:
    raise AppError(status_code=status, code=code, message=message)


def general_user_id(user: AuthIdentity) -> uuid.UUID:
    if user.role == "admin":
        fail(403, "general_user_required", "A General User account is required.")
    return uuid.UUID(user.id)


def display_name(person: User | None) -> str:
    if person is None:
        return "Former CUET user"
    name = f"{person.first_name or ''} {person.last_name or ''}".strip()
    return name or person.username or "CUET user"


def author_data(person: User) -> dict:
    return {
        "id": str(person.id),
        "displayName": display_name(person),
        "username": person.username or "cuet-user",
        "role": person.role,
        "academicUnit": person.department_name or person.role.title(),
    }


def comment_data(db: Session, item: ForumComment) -> dict:
    author = db.get(User, item.author_id)
    if author is None:
        fail(404, "comment_author_not_found", "Comment author not found.")
    return {
        "id": str(item.id),
        "postId": str(item.post_id),
        "author": author_data(author),
        "body": item.body,
        "createdAt": item.created_at.isoformat(),
    }


def post_data(
    db: Session,
    item: ForumPost,
    viewer_id: uuid.UUID,
    *,
    comments: list[ForumComment] | None = None,
) -> dict:
    author = db.get(User, item.author_id)
    if author is None:
        fail(404, "post_not_found", "Forum post not found.")
    if comments is None:
        comments = list(
            db.scalars(
                select(ForumComment)
                .where(ForumComment.post_id == item.id)
                .order_by(ForumComment.created_at, ForumComment.id)
            ).all()
        )
    reported = db.scalar(
        select(ForumReport.id).where(
            ForumReport.post_id == item.id,
            ForumReport.reporter_id == viewer_id,
        )
    )
    return {
        "id": str(item.id),
        "author": author_data(author),
        "body": item.body,
        "createdAt": item.created_at.isoformat(),
        "comments": [comment_data(db, comment) for comment in comments],
        "isReportedByCurrentUser": reported is not None,
    }


def active_post(db: Session, post_id: uuid.UUID) -> ForumPost:
    post = db.get(ForumPost, post_id)
    if post is None or post.removed_at is not None:
        fail(404, "post_not_found", "Forum post not found.")
    return post


def report_data(db: Session, item: ForumReport) -> dict:
    post = db.get(ForumPost, item.post_id)
    reporter = db.get(User, item.reporter_id)
    author = db.get(User, post.author_id) if post else None
    return {
        "id": str(item.id),
        "postId": str(item.post_id),
        "authorName": display_name(author),
        "reportedBy": display_name(reporter),
        "reason": item.reason,
        "postBody": post.body if post else "Post no longer available.",
        "reportedAt": item.created_at.isoformat(),
        "status": item.status,
        "resolvedAt": item.resolved_at.isoformat() if item.resolved_at else None,
    }


@router.get("/forum/posts", response_model=ApiResponse[dict])
def list_posts(
    db: Db,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ApiResponse[dict]:
    viewer_id = general_user_id(user)
    current = db.get(User, viewer_id)
    if current is None:
        fail(404, "user_not_found", "User account not found.")
    total = (
        db.scalar(
            select(func.count())
            .select_from(ForumPost)
            .where(ForumPost.removed_at.is_(None))
        )
        or 0
    )
    posts = list(
        db.scalars(
            select(ForumPost)
            .where(ForumPost.removed_at.is_(None))
            .order_by(ForumPost.created_at.desc(), ForumPost.id.desc())
            .limit(limit)
            .offset(offset)
        ).all()
    )
    comments_by_post: dict[uuid.UUID, list[ForumComment]] = defaultdict(list)
    if posts:
        comments = db.scalars(
            select(ForumComment)
            .where(ForumComment.post_id.in_([post.id for post in posts]))
            .order_by(ForumComment.created_at, ForumComment.id)
        ).all()
        for comment in comments:
            comments_by_post[comment.post_id].append(comment)
    return ApiResponse(
        data={
            "currentUser": author_data(current),
            "posts": [
                post_data(
                    db,
                    post,
                    viewer_id,
                    comments=comments_by_post[post.id],
                )
                for post in posts
            ],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    )


@router.post("/forum/posts", response_model=ApiResponse[dict], status_code=201)
def create_post(body: PostIn, db: Db, user: CurrentUser) -> ApiResponse[dict]:
    author_id = general_user_id(user)
    item = ForumPost(author_id=author_id, body=body.body)
    db.add(item)
    db.commit()
    db.refresh(item)
    return ApiResponse(data=post_data(db, item, author_id, comments=[]))


@router.get("/forum/posts/{post_id}", response_model=ApiResponse[dict])
def get_post(post_id: uuid.UUID, db: Db, user: CurrentUser) -> ApiResponse[dict]:
    return ApiResponse(
        data=post_data(db, active_post(db, post_id), general_user_id(user))
    )


@router.get("/forum/posts/{post_id}/comments", response_model=ApiResponse[list[dict]])
def list_comments(
    post_id: uuid.UUID, db: Db, user: CurrentUser
) -> ApiResponse[list[dict]]:
    general_user_id(user)
    active_post(db, post_id)
    comments = db.scalars(
        select(ForumComment)
        .where(ForumComment.post_id == post_id)
        .order_by(ForumComment.created_at, ForumComment.id)
    ).all()
    return ApiResponse(data=[comment_data(db, item) for item in comments])


@router.post(
    "/forum/posts/{post_id}/comments",
    response_model=ApiResponse[dict],
    status_code=201,
)
def add_comment(
    post_id: uuid.UUID, body: CommentIn, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    author_id = general_user_id(user)
    active_post(db, post_id)
    item = ForumComment(post_id=post_id, author_id=author_id, body=body.body)
    db.add(item)
    db.commit()
    db.refresh(item)
    return ApiResponse(data=comment_data(db, item))


@router.post(
    "/forum/posts/{post_id}/reports",
    response_model=ApiResponse[dict],
    status_code=201,
)
def report_post(
    post_id: uuid.UUID, body: ReportIn, db: Db, user: CurrentUser
) -> ApiResponse[dict]:
    reporter_id = general_user_id(user)
    active_post(db, post_id)
    existing = db.scalar(
        select(ForumReport).where(
            ForumReport.post_id == post_id,
            ForumReport.reporter_id == reporter_id,
        )
    )
    if existing is not None:
        fail(409, "post_already_reported", "You already reported this post.")
    item = ForumReport(
        post_id=post_id,
        reporter_id=reporter_id,
        reason=body.reason,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ApiResponse(data=report_data(db, item))


@router.get("/admin/forum/reports", response_model=ApiResponse[list[dict]])
def list_reports(
    db: Db,
    _admin: CurrentAdmin,
    status: Annotated[
        str | None, Query(pattern=r"^(open|resolved|post-removed)$")
    ] = None,
) -> ApiResponse[list[dict]]:
    query = select(ForumReport)
    if status:
        query = query.where(ForumReport.status == status)
    items = db.scalars(
        query.order_by(ForumReport.created_at.desc(), ForumReport.id.desc())
    ).all()
    return ApiResponse(data=[report_data(db, item) for item in items])


@router.get("/admin/forum/reports/{report_id}", response_model=ApiResponse[dict])
def get_report(report_id: uuid.UUID, db: Db, _admin: CurrentAdmin) -> ApiResponse[dict]:
    item = db.get(ForumReport, report_id)
    if item is None:
        fail(404, "report_not_found", "Forum report not found.")
    return ApiResponse(data=report_data(db, item))


@router.put("/admin/forum/reports/{report_id}", response_model=ApiResponse[dict])
def moderate_report(
    report_id: uuid.UUID,
    body: ModerationIn,
    db: Db,
    admin: CurrentAdmin,
) -> ApiResponse[dict]:
    item = db.scalar(
        select(ForumReport).where(ForumReport.id == report_id).with_for_update()
    )
    if item is None:
        fail(404, "report_not_found", "Forum report not found.")
    if item.status != "open":
        if item.status == body.decision:
            return ApiResponse(data=report_data(db, item))
        fail(409, "report_already_reviewed", "This report was already reviewed.")
    now = datetime.now(UTC)
    item.status = body.decision
    item.reviewer_id = uuid.UUID(admin.id)
    item.resolved_at = now
    if body.decision == "post-removed":
        post = db.get(ForumPost, item.post_id)
        if post is not None and post.removed_at is None:
            post.removed_at = now
            post.removed_by_user_id = uuid.UUID(admin.id)
        related = db.scalars(
            select(ForumReport).where(
                ForumReport.post_id == item.post_id,
                ForumReport.status == "open",
            )
        ).all()
        for report in related:
            report.status = "post-removed"
            report.reviewer_id = uuid.UUID(admin.id)
            report.resolved_at = now
    record_admin_action(
        db,
        admin,
        action=f"forum_report.{body.decision}",
        target_type="forum_report",
        target_id=str(item.id),
        details={"postId": str(item.post_id)},
    )
    db.commit()
    return ApiResponse(data=report_data(db, item))
