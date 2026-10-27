"""Validated Resource Sharing + Chat request bodies."""

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Category = Literal["notebook", "lab-report", "t-scale", "bicycle", "other"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ResourceProfileIn(Input):
    is_discoverable: bool
    level: str | None = Field(default=None, max_length=60)
    hall: str | None = Field(default=None, max_length=100)
    availability_note: str | None = Field(default=None, max_length=500)
    categories: list[Category] = Field(default_factory=list, max_length=5)

    @field_validator("level", "hall", "availability_note")
    @classmethod
    def trim_optional(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @model_validator(mode="after")
    def valid_categories(self) -> "ResourceProfileIn":
        if len(set(self.categories)) != len(self.categories):
            raise ValueError("Resource categories must be unique")
        if self.is_discoverable and not self.categories:
            raise ValueError("Select at least one resource category to be discoverable")
        return self


class ResourceRequestIn(Input):
    recipient_id: uuid.UUID
    category: Category
    resource_name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=2000)

    @field_validator("resource_name", "description")
    @classmethod
    def nonblank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Must not be blank")
        return value


class RequestDecisionIn(Input):
    decision: Literal["accepted", "rejected"]


class MessageIn(Input):
    body: str = Field(min_length=1, max_length=4000)

    @field_validator("body")
    @classmethod
    def nonblank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message must not be blank")
        return value
