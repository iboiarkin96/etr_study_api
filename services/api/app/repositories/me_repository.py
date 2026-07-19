"""Data access for the `/api/v1/me/*` and `/schedule/history` endpoints.

All three read only from `conspectus_review_logs` (owner-scoped) plus
`conspectus_schedules` for yesterday's target computation. No aggregate
tables — the traffic profile is one call per Today open, and the
review-log volume per learner is on the order of hundreds per year, so
a full owner-scoped scan is cheap.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import Date, and_, cast, func, select
from sqlalchemy.orm import Session

from app.models.core.conspectus import ConspectusReviewLog, ConspectusSchedule


@dataclass(frozen=True, slots=True)
class YesterdayCounts:
    """Aggregates for the previous UTC day."""

    reviewed: int
    easy_count: int
    still_due_from_yesterday: int


class MeRepository:
    """Read-only aggregates over the review log for one learner."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def reviews_per_day(
        self, *, owner_client_uuid: str, since: date, until: date
    ) -> dict[date, int]:
        """Return `{utc_date: review_count}` for every day with at least one review.

        Args:
            owner_client_uuid: Owner scope.
            since: First calendar day to include (UTC, inclusive).
            until: Last calendar day to include (UTC, inclusive).
        """
        day = cast(ConspectusReviewLog.reviewed_at, Date).label("day")
        stmt = (
            select(day, func.count().label("n"))
            .where(
                and_(
                    ConspectusReviewLog.owner_client_uuid == owner_client_uuid,
                    ConspectusReviewLog.reviewed_at >= _midnight(since),
                    ConspectusReviewLog.reviewed_at < _midnight(until + timedelta(days=1)),
                )
            )
            .group_by(day)
        )
        return {row.day: row.n for row in self.session.execute(stmt)}

    def yesterday_counts(self, *, owner_client_uuid: str, yesterday: date) -> YesterdayCounts:
        """Aggregate reviewed / easy / still-due counts for the previous UTC day."""
        start = _midnight(yesterday)
        end = _midnight(yesterday + timedelta(days=1))

        reviewed_stmt = select(func.count()).where(
            and_(
                ConspectusReviewLog.owner_client_uuid == owner_client_uuid,
                ConspectusReviewLog.reviewed_at >= start,
                ConspectusReviewLog.reviewed_at < end,
            )
        )
        easy_stmt = reviewed_stmt.where(ConspectusReviewLog.tag == "easy")

        reviewed = self.session.execute(reviewed_stmt).scalar_one() or 0
        easy = self.session.execute(easy_stmt).scalar_one() or 0

        # «Still due from yesterday» = active schedules whose `next_review_at`
        # already fell within yesterday's window AND whose latest review (if
        # any) happened before that window. This proxies «items that were
        # supposed to be done and weren't yet».
        still_due_stmt = select(func.count()).where(
            and_(
                ConspectusSchedule.owner_client_uuid == owner_client_uuid,
                ConspectusSchedule.is_row_invalid == 0,
                ConspectusSchedule.next_review_at < end,
                ConspectusSchedule.next_review_at >= start,
            )
        )
        still_due = self.session.execute(still_due_stmt).scalar_one() or 0

        return YesterdayCounts(
            reviewed=int(reviewed),
            easy_count=int(easy),
            still_due_from_yesterday=int(still_due),
        )


def _midnight(day: date) -> datetime:
    """Return the UTC midnight (00:00:00Z) for a calendar day."""
    return datetime(day.year, day.month, day.day, tzinfo=UTC)
