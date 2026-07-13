"""Pydantic schemas for the Error-log (`/api/v1/errors`) endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ErrorLogCreateRequest(BaseModel):
    """JSON body for ``POST /api/v1/errors``.

    Owner is resolved from the composite ``(system_user_id, system_uuid)`` key.
    Optional FK fields must be owned by the same learner or the request 404s.
    """

    model_config = ConfigDict(extra="forbid")

    system_user_id: str = Field(
        ...,
        min_length=1,
        max_length=36,
        description="External user id; composite key with `system_uuid`.",
    )
    system_uuid: UUID = Field(
        ...,
        description="Source system UUID (`systems.system_uuid`).",
    )
    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Free-text learner note about the mistake (trimmed; non-empty).",
    )
    conspectus_uuid: UUID | None = Field(
        default=None,
        description="Optional link to a conspectus the error refers to.",
    )
    review_log_id: int | None = Field(
        default=None,
        ge=1,
        description="Optional link to a specific review log row.",
    )

    @field_validator("message")
    @classmethod
    def _strip_and_check_non_empty(cls, value: str) -> str:
        """Trim trailing whitespace and reject blank-after-trim messages.

        Args:
            value: Raw message string from the request body.

        Returns:
            The trimmed message.

        Raises:
            ValueError: When the trimmed message is empty.
        """
        stripped = value.strip()
        if not stripped:
            raise ValueError("`message` must not be empty after trimming whitespace.")
        return stripped


class ErrorLogResponse(BaseModel):
    """Single ``learning_errors`` row returned by create / list endpoints."""

    model_config = ConfigDict(from_attributes=True)

    error_uuid: str
    message: str
    conspectus_uuid: str | None
    review_log_id: int | None
    created_at: datetime
