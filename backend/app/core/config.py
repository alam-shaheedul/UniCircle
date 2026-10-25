"""Backend-only settings; browser code must not import this module."""

from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit, urlunsplit

from pydantic import Field, HttpUrl, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPOSITORY_ROOT = BACKEND_ROOT.parent
LOCAL_DATABASE_URL = "postgresql+psycopg://unicircle_dev@localhost:5432/unicircle_dev"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPOSITORY_ROOT / ".env", BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "testing", "production"] = "development"
    frontend_url: HttpUrl = HttpUrl("http://localhost:3000")
    database_url: str = LOCAL_DATABASE_URL
    database_startup_timeout_seconds: int = Field(default=60, ge=1, le=300)
    database_startup_retry_seconds: float = Field(default=2.0, ge=0.1, le=30)
    jwt_secret: SecretStr | None = None
    jwt_issuer: str = "unicircle-api"
    jwt_audience: str = "unicircle-web"
    jwt_access_token_minutes: int = Field(default=30, ge=1, le=1440)
    otp_pepper: SecretStr | None = None
    otp_expiry_minutes: int = Field(default=10, ge=1, le=30)
    otp_resend_cooldown_seconds: int = Field(default=60, ge=10, le=3600)
    otp_max_attempts: int = Field(default=5, ge=1, le=10)
    smtp_host: str | None = None
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_tls_mode: Literal["starttls", "ssl"] = "starttls"
    smtp_username: str | None = None
    smtp_password: SecretStr | None = None
    smtp_from_email: str | None = None
    rag_chat_provider: Literal["auto", "groq", "ollama"] = "auto"
    groq_api_key: SecretStr | None = None
    groq_chat_model: str = Field(default="qwen/qwen3.8-27b", min_length=1)
    groq_timeout_seconds: int = Field(default=60, ge=5, le=120)
    groq_max_output_tokens: int = Field(default=512, ge=64, le=2048)
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_chat_model: str = "qwen3:1.7b"
    ollama_embedding_model: str = "embeddinggemma:300m"
    rag_embedding_provider: Literal["ollama", "fastembed"] = "ollama"
    fastembed_model: Literal["BAAI/bge-small-en-v1.5"] = "BAAI/bge-small-en-v1.5"
    rag_knowledge_mode: Literal["curated", "web"] = "curated"
    rag_allowed_hosts: str = "cuet.ac.bd"
    rag_seed_urls: str = "https://cuet.ac.bd/"
    rag_max_pages: int = Field(default=500, ge=1, le=5000)
    rag_max_depth: int = Field(default=5, ge=0, le=12)
    rag_request_timeout_seconds: int = Field(default=20, ge=5, le=120)
    rag_requests_per_second: float = Field(default=1.0, gt=0, le=5)
    rag_chunk_size: int = Field(default=1200, ge=300, le=4000)
    rag_chunk_overlap: int = Field(default=180, ge=0, le=1000)
    rag_retrieval_limit: int = Field(default=5, ge=1, le=10)
    rag_similarity_threshold: float = Field(default=0.24, ge=-1, le=1)
    rag_query_limit: int = Field(default=10, ge=1, le=100)
    rag_query_window_minutes: int = Field(default=5, ge=1, le=60)

    @model_validator(mode="after")
    def validate_database_configuration(self) -> "Settings":
        if not self.database_url.startswith("postgresql+psycopg://"):
            raise ValueError("DATABASE_URL must use the postgresql+psycopg driver")
        if self.app_env != "development" and self.database_url == LOCAL_DATABASE_URL:
            raise ValueError("Testing and production require an explicit DATABASE_URL")
        if self.app_env == "production":
            self.require_jwt_key()
            self.require_otp_key()
            self.require_smtp_configuration()
        if self.rag_chunk_overlap >= self.rag_chunk_size:
            raise ValueError("RAG_CHUNK_OVERLAP must be smaller than RAG_CHUNK_SIZE")
        if not self.rag_hosts:
            raise ValueError("RAG_ALLOWED_HOSTS must contain at least one host")
        return self

    @staticmethod
    def _required_key(value: SecretStr | None, name: str) -> bytes:
        raw = value.get_secret_value() if value else ""
        if len(raw.encode("utf-8")) < 32 or raw.startswith("replace-"):
            raise ValueError(f"{name} must be a configured secret of at least 32 bytes")
        return raw.encode("utf-8")

    def require_jwt_key(self) -> bytes:
        return self._required_key(self.jwt_secret, "JWT_SECRET")

    def require_otp_key(self) -> bytes:
        return self._required_key(self.otp_pepper, "OTP_PEPPER")

    @property
    def assistant_embedding_model(self) -> str:
        if self.rag_embedding_provider == "fastembed":
            return f"fastembed:{self.fastembed_model}"
        return self.ollama_embedding_model

    @property
    def assistant_chat_provider(self) -> Literal["groq", "ollama"]:
        if self.rag_chat_provider != "auto":
            return self.rag_chat_provider
        raw = self.groq_api_key.get_secret_value() if self.groq_api_key else ""
        return "groq" if raw.strip() else "ollama"

    def require_groq_key(self) -> str:
        raw = self.groq_api_key.get_secret_value() if self.groq_api_key else ""
        key = raw.strip()
        if not key or key.startswith("replace-"):
            raise ValueError("GROQ_API_KEY is not configured")
        return key

    def require_smtp_configuration(self) -> tuple[str, int, str, str, str, str]:
        host = self.smtp_host or ""
        username = self.smtp_username or ""
        password = self.smtp_password.get_secret_value() if self.smtp_password else ""
        sender = self.smtp_from_email or ""
        if (
            not host
            or host.endswith(".example.com")
            or not username
            or username == "replace-me"
            or not password
            or password == "replace-me"
            or not sender
            or sender.endswith("@example.com")
        ):
            raise ValueError("SMTP configuration is incomplete")
        return host, self.smtp_port, username, password, sender, self.smtp_tls_mode

    @property
    def rag_hosts(self) -> tuple[str, ...]:
        return tuple(
            host.strip().lower().rstrip(".")
            for host in self.rag_allowed_hosts.split(",")
            if host.strip()
        )

    @property
    def rag_seeds(self) -> tuple[str, ...]:
        return tuple(
            url.strip() for url in self.rag_seed_urls.split(",") if url.strip()
        )

    @property
    def cors_origins(self) -> list[str]:
        configured = str(self.frontend_url).rstrip("/")
        origins = [configured]
        if self.app_env == "development":
            parts = urlsplit(configured)
            loopback = {"localhost": "127.0.0.1", "127.0.0.1": "localhost"}
            alternate_host = loopback.get(parts.hostname or "")
            if alternate_host:
                alternate_netloc = alternate_host
                if parts.port:
                    alternate_netloc = f"{alternate_host}:{parts.port}"
                origins.append(urlunsplit((parts.scheme, alternate_netloc, "", "", "")))
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
