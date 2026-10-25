"""Shared input normalization; feature-specific rules belong to their modules."""

from email_validator import EmailNotValidError, validate_email

CUET_EMAIL_DOMAINS = frozenset({"cuet.ac.bd", "student.cuet.ac.bd"})


def normalize_cuet_email(value: str) -> str:
    try:
        normalized = validate_email(value.strip(), check_deliverability=False)
    except EmailNotValidError as exc:
        raise ValueError("Enter a valid CUET email address") from exc
    if normalized.domain.lower() not in CUET_EMAIL_DOMAINS:
        raise ValueError(
            "Use a CUET email address (@cuet.ac.bd or @student.cuet.ac.bd)"
        )
    return normalized.normalized.lower()


def require_nonblank(value: str, *, field: str, max_length: int) -> str:
    normalized = value.strip()
    if not normalized or len(normalized) > max_length:
        raise ValueError(f"{field} must contain 1 to {max_length} characters")
    return normalized
