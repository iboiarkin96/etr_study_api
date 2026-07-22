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

from app.models.core.conspectus import Conspectus, ConspectusReviewLog, ConspectusSchedule
from app.models.core.learning_error import LearningError
from app.models.core.user import User


@dataclass(frozen=True, slots=True)
class YesterdayCounts:
    """Aggregates for the previous UTC day."""

    reviewed: int
    easy_count: int
    still_due_from_yesterday: int


@dataclass(frozen=True, slots=True)
class OwnerTotals:
    """All-time counters for one learner (achievements input)."""

    reviews: int
    conspectuses: int
    misses: int
    easy_reviews: int


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

    def owner_totals(self, *, owner_client_uuid: str) -> OwnerTotals:
        """All-time counts feeding the achievements projection.

        Three owner-scoped COUNTs; volumes are hundreds-per-learner, so no
        aggregate tables (same reasoning as `reviews_per_day`).
        """
        reviews = (
            self.session.execute(
                select(func.count()).where(
                    ConspectusReviewLog.owner_client_uuid == owner_client_uuid
                )
            ).scalar_one()
            or 0
        )
        conspectuses = (
            self.session.execute(
                select(func.count()).where(
                    and_(
                        Conspectus.owner_client_uuid == owner_client_uuid,
                        Conspectus.is_row_invalid == 0,
                    )
                )
            ).scalar_one()
            or 0
        )
        misses = (
            self.session.execute(
                select(func.count()).where(LearningError.owner_client_uuid == owner_client_uuid)
            ).scalar_one()
            or 0
        )
        easy = (
            self.session.execute(
                select(func.count()).where(
                    and_(
                        ConspectusReviewLog.owner_client_uuid == owner_client_uuid,
                        ConspectusReviewLog.tag == "easy",
                    )
                )
            ).scalar_one()
            or 0
        )
        return OwnerTotals(
            reviews=int(reviews),
            conspectuses=int(conspectuses),
            misses=int(misses),
            easy_reviews=int(easy),
        )

    def forgot_per_day(
        self, *, owner_client_uuid: str, since: date, until: date
    ) -> dict[date, int]:
        """Return `{utc_date: forgot_count}` for days with at least one «forgot» review.

        Same shape and window semantics as `reviews_per_day` — the two dicts
        are meant to be zipped by the caller (perfect-day achievement).
        """
        day = cast(ConspectusReviewLog.reviewed_at, Date).label("day")
        stmt = (
            select(day, func.count().label("n"))
            .where(
                and_(
                    ConspectusReviewLog.owner_client_uuid == owner_client_uuid,
                    ConspectusReviewLog.tag == "forgot",
                    ConspectusReviewLog.reviewed_at >= _midnight(since),
                    ConspectusReviewLog.reviewed_at < _midnight(until + timedelta(days=1)),
                )
            )
            .group_by(day)
        )
        return {row.day: row.n for row in self.session.execute(stmt)}

    def has_review_in_local_hour_range(
        self, *, owner_client_uuid: str, tz: str, hour_from: int, hour_to: int
    ) -> bool:
        """True when any review's LOCAL wall-clock hour falls in [hour_from, hour_to).

        `tz` is the user's IANA timezone (FK-validated against the
        ``timezones`` reference table, so passing it as a bind parameter to
        ``AT TIME ZONE`` is safe). ``reviewed_at`` is timestamptz; the double
        conversion yields the learner's local wall clock.
        """
        local_hour = func.extract(
            "hour",
            func.timezone(tz, ConspectusReviewLog.reviewed_at),
        )
        stmt = select(
            select(ConspectusReviewLog.id)
            .where(
                and_(
                    ConspectusReviewLog.owner_client_uuid == owner_client_uuid,
                    local_hour >= hour_from,
                    local_hour < hour_to,
                )
            )
            .exists()
        )
        return bool(self.session.execute(stmt).scalar_one())

    def owner_timezone(self, *, owner_client_uuid: str) -> str:
        """Return the learner's IANA timezone (``users.timezone``), defaulting to UTC."""
        tz = self.session.execute(
            select(User.timezone).where(User.client_uuid == owner_client_uuid)
        ).scalar_one_or_none()
        return tz or "UTC"


def _midnight(day: date) -> datetime:
    """Return the UTC midnight (00:00:00Z) for a calendar day."""
    return datetime(day.year, day.month, day.day, tzinfo=UTC)
