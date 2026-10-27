"""Validation schemas for text-only forum interactions."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PostIn(Input):
    body: str = Field(min_length=1, max_length=1200)

    @field_validator("body")
    @classmethod
    def normalize_body(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Post text must not be blank")
        return value


class CommentIn(Input):
    body: str = Field(min_length=1, max_length=600)

    @field_validator("body")
    @classmethod
    def normalize_body(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Comment text must not be blank")
        return value


class ReportIn(Input):
    reason: str = Field(min_length=3, max_length=500)

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Report reason must not be blank")
        return value


class ModerationIn(Input):
    decision: Literal["resolved", "post-removed"]
