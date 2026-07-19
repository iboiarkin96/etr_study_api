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
from app.schemas.me import MeStatsResponse, MeYesterdayResponse
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
    "/yesterday",
    response_model=MeYesterdayResponse,
    operation_id="getMeYesterday",
    summary="Recap of the previous UTC day (reviewed / target / accuracy).",
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
