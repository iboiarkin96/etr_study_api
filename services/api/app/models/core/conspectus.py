"""Core business models: conspectus (note) + its schedule, event, and review log."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _utc_now() -> datetime:
    """Return current UTC time with tzinfo for timestamp columns.

    Returns:
        Timezone-aware ``datetime`` in UTC.
    """
    return datetime.now(UTC)


class Conspectus(Base):
    """Learner-authored ETR note (title/cue_sheet/dense_paragraph/bullets).

    Ownership: :attr:`owner_client_uuid` (``users.client_uuid``). Soft-deleted via
    :attr:`is_row_invalid`; the paired :class:`ConspectusSchedule` row mirrors that flag.
    Content edits bump :attr:`content_version`; the schedule row is untouched by content edits.
    """

    __tablename__ = "conspectuses"

    conspectus_uuid: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    owner_client_uuid: Mapped[str] = mapped_column(
        ForeignKey("users.client_uuid"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(256), nullable=True)
    cue_sheet: Mapped[Any] = mapped_column(JSONB, nullable=False)
    cue_sheet_schema_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )
    dense_paragraph: Mapped[str] = mapped_column(Text, nullable=False)
    bullets: Mapped[Any] = mapped_column(JSONB, nullable=False)
    content_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utc_now,
        onupdate=_utc_now,
    )
    is_row_invalid: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    invalidation_reason_uuid: Mapped[str] = mapped_column(
        ForeignKey("invalidation_reasons.invalidation_reason_uuid"),
        nullable=True,
    )
    invalidated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class ConspectusSchedule(Base):
    """One-to-one review-schedule row for a :class:`Conspectus`.

    Pins :attr:`schedule_policy_id` + :attr:`schedule_policy_version` so historical
    reviews replay against the algorithm active at the time of the review. Row is
    updated (not appended) on every review; the append-only audit lives in
    :class:`ConspectusReviewLog`.
    """

    __tablename__ = "conspectus_schedules"

    conspectus_uuid: Mapped[str] = mapped_column(
        ForeignKey("conspectuses.conspectus_uuid", ondelete="CASCADE"),
        primary_key=True,
    )
    owner_client_uuid: Mapped[str] = mapped_column(
        ForeignKey("users.client_uuid"),
        nullable=False,
        index=True,
    )
    slot: Mapped[str] = mapped_column(String(1), nullable=False, default="A")
    slot_d_ladder_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_review_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    schedule_revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    schedule_policy_id: Mapped[str] = mapped_column(
        ForeignKey("schedule_policies.schedule_policy_id"),
        nullable=False,
    )
    schedule_policy_version: Mapped[str] = mapped_column(String(32), nullable=False)
    algorithm_version: Mapped[str] = mapped_column(String(32), nullable=False)
    schedule_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utc_now,
    )
    is_row_invalid: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class ConspectusEvent(Base):
    """Immutable timeline entry for content-level state changes (create + content patch).

    Review events go into :class:`ConspectusReviewLog`; combining both gives the ordered
    audit stream exposed by ``GET /api/v1/conspectuses/{id}/history``.
    """

    __tablename__ = "conspectus_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conspectus_uuid: Mapped[str] = mapped_column(
        ForeignKey("conspectuses.conspectus_uuid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    owner_client_uuid: Mapped[str] = mapped_column(
        ForeignKey("users.client_uuid"),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    payload: Mapped[Any] = mapped_column(JSONB, nullable=True)
    content_version_after: Mapped[int] = mapped_column(Integer, nullable=True)
    actor_system_user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    actor_system_uuid: Mapped[str] = mapped_column(String(36), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utc_now,
    )


class ConspectusReviewLog(Base):
    """Immutable audit entry for a single review action.

    Stores the schedule before + after the transition so replays and history rendering
    have full context without loading the current :class:`ConspectusSchedule` state.
    """

    __tablename__ = "conspectus_review_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conspectus_uuid: Mapped[str] = mapped_column(
        ForeignKey("conspectuses.conspectus_uuid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    owner_client_uuid: Mapped[str] = mapped_column(
        ForeignKey("users.client_uuid"),
        nullable=False,
    )
    tag: Mapped[str] = mapped_column(String(16), nullable=False)
    slot_before: Mapped[str] = mapped_column(String(1), nullable=False)
    slot_after: Mapped[str] = mapped_column(String(1), nullable=False)
    slot_d_ladder_index_before: Mapped[int] = mapped_column(Integer, nullable=False)
    slot_d_ladder_index_after: Mapped[int] = mapped_column(Integer, nullable=False)
    schedule_revision_before: Mapped[int] = mapped_column(Integer, nullable=False)
    schedule_revision_after: Mapped[int] = mapped_column(Integer, nullable=False)
    next_review_at_before: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    next_review_at_after: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    algorithm_version: Mapped[str] = mapped_column(String(32), nullable=False)
    schedule_policy_id: Mapped[str] = mapped_column(String(64), nullable=False)
    schedule_policy_version: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_system_user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    actor_system_uuid: Mapped[str] = mapped_column(String(36), nullable=False)
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utc_now,
    )
