"""Pydantic schemas for the Schedule projection endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

WindowLiteral = Literal["PT1H", "PT4H", "PT24H", "P1D"]

RANDOM_SEED_PATTERN = r"^[A-Za-z0-9_-]{1,64}$"


class ScheduleSummarySlotCounts(BaseModel):
    """Counts per ETR slot; every letter is always present (zero when empty)."""

    A: int = Field(..., ge=0)
    B: int = Field(..., ge=0)
    C: int = Field(..., ge=0)
    D: int = Field(..., ge=0)


class ScheduleSummaryResponse(BaseModel):
    """Body returned by ``GET /api/v1/schedule/summary``."""

    model_config = ConfigDict(extra="forbid")

    by_slot: ScheduleSummarySlotCounts
    due_now: int = Field(..., ge=0)
    due_next_24h: int = Field(..., ge=0)
    total: int = Field(..., ge=0)
    computed_at: datetime


class SchedulePreviewItem(BaseModel):
    """One row inside the preview payload."""

    preview_order_index: int = Field(..., ge=0)
    conspectus_uuid: str
    title: str | None = None
    slot: str = Field(..., min_length=1, max_length=1)
    next_review_at: datetime


class SchedulePreviewResponse(BaseModel):
    """Body returned by ``GET /api/v1/schedule/preview``."""

    model_config = ConfigDict(extra="forbid")

    window: WindowLiteral
    computed_at: datetime
    random_seed: str
    count: int = Field(..., ge=0)
    items: list[SchedulePreviewItem]


PreviewLimit = Annotated[int, Field(strict=True, ge=1, le=100)]
