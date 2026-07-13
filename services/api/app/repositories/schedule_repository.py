"""Read-only data access for the Schedule projection endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import NamedTuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.core.conspectus import Conspectus, ConspectusSchedule


class SchedulePreviewRow(NamedTuple):
    """Materialised row for the preview endpoint (compact by design)."""

    conspectus_uuid: str
    title: str | None
    slot: str
    next_review_at: datetime


class ScheduleRepository:
    """Read-only queries against ``conspectus_schedules``."""

    def __init__(self, session: Session) -> None:
        """Bind to a SQLAlchemy session.

        Args:
            session: Active DB session owned by the caller.
        """
        self.session = session

    def counts_by_slot(self, owner_client_uuid: str) -> dict[str, int]:
        """Return ``{slot: count}`` for the owner's active schedules.

        Missing slots are filled with zero at the caller layer so the response contract
        stays fixed (all four keys present).

        Args:
            owner_client_uuid: Resolved owner scope.

        Returns:
            Sparse mapping of slot letter to non-zero count.
        """
        stmt = (
            select(ConspectusSchedule.slot, func.count())
            .where(
                ConspectusSchedule.owner_client_uuid == owner_client_uuid,
                ConspectusSchedule.is_row_invalid == 0,
            )
            .group_by(ConspectusSchedule.slot)
        )
        return {row[0]: int(row[1]) for row in self.session.execute(stmt).all()}

    def count_in_window(
        self,
        owner_client_uuid: str,
        *,
        start: datetime | None,
        end: datetime | None,
    ) -> int:
        """Count active schedules whose ``next_review_at`` falls in ``(start, end]``.

        ``start`` is exclusive, ``end`` inclusive — matches "already due" (``end=now``,
        ``start=None``) and "due in the next 24h" (``start=now``, ``end=now+24h``).

        Args:
            owner_client_uuid: Owner scope.
            start: Exclusive lower bound (``None`` = no lower bound).
            end: Inclusive upper bound (``None`` = no upper bound).

        Returns:
            Matching row count.
        """
        stmt = (
            select(func.count())
            .select_from(ConspectusSchedule)
            .where(
                ConspectusSchedule.owner_client_uuid == owner_client_uuid,
                ConspectusSchedule.is_row_invalid == 0,
            )
        )
        if start is not None:
            stmt = stmt.where(ConspectusSchedule.next_review_at > start)
        if end is not None:
            stmt = stmt.where(ConspectusSchedule.next_review_at <= end)
        return int(self.session.execute(stmt).scalar_one())

    def preview_candidates(
        self,
        owner_client_uuid: str,
        *,
        until: datetime,
    ) -> list[SchedulePreviewRow]:
        """Return all schedules due at or before ``until``, ordered for deterministic shuffle.

        Args:
            owner_client_uuid: Owner scope.
            until: Upper bound for ``next_review_at`` (inclusive).

        Returns:
            Sorted list of :class:`SchedulePreviewRow`; stable order by conspectus_uuid.
        """
        stmt = (
            select(
                ConspectusSchedule.conspectus_uuid,
                Conspectus.title,
                ConspectusSchedule.slot,
                ConspectusSchedule.next_review_at,
            )
            .join(
                Conspectus,
                Conspectus.conspectus_uuid == ConspectusSchedule.conspectus_uuid,
            )
            .where(
                ConspectusSchedule.owner_client_uuid == owner_client_uuid,
                ConspectusSchedule.is_row_invalid == 0,
                ConspectusSchedule.next_review_at <= until,
            )
            .order_by(ConspectusSchedule.conspectus_uuid.asc())
        )
        return [
            SchedulePreviewRow(
                conspectus_uuid=row[0],
                title=row[1],
                slot=row[2],
                next_review_at=row[3],
            )
            for row in self.session.execute(stmt).all()
        ]
