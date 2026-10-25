"""Strict source policy for CUET web knowledge ingestion."""

from dataclasses import dataclass
from posixpath import normpath
from urllib.parse import urljoin, urlsplit, urlunsplit

BLOCKED_PREFIXES = (
    "/admin",
    "/login",
    "/signin",
    "/student",
    "/portal",
    "/api",
    "/_next",
)
BLOCKED_SUFFIXES = {
    ".7z",
    ".avi",
    ".css",
    ".csv",
    ".doc",
    ".docx",
    ".gif",
    ".ico",
    ".jpeg",
    ".jpg",
    ".js",
    ".json",
    ".mov",
    ".mp3",
    ".mp4",
    ".png",
    ".rar",
    ".svg",
    ".webm",
    ".webp",
    ".xls",
    ".xlsx",
    ".xml",
    ".zip",
}


@dataclass(frozen=True)
class SourcePolicy:
    allowed_hosts: tuple[str, ...]

    def canonicalize(self, value: str, *, base_url: str | None = None) -> str | None:
        candidate = urljoin(base_url, value) if base_url else value
        parts = urlsplit(candidate.strip())
        host = (parts.hostname or "").lower().rstrip(".")
        if parts.scheme != "https" or host not in self.allowed_hosts:
            return None
        if parts.username or parts.password or parts.port not in (None, 443):
            return None
        path = "/" + normpath(parts.path or "/").lstrip("/")
        if parts.path.endswith("/") and path != "/":
            path += "/"
        lowered = path.lower()
        if any(
            lowered == prefix or lowered.startswith(f"{prefix}/")
            for prefix in BLOCKED_PREFIXES
        ):
            return None
        if any(lowered.endswith(suffix) for suffix in BLOCKED_SUFFIXES):
            return None
        # Query strings create duplicate/filter URLs and are not approved by default.
        return urlunsplit(("https", host, path, "", ""))

    def is_pdf(self, url: str) -> bool:
        return urlsplit(url).path.lower().endswith(".pdf")
