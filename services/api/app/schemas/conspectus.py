"""Pydantic schemas for the Conspectus (`/api/v1/conspectuses`) endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

TITLE_MAX_LEN = 256
DENSE_PARAGRAPH_MAX_LEN = 4000
BULLETS_MAX_COUNT = 20
BULLET_MAX_LEN = 500

Slot = Literal["A", "B", "C", "D"]
ReviewTag = Literal["easy", "hard", "forgot"]


class ConspectusCreateRequest(BaseModel):
    """JSON body for ``POST /api/v1/conspectuses``."""

    model_config = ConfigDict(extra="forbid")

    system_user_id: str = Field(..., min_length=1, max_length=36)
    system_uuid: UUID
    title: str | None = Field(default=None, max_length=TITLE_MAX_LEN)
    cue_sheet: dict[str, Any] = Field(..., description="Object of ETR cue tags (schema v1).")
    dense_paragraph: str = Field(..., min_length=1, max_length=DENSE_PARAGRAPH_MAX_LEN)
    bullets: list[str] = Field(..., min_length=1, max_length=BULLETS_MAX_COUNT)

    @field_validator("bullets")
    @classmethod
    def _validate_bullets(cls, value: list[str]) -> list[str]:
        """Ensure each bullet is a non-empty string within the max length.

        Args:
            value: Raw list from the request body.

        Returns:
            Same list when valid.

        Raises:
            ValueError: On empty or over-long bullets.
        """
        for index, bullet in enumerate(value):
            if not isinstance(bullet, str):
                raise ValueError(f"bullets[{index}] must be a string.")
            if len(bullet) == 0 or len(bullet) > BULLET_MAX_LEN:
                raise ValueError(f"bullets[{index}] must be 1..{BULLET_MAX_LEN} characters.")
        return value


class ConspectusPatchRequest(BaseModel):
    """JSON body for ``PATCH /api/v1/conspectuses/{id}`` — at least one ETR field required."""

    model_config = ConfigDict(extra="forbid")

    system_user_id: str = Field(..., min_length=1, max_length=36)
    system_uuid: UUID
    title: str | None = Field(default=None, max_length=TITLE_MAX_LEN)
    cue_sheet: dict[str, Any] | None = None
    dense_paragraph: str | None = Field(
        default=None, min_length=1, max_length=DENSE_PARAGRAPH_MAX_LEN
    )
    bullets: list[str] | None = Field(default=None, min_length=1, max_length=BULLETS_MAX_COUNT)

    @field_validator("bullets")
    @classmethod
    def _validate_bullets(cls, value: list[str] | None) -> list[str] | None:
        """Same length rules as create, but the whole field remains optional.

        Args:
            value: Optional bullet list from the request body.

        Returns:
            The list unchanged when valid; ``None`` passes through.

        Raises:
            ValueError: On empty or over-long bullets.
        """
        if value is None:
            return None
        for index, bullet in enumerate(value):
            if not isinstance(bullet, str):
                raise ValueError(f"bullets[{index}] must be a string.")
            if len(bullet) == 0 or len(bullet) > BULLET_MAX_LEN:
                raise ValueError(f"bullets[{index}] must be 1..{BULLET_MAX_LEN} characters.")
        return value

    @model_validator(mode="after")
    def _reject_null_replacement(self) -> ConspectusPatchRequest:
        """Reject explicit ``null`` on fields that back NOT NULL columns.

        A missing field means "leave unchanged"; sending ``null`` for
        ``cue_sheet`` / ``dense_paragraph`` / ``bullets`` would try to write NULL
        into a non-nullable column. Omit the field instead.
        """
        for name in ("cue_sheet", "dense_paragraph", "bullets"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(
                    f"`{name}` must not be null; omit the field to leave it unchanged."
                )
        return self


class ConspectusDeleteRequest(BaseModel):
    """JSON body for ``DELETE /api/v1/conspectuses/{id}`` (soft-delete with reason)."""

    model_config = ConfigDict(extra="forbid")

    system_user_id: str = Field(..., min_length=1, max_length=36)
    system_uuid: UUID
    invalidation_reason_uuid: UUID


class ConspectusReviewRequest(BaseModel):
    """JSON body for ``POST /api/v1/conspectuses/{id}/actions/review``."""

    model_config = ConfigDict(extra="forbid")

    system_user_id: str = Field(..., min_length=1, max_length=36)
    system_uuid: UUID
    tag: ReviewTag
    expected_schedule_revision: int | None = Field(default=None, ge=1)
    reviewed_at: datetime | None = None


class ConspectusResponse(BaseModel):
    """Full conspectus resource returned by create / get / patch / delete / review / lists.

    Flattens the paired :class:`~app.models.core.conspectus.ConspectusSchedule` fields so
    clients can render slot + next_review_at without a second request.
    """

    model_config = ConfigDict(from_attributes=True)

    conspectus_uuid: str
    title: str | None
    cue_sheet: dict[str, Any]
    cue_sheet_schema_version: int
    dense_paragraph: str
    bullets: list[str]
    content_version: int
    slot: Slot
    slot_d_ladder_index: int
    next_review_at: datetime
    schedule_revision: int
    schedule_policy_id: str
    schedule_policy_version: str
    algorithm_version: str
    schedule_updated_at: datetime
    is_row_invalid: int
    invalidation_reason_uuid: str | None
    invalidated_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ConspectusListResponse(BaseModel):
    """List envelope for ``GET /api/v1/conspectuses``."""

    model_config = ConfigDict(extra="forbid")

    items: list[ConspectusResponse]
    next_cursor: str | None
    count: int = Field(..., ge=0)
    has_more: bool


class ConspectusHistoryReviewPayload(BaseModel):
    """Nested payload for ``event_type=review`` history rows."""

    tag: ReviewTag
    slot_from: Slot
    slot_to: Slot
    slot_d_ladder_index_from: int
    slot_d_ladder_index_to: int
    schedule_revision_after: int
    next_review_at_after: datetime


class ConspectusHistoryContentPatchPayload(BaseModel):
    """Nested payload for ``event_type=content_patch`` history rows."""

    changed_fields: list[str]
    content_version_after: int


class ConspectusHistoryActor(BaseModel):
    """Actor identity carried on every history row."""

    system_user_id: str
    system_uuid: str


class ConspectusHistoryEvent(BaseModel):
    """One history entry. Only the matching discriminator payload is populated."""

    event_id: str
    event_type: Literal["review", "content_patch"]
    created_at: datetime
    actor: ConspectusHistoryActor
    review: ConspectusHistoryReviewPayload | None = None
    content_patch: ConspectusHistoryContentPatchPayload | None = None


class ConspectusHistoryResponse(BaseModel):
    """List envelope for ``GET /api/v1/conspectuses/{id}/history``."""

    model_config = ConfigDict(extra="forbid")

    conspectus_uuid: str
    items: list[ConspectusHistoryEvent]
    next_cursor: str | None
    count: int = Field(..., ge=0)
    has_more: bool
