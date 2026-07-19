"""HTTP handlers for the Schedule projection resource (`/api/v1/schedule`)."""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Security, status
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.openapi.examples.schedule import (
    SCHEDULE_PREVIEW_VALIDATION_ERROR_EXAMPLES,
    SCHEDULE_SUMMARY_VALIDATION_ERROR_EXAMPLES,
)
from app.openapi.responses import common_protected_route_responses
from app.repositories.me_repository import MeRepository
from app.repositories.schedule_repository import ScheduleRepository
from app.schemas.errors import ApiErrorResponse, ValidationErrorResponse
from app.schemas.me import ScheduleHistoryResponse
from app.schemas.schedule import (
    SchedulePreviewResponse,
    ScheduleSummaryResponse,
    WindowLiteral,
)
from app.services.me_service import MeService
from app.services.owner_resolver import resolve_owner_client_uuid
from app.services.schedule_service import SchedulePreviewInputs, ScheduleService

logger = logging.getLogger(__name__)
api_key_security = APIKeyHeader(name="X-API-Key", auto_error=False)

router = APIRouter(prefix="/schedule", tags=["Schedule"])

SCHEDULE_HTTP_BASE_PATH = "/api/v1/schedule"


@router.get(
    "/summary",
    response_model=ScheduleSummaryResponse,
    operation_id="getScheduleSummary",
    summary="Study-load summary counts",
    description=(
        "Aggregates the learner's schedule for the load-badge widget: counts per slot, "
        "items due now, items due in the next 24 hours, and total active."
    ),
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ApiErrorResponse,
            "description": "User not found for the composite key.",
        },
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "model": ValidationErrorResponse,
            "description": "Validation errors for the required query parameters.",
            "content": {
                "application/json": {
                    "examples": SCHEDULE_SUMMARY_VALIDATION_ERROR_EXAMPLES,
                }
            },
        },
        **common_protected_route_responses(),
    },
)
def get_schedule_summary(
    session: Annotated[Session, Depends(get_db_session)],
    system_user_id: Annotated[str, Query(min_length=1, max_length=36)],
    system_uuid: Annotated[UUID, Query()],
    api_key: Annotated[str | None, Security(api_key_security)] = None,
) -> ScheduleSummaryResponse:
    """Handle ``GET /api/v1/schedule/summary``.

    Args:
        session: DB session.
        system_user_id: External user id (query).
        system_uuid: Source system UUID (query).
        api_key: Declared for OpenAPI; auth is enforced by middleware.

    Returns:
        :class:`ScheduleSummaryResponse`.

    Raises:
        fastapi.HTTPException: 404 when the owner is not found.
    """
    _ = api_key
    owner_client_uuid = resolve_owner_client_uuid(
        session,
        system_user_id=system_user_id,
        system_uuid=system_uuid,
    )
    service = ScheduleService(ScheduleRepository(session))
    return service.summary(owner_client_uuid=owner_client_uuid)


@router.get(
    "/preview",
    response_model=SchedulePreviewResponse,
    operation_id="getSchedulePreview",
    summary="Evening-review lookahead batch",
    description=(
        "Returns a compact, deterministically-shuffled list of conspectuses whose next "
        "review falls within the requested window. `random_seed` + current clock minute "
        "make the order stable for one minute; a seed is generated when omitted."
    ),
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ApiErrorResponse,
            "description": "User not found for the composite key.",
        },
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "model": ValidationErrorResponse,
            "description": "Validation errors for query parameters (window, limit, random_seed).",
            "content": {
                "application/json": {
                    "examples": SCHEDULE_PREVIEW_VALIDATION_ERROR_EXAMPLES,
                }
            },
        },
        **common_protected_route_responses(),
    },
)
def get_schedule_preview(
    session: Annotated[Session, Depends(get_db_session)],
    system_user_id: Annotated[str, Query(min_length=1, max_length=36)],
    system_uuid: Annotated[UUID, Query()],
    window: Annotated[WindowLiteral, Query()] = "PT4H",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    random_seed: Annotated[
        str | None,
        Query(
            min_length=1,
            max_length=64,
            pattern=r"^[A-Za-z0-9_-]+$",
            description="Optional shuffle seed; server generates one when omitted.",
        ),
    ] = None,
    api_key: Annotated[str | None, Security(api_key_security)] = None,
) -> SchedulePreviewResponse:
    """Handle ``GET /api/v1/schedule/preview``.

    Args:
        session: DB session.
        system_user_id: External user id (query).
        system_uuid: Source system UUID (query).
        window: ISO 8601 duration window (enum).
        limit: Maximum items after shuffle.
        random_seed: Optional shuffle seed slug.
        api_key: Declared for OpenAPI; auth is enforced by middleware.

    Returns:
        :class:`SchedulePreviewResponse` with 0..``limit`` items.

    Raises:
        fastapi.HTTPException: 404 when the owner is not found.
    """
    _ = api_key
    owner_client_uuid = resolve_owner_client_uuid(
        session,
        system_user_id=system_user_id,
        system_uuid=system_uuid,
    )
    service = ScheduleService(ScheduleRepository(session))
    return service.preview(
        owner_client_uuid=owner_client_uuid,
        inputs=SchedulePreviewInputs(window=window, limit=limit, random_seed=random_seed),
    )


@router.get(
    "/history",
    response_model=ScheduleHistoryResponse,
    operation_id="getScheduleHistory",
    summary="Per-day review counts (Today heat-map data)",
    description=(
        "Returns one row per UTC calendar day for the last ``days`` days, filled "
        "with zeros for inactive days. Intensity 0..4 buckets the count for the "
        "Ember-tinted heat-map cells (0=none · 1 <3 · 2 <7 · 3 <12 · 4 ≥12).\n\n"
        "Equivalent raw SQL for one learner:\n\n"
        "```sql\n"
        "SELECT day::date AS day,\n"
        "       COALESCE(n, 0) AS count,\n"
        "       CASE\n"
        "         WHEN COALESCE(n, 0) = 0 THEN 0\n"
        "         WHEN n < 3  THEN 1\n"
        "         WHEN n < 7  THEN 2\n"
        "         WHEN n < 12 THEN 3\n"
        "         ELSE 4\n"
        "       END AS intensity\n"
        "FROM generate_series(CURRENT_DATE - (:days - 1), CURRENT_DATE, '1 day') AS day\n"
        "LEFT JOIN (\n"
        "  SELECT DATE(reviewed_at) AS day, COUNT(*) AS n\n"
        "  FROM conspectus_review_logs\n"
        "  WHERE owner_client_uuid = :owner\n"
        "  GROUP BY 1\n"
        ") logs USING (day)\n"
        "ORDER BY day;\n"
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
def get_schedule_history(
    session: Annotated[Session, Depends(get_db_session)],
    system_user_id: Annotated[str, Query(min_length=1, max_length=36)],
    system_uuid: Annotated[UUID, Query()],
    days: Annotated[int, Query(ge=1, le=365)] = 90,
    api_key: Annotated[str | None, Security(api_key_security)] = None,
) -> ScheduleHistoryResponse:
    """Handle ``GET /api/v1/schedule/history``."""
    _ = api_key
    owner_client_uuid = resolve_owner_client_uuid(
        session,
        system_user_id=system_user_id,
        system_uuid=system_uuid,
    )
    return MeService(MeRepository(session)).history(owner_client_uuid=owner_client_uuid, days=days)
