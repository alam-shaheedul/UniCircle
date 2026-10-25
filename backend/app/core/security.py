"""Password and access-token primitives. No account lookup happens in JWT decoding."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe

import jwt
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

from app.core.config import Settings

ALGORITHM = "HS256"
_password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    if not password or len(password.encode("utf-8")) > 1024:
        raise ValueError("Password length is invalid")
    return _password_hash.hash(password)


def verify_password(password: str, encoded_hash: str) -> bool:
    if not password or not encoded_hash:
        return False
    try:
        return _password_hash.verify(password, encoded_hash)
    except (UnknownHashError, ValueError):
        return False


@dataclass(frozen=True)
class AccessTokenClaims:
    subject: str
    token_id: str
    expires_at: datetime


class InvalidAccessToken(Exception):
    """The token is missing required claims, invalid, or expired."""


def create_access_token(subject: str, settings: Settings) -> str:
    if not subject or not subject.strip():
        raise ValueError("Access token subject is required")
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=settings.jwt_access_token_minutes)
    payload = {
        "sub": subject,
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": now,
        "nbf": now,
        "exp": expires_at,
        "jti": token_urlsafe(24),
    }
    return jwt.encode(payload, settings.require_jwt_key(), algorithm=ALGORITHM)


def decode_access_token(token: str, settings: Settings) -> AccessTokenClaims:
    key = settings.require_jwt_key()
    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=[ALGORITHM],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options={"require": ["sub", "iss", "aud", "iat", "nbf", "exp", "jti"]},
        )
        subject = payload["sub"]
        token_id = payload["jti"]
        if not isinstance(subject, str) or not subject.strip():
            raise InvalidAccessToken
        if not isinstance(token_id, str) or not token_id.strip():
            raise InvalidAccessToken
        return AccessTokenClaims(
            subject=subject,
            token_id=token_id,
            expires_at=datetime.fromtimestamp(payload["exp"], tz=UTC),
        )
    except (InvalidTokenError, KeyError, TypeError, ValueError, OverflowError) as exc:
        raise InvalidAccessToken from exc
