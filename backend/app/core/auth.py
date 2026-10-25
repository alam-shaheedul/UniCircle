"""Protected-route dependencies; Phase 7 supplies the real identity repository."""

from dataclasses import dataclass
from typing import Annotated, Literal, Protocol

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.security import (
    AccessTokenClaims,
    InvalidAccessToken,
    decode_access_token,
)
from app.db.session import get_db

UserRole = Literal["student", "teacher", "staff", "admin"]


@dataclass(frozen=True)
class AuthIdentity:
    id: str
    role: UserRole
    is_active: bool
    is_verified: bool


class IdentityLookup(Protocol):
    def get_by_id(self, user_id: str, token_id: str) -> AuthIdentity | None: ...


def get_identity_lookup(db: Annotated[Session, Depends(get_db)]) -> IdentityLookup:
    from app.modules.auth.persistence import DatabaseIdentityLookup

    return DatabaseIdentityLookup(db)


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="Invalid or expired credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_token_claims(
    token: Annotated[str, Depends(oauth2_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AccessTokenClaims:
    try:
        return decode_access_token(token, settings)
    except InvalidAccessToken as exc:
        raise _unauthorized() from exc
    except ValueError as exc:
        raise AppError(
            status_code=503,
            code="authentication_unavailable",
            message="Authentication is not configured yet.",
        ) from exc


def get_current_user(
    claims: Annotated[AccessTokenClaims, Depends(get_token_claims)],
    identities: Annotated[IdentityLookup, Depends(get_identity_lookup)],
) -> AuthIdentity:
    identity = identities.get_by_id(claims.subject, claims.token_id)
    if identity is None or not identity.is_active or not identity.is_verified:
        raise _unauthorized()
    return identity


def get_current_admin(
    identity: Annotated[AuthIdentity, Depends(get_current_user)],
) -> AuthIdentity:
    if identity.role != "admin":
        raise AppError(
            status_code=403,
            code="forbidden",
            message="App Admin access is required.",
        )
    return identity
