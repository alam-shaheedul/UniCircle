"""Prepare validated registrations without persisting an unapproved schema."""

from dataclasses import dataclass

from app.core.security import hash_password
from app.modules.auth.schemas import GeneralRole, RegistrationRequest


@dataclass(frozen=True)
class PendingRegistration:
    first_name: str
    last_name: str
    home_address: str
    username: str
    email: str
    password_hash: str
    role: GeneralRole
    university_id: str
    is_verified: bool = False


def prepare_registration(request: RegistrationRequest) -> PendingRegistration:
    """Return storage-ready data with no plaintext password or Admin role."""
    return PendingRegistration(
        first_name=request.first_name,
        last_name=request.last_name,
        home_address=request.home_address,
        username=request.username,
        email=request.email,
        password_hash=hash_password(request.password.get_secret_value()),
        role=request.role,
        university_id=request.university_id,
    )
