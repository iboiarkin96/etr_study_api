"""HTTP handlers for the `/api/v1/me/*` resource (Today-hero aggregates)."""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Security, status
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.openapi.responses import common_protected_route_responses
from app.repositories.me_repository import MeRepository
from app.schemas.errors import ApiErrorResponse
from app.schemas.me import MeAchievementsResponse, MeStatsResponse, MeYesterdayResponse
from app.services.me_service import MeService
from app.services.owner_resolver import resolve_owner_client_uuid

logger = logging.getLogger(__name__)
api_key_security = APIKeyHeader(name="X-API-Key", auto_error=False)

router = APIRouter(prefix="/me", tags=["Me"])


@router.get(
    "/stats",
    response_model=MeStatsResponse,
    operation_id="getMeStats",
    summary="Current + longest streak (consecutive review days).",
    description=(
        "Reads `conspectus_review_logs` grouped by UTC calendar date. The current "
        "streak is alive today (or yesterday — 24 h grace) and counts back while "
        "every prior day carries ≥1 review. Longest streak is the largest such run "
        "on record. `goal_days` is a fixed 30-day milestone.\n\n"
        "Equivalent raw SQL for one learner:\n\n"
        "```sql\n"
        "-- Per-day review counts (base fact used by both current + longest):\n"
        "SELECT DATE(reviewed_at) AS day, COUNT(*) AS n\n"
        "FROM conspectus_review_logs\n"
        "WHERE owner_client_uuid = :owner\n"
        "GROUP BY 1\n"
        "ORDER BY 1;\n\n"
        "-- Current streak: walk backwards from today (or yesterday if today is 0).\n"
        "-- Longest streak: largest gap-free consecutive-days run in the above set.\n"
        "```"
    ),
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ApiErrorResponse,
            "description": "User not found for the composite key.",
        },
        **common_protected_route_responses(),
    },
)
def get_me_stats(
    session: Annotated[Session, Depends(get_db_session)],
    system_user_id: Annotated[str, Query(min_length=1, max_length=36)],
    system_uuid: Annotated[UUID, Query()],
    api_key: Annotated[str | None, Security(api_key_security)] = None,
) -> MeStatsResponse:
    """Handle ``GET /api/v1/me/stats``."""
    _ = api_key
    owner_client_uuid = resolve_owner_client_uuid(
        session,
        system_user_id=system_user_id,
        system_uuid=system_uuid,
    )
    return MeService(MeRepository(session)).stats(owner_client_uuid=owner_client_uuid)


@router.get(
    "/achievements",
    response_model=MeAchievementsResponse,
    operation_id="getMeAchievements",
    summary="Achievement set computed from the learner's own data.",
    description=(
        "Derives every achievement on read — no persisted unlock rows, so the "
        "badges can never disagree with the data behind them. Inputs: per-day "
        "review counts (streaks), all-time review count, active conspectus "
        "count, miss-log count.\n\n"
        "Keys (closed set the client maps to icon + copy):\n\n"
        "| key | target | progress source |\n"
        "|---|---|---|\n"
        "| `first_review` | 1 | total reviews |\n"
        "| `streak_7` | 7 | longest streak (days) |\n"
        "| `streak_30` | 30 | longest streak (days) |\n"
        "| `reviews_100` | 100 | total reviews |\n"
        "| `notes_10` | 10 | active conspectuses |\n"
        "| `noticer_10` | 10 | logged misses |\n"
        "| `perfect_day` | 1 | any day with ≥5 reviews and zero «forgot» |\n"
        "| `comeback` | 1 | an active day ≥7 days after the previous one |\n"
        "| `early_bird` | 1 | any review before 08:00 local (user timezone) |\n"
        "| `night_owl` | 1 | any review at/after 23:00 local (user timezone) |\n"
        "| `mastery_50` | 50 | reviews tagged `easy` |\n"
        "| `reviews_500` | 500 | total reviews |\n\n"
        "Streak achievements use the LONGEST streak — once earned, a badge "
        "does not un-earn itself when the current streak breaks. Binary "
        "badges report target 1 with progress 0/1. `progress` is clamped "
        "to `target`. Clients must ignore unknown keys (the set is "
        "additive-only)."
    ),
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ApiErrorResponse,
            "description": "User not found for the composite key.",
        },
        **common_protected_route_responses(),
    },
)
def get_me_achievements(
    session: Annotated[Session, Depends(get_db_session)],
    system_user_id: Annotated[str, Query(min_length=1, max_length=36)],
    system_uuid: Annotated[UUID, Query()],
    api_key: Annotated[str | None, Security(api_key_security)] = None,
) -> MeAchievementsResponse:
    """Handle ``GET /api/v1/me/achievements``."""
    _ = api_key
    owner_client_uuid = resolve_owner_client_uuid(
        session,
        system_user_id=system_user_id,
        system_uuid=system_uuid,
    )
    return MeService(MeRepository(session)).achievements(owner_client_uuid=owner_client_uuid)


@router.get(
    "/yesterday",
    response_model=MeYesterdayResponse,
    operation_id="getMeYesterday",
    summary="Recap of the previous UTC day (reviewed / target / accuracy).",
    description=(
        "Aggregates review activity for the previous UTC calendar day. "
        "`reviewed` = COUNT of review logs whose `reviewed_at` falls in "
        "yesterday's window. `target` = reviewed + still-due-from-yesterday "
        "(schedules whose `next_review_at` also fell into that window). "
        "`accuracy_pct` = share of `tag='easy'` reviews rounded to a percent.\n\n"
        "Equivalent raw SQL for one learner:\n\n"
        "```sql\n"
        "WITH y AS (\n"
        "  SELECT (CURRENT_DATE - INTERVAL '1 day')::date AS d\n"
        "),\n"
        "log_bounds AS (\n"
        "  SELECT d::timestamptz AS start_ts,\n"
        "         (d + INTERVAL '1 day')::timestamptz AS end_ts FROM y\n"
        ")\n"
        "SELECT\n"
        "  (SELECT COUNT(*) FROM conspectus_review_logs, log_bounds\n"
        "     WHERE owner_client_uuid = :owner\n"
        "       AND reviewed_at >= start_ts AND reviewed_at < end_ts) AS reviewed,\n"
        "  (SELECT COUNT(*) FILTER (WHERE tag = 'easy')\n"
        "     FROM conspectus_review_logs, log_bounds\n"
        "     WHERE owner_client_uuid = :owner\n"
        "       AND reviewed_at >= start_ts AND reviewed_at < end_ts) AS easy_cnt,\n"
        "  (SELECT COUNT(*) FROM conspectus_schedules, log_bounds\n"
        "     WHERE owner_client_uuid = :owner AND is_row_invalid = 0\n"
        "       AND next_review_at >= start_ts\n"
        "       AND next_review_at <  end_ts) AS still_due_yesterday;\n"
        "-- target = reviewed + still_due_yesterday\n"
        "-- accuracy_pct = ROUND(easy_cnt * 100 / NULLIF(reviewed, 0))\n"
        "-- missed = GREATEST(0, target - reviewed)\n"
        "```"
    ),
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ApiErrorResponse,
            "description": "User not found for the composite key.",
        },
        **common_protected_route_responses(),
    },
)
def get_me_yesterday(
    session: Annotated[Session, Depends(get_db_session)],
    system_user_id: Annotated[str, Query(min_length=1, max_length=36)],
    system_uuid: Annotated[UUID, Query()],
    api_key: Annotated[str | None, Security(api_key_security)] = None,
) -> MeYesterdayResponse:
    """Handle ``GET /api/v1/me/yesterday``."""
    _ = api_key
    owner_client_uuid = resolve_owner_client_uuid(
        session,
        system_user_id=system_user_id,
        system_uuid=system_uuid,
    )
    return MeService(MeRepository(session)).yesterday(owner_client_uuid=owner_client_uuid)
