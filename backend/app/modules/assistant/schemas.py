"""Strict request contracts for the Campus AI Assistant."""

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AssistantQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=2, max_length=500)

    @field_validator("question")
    @classmethod
    def clean_question(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("Question must contain at least two characters")
        return cleaned
