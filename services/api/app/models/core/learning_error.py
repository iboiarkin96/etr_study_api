"""Core business model: learner-authored error log entry (append-only)."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _utc_now() -> datetime:
    """Return current UTC time with tzinfo for timestamp columns.

    Returns:
        Timezone-aware ``datetime`` in UTC.
    """
    return datetime.now(UTC)


class LearningError(Base):
    """Free-text mistake the learner captured while reviewing.

    Append-only in v1. Optional FKs to a conspectus and a review log let the client link
    a specific miss to a specific note or review event; a deleted conspectus sets
    ``conspectus_uuid`` to NULL (cascade) so the error line stays visible.
    """

    __tablename__ = "learning_errors"

    error_uuid: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    owner_client_uuid: Mapped[str] = mapped_column(
        ForeignKey("users.client_uuid"),
        nullable=False,
        index=True,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    conspectus_uuid: Mapped[str] = mapped_column(
        ForeignKey("conspectuses.conspectus_uuid", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    review_log_id: Mapped[int] = mapped_column(
        ForeignKey("conspectus_review_logs.id"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utc_now,
    )
