"""Response schemas for the `/api/v1/me/*` endpoints (Today screen hero data).

We import the `datetime` module (not `date` off it) so class fields can be
named `date` without shadowing the type — pydantic 2.12 evaluates
annotation strings in the class scope, and `date: date` triggers a
PydanticUserError on model construction. Qualifying the type as
`datetime.date` sidesteps the clash while keeping the JSON key readable.
"""

import datetime as _dt

from pydantic import BaseModel, Field


class StreakStats(BaseModel):
    """Current + longest streak of consecutive days with at least one review."""

    current_days: int = Field(..., ge=0, description="Consecutive days ending today or yesterday.")
    longest_days: int = Field(..., ge=0, description="Longest streak on record for this learner.")
    goal_days: int = Field(30, ge=1, description="Next milestone (30-day default).")


class MeStatsResponse(BaseModel):
    """Payload for ``GET /api/v1/me/stats`` — Today screen streak orb."""

    streak: StreakStats
    computed_at: _dt.datetime = Field(..., description="Server clock at read time (UTC).")


class Achievement(BaseModel):
    """One achievement with its unlock state and progress toward the target.

    Keys are a closed enum-like set the client maps to icon + copy:
    ``first_review`` · ``streak_7`` · ``streak_30`` · ``reviews_100`` ·
    ``notes_10`` · ``noticer_10`` · ``perfect_day`` · ``comeback`` ·
    ``early_bird`` · ``night_owl`` · ``mastery_50`` · ``reviews_500``.
    The set is additive-only; clients must ignore unknown keys.
    """

    key: str = Field(
        ..., description="Stable achievement identifier the client maps to icon + copy."
    )
    unlocked: bool = Field(..., description="True once progress reached the target.")
    progress: int = Field(..., ge=0, description="Current progress, clamped to `target`.")
    target: int = Field(..., ge=1, description="Threshold that unlocks the achievement.")


class MeAchievementsResponse(BaseModel):
    """Payload for ``GET /api/v1/me/achievements`` — Profile screen chips.

    Computed on read from review logs / conspectuses / miss log — no
    unlock timestamps are persisted, so the set is always consistent with
    the underlying data (a wiped dev account loses its badges too).
    """

    items: list[Achievement]
    computed_at: _dt.datetime = Field(..., description="Server clock at read time (UTC).")


class YesterdayDigest(BaseModel):
    """Recap of the previous day's review activity."""

    reviewed: int = Field(..., ge=0, description="Reviews that landed yesterday.")
    target: int = Field(
        ..., ge=0, description="Reviews scheduled for yesterday (reviewed + still-due)."
    )
    accuracy_pct: int = Field(
        ..., ge=0, le=100, description="Share of ``easy`` reviews vs. total, rounded to a %."
    )
    missed: int = Field(..., ge=0, description="Target minus reviewed, floored at 0.")


class MeYesterdayResponse(BaseModel):
    """Payload for ``GET /api/v1/me/yesterday``."""

    yesterday: YesterdayDigest
    date: _dt.date = Field(..., description="The UTC calendar day the digest covers.")
    computed_at: _dt.datetime


class HistoryDay(BaseModel):
    """One day's review count on the 90-day heat-map."""

    date: _dt.date = Field(..., description="UTC calendar day this bucket covers.")
    count: int = Field(..., ge=0)
    intensity: int = Field(..., ge=0, le=4, description="Bucketed density 0..4 for heat-map cells.")


class ScheduleHistoryResponse(BaseModel):
    """Payload for ``GET /api/v1/schedule/history``."""

    days: list[HistoryDay]
    computed_at: _dt.datetime
