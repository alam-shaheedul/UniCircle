"""Shared public response shapes. Feature schemas belong in their own modules."""

from typing import Literal

from pydantic import BaseModel


class ApiResponse[DataT](BaseModel):
    data: DataT


class HealthStatus(BaseModel):
    status: Literal["ok"] = "ok"
    service: Literal["unicircle-api"] = "unicircle-api"


class ErrorDetail(BaseModel):
    field: str
    message: str
    type: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody
