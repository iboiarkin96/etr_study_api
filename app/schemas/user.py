"""Pydantic schemas for user registration endpoint."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.enums import TimezoneField


class UserRegisterRequest(BaseModel):
    """Incoming payload for creating/updating user."""

    system_user_id: UUID = Field(
        ...,
        description="User ID in the source system (unique identity).",
        examples=["a1b2c3d4-0001-4000-8000-000000000001"],
    )
    username: str | None = Field(
        default=None,
        max_length=255,
        description="Username or login.",
        examples=["ipetrov"],
    )
    full_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Full name of the user.",
        examples=["Ivan Petrov"],
    )
    timezone: TimezoneField = Field(
        default="UTC",
        min_length=1,
        max_length=64,
        description="IANA timezone name (e.g. 'UTC', 'Europe/Moscow').",
        examples=["Europe/Moscow", "UTC", "America/New_York"],
    )
    system_uuid: UUID | None = Field(
        default=None,
        description="UUID of related system.",
        examples=["b2c3d4e5-0002-4000-8000-000000000002"],
    )
    invalidation_reason_uuid: UUID | None = Field(
        default=None,
        description="Related invalidation reason UUID.",
        examples=["c3d4e5f6-0003-4000-8000-000000000003"],
    )
    is_row_invalid: int = Field(
        default=0,
        ge=0,
        le=1,
        description="Invalid row flag (0/1).",
        examples=[0, 1],
    )


class UserRegisterResponse(BaseModel):
    """Outgoing payload with persisted user data."""

    model_config = ConfigDict(from_attributes=True)

    client_uuid: str
    created_at: datetime
    updated_at: datetime
    is_row_invalid: int
    invalidation_reason_uuid: str | None
    system_user_id: str | None
    system_uuid: str | None
    username: str | None
    full_name: str
    timezone: str
