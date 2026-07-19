"""Business logic for the Today-screen hero data endpoints.

Three read-only aggregates over `conspectus_review_logs`:

* streak      — consecutive-days count.
* yesterday   — recap of the previous UTC day.
* history 90d — per-day counts for the heat-map, bucketed 0..4.
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime, timedelta

from app.repositories.me_repository import MeRepository
from app.schemas.me import (
    HistoryDay,
    MeStatsResponse,
    MeYesterdayResponse,
    ScheduleHistoryResponse,
    StreakStats,
    YesterdayDigest,
)

logger = logging.getLogger(__name__)

DEFAULT_STREAK_GOAL_DAYS = 30
_MIN_HISTORY_DAYS = 1
_MAX_HISTORY_DAYS = 365


class MeService:
    """Read-only projections for the Today hero blocks."""

    def __init__(self, repository: MeRepository) -> None:
        self.repository = repository

    # ---------- streak ----------

    def stats(self, *, owner_client_uuid: str) -> MeStatsResponse:
        """Compute the current + longest streak of consecutive review days.

        The streak «is alive» today if today has ≥1 review OR yesterday does
        (24-hour grace so opening the app before a review doesn't visually
        break the streak).
        """
        today = _today_utc()
        # Look back a year — the longest reasonable streak we'd surface.
        since = today - timedelta(days=365)
        per_day = self.repository.reviews_per_day(
            owner_client_uuid=owner_client_uuid,
            since=since,
            until=today,
        )
        current = _current_streak(per_day, today)
        longest = _longest_streak(per_day)
        return MeStatsResponse(
            streak=StreakStats(
                current_days=current,
                longest_days=max(longest, current),
                goal_days=DEFAULT_STREAK_GOAL_DAYS,
            ),
            computed_at=datetime.now(UTC),
        )

    # ---------- yesterday ----------

    def yesterday(self, *, owner_client_uuid: str) -> MeYesterdayResponse:
        """Recap the previous UTC day's review activity."""
        yesterday = _today_utc() - timedelta(days=1)
        counts = self.repository.yesterday_counts(
            owner_client_uuid=owner_client_uuid,
            yesterday=yesterday,
        )
        target = counts.reviewed + counts.still_due_from_yesterday
        missed = max(0, target - counts.reviewed)
        accuracy = round(counts.easy_count * 100 / counts.reviewed) if counts.reviewed > 0 else 0
        return MeYesterdayResponse(
            yesterday=YesterdayDigest(
                reviewed=counts.reviewed,
                target=target,
                accuracy_pct=accuracy,
                missed=missed,
            ),
            date=yesterday,
            computed_at=datetime.now(UTC),
        )

    # ---------- history ----------

    def history(self, *, owner_client_uuid: str, days: int) -> ScheduleHistoryResponse:
        """Return per-day review counts for the last ``days`` UTC days.

        Empty days materialise as ``count=0`` so the heat-map consumer doesn't
        have to fill gaps. Intensity bucket 0..4 encodes ranges the UI colours
        with the Ember tint recipe (0 = grey, 4 = full accent).
        """
        if not _MIN_HISTORY_DAYS <= days <= _MAX_HISTORY_DAYS:
            raise ValueError(f"days must be between {_MIN_HISTORY_DAYS} and {_MAX_HISTORY_DAYS}")
        today = _today_utc()
        since = today - timedelta(days=days - 1)
        per_day = self.repository.reviews_per_day(
            owner_client_uuid=owner_client_uuid,
            since=since,
            until=today,
        )
        materialised = [
            HistoryDay(
                date=since + timedelta(days=i),
                count=per_day.get(since + timedelta(days=i), 0),
                intensity=_bucket_intensity(per_day.get(since + timedelta(days=i), 0)),
            )
            for i in range(days)
        ]
        return ScheduleHistoryResponse(days=materialised, computed_at=datetime.now(UTC))


def _today_utc() -> date:
    return datetime.now(UTC).date()


def _current_streak(per_day: dict[date, int], today: date) -> int:
    """Walk backward from today counting consecutive days with ≥1 review.

    24-hour grace: if today has zero but yesterday has ≥1, keep counting.
    """
    day = today if per_day.get(today, 0) > 0 else today - timedelta(days=1)
    if per_day.get(day, 0) == 0:
        return 0
    n = 0
    while per_day.get(day, 0) > 0:
        n += 1
        day -= timedelta(days=1)
    return n


def _longest_streak(per_day: dict[date, int]) -> int:
    """Sweep the sorted day set once, tracking max consecutive run."""
    if not per_day:
        return 0
    active_days = sorted(d for d, c in per_day.items() if c > 0)
    if not active_days:
        return 0
    longest = current = 1
    for i in range(1, len(active_days)):
        if active_days[i] - active_days[i - 1] == timedelta(days=1):
            current += 1
            longest = max(longest, current)
        else:
            current = 1
    return longest


def _bucket_intensity(count: int) -> int:
    """Map a per-day review count into the heat-map intensity bucket (0..4)."""
    if count == 0:
        return 0
    if count < 3:
        return 1
    if count < 7:
        return 2
    if count < 12:
        return 3
    return 4
