"""Core reference model: schedule policy (immutable, versioned)."""

from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SchedulePolicy(Base):
    """Reference row identifying a specific version of the review-schedule algorithm.

    Pinned into :class:`ConspectusSchedule` so retroactive policy edits do not silently
    change historical review outcomes. Transitions themselves live in Python
    (:mod:`app.domain.scheduling`); this table only stores the identity for audit.
    """

    __tablename__ = "schedule_policies"

    schedule_policy_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    algorithm_version: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
