"""HTTP handlers for the Error-log resource (`/api/v1/errors`)."""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Security, status
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.orm import Session

from app.api.v1._idempotency import IdempotencyGuard
from app.core.database import get_db_session
from app.errors.common import COMMON_400
from app.openapi.examples.error_logs import (
    ERROR_LOG_CREATE_REQUEST_EXAMPLES,
    ERROR_LOG_CREATE_VALIDATION_ERROR_EXAMPLES,
    ERROR_LOG_REFERENCE_NOT_FOUND_EXAMPLE,
)
from app.openapi.responses import (
    COMMON_BODY_TOO_LARGE_413_RESPONSE,
    COMMON_IDEMPOTENCY_CONFLICT_409_RESPONSE,
    build_common_business_400_response,
    common_protected_route_responses,
)
from app.repositories.learning_error_repository import LearningErrorRepository
from app.schemas.error_log import ErrorLogCreateRequest, ErrorLogResponse
from app.schemas.errors import ApiErrorResponse, ValidationErrorResponse
from app.services.error_log_service import ErrorLogService
from app.services.owner_resolver import resolve_owner_client_uuid

logger = logging.getLogger(__name__)
api_key_security = APIKeyHeader(name="X-API-Key", auto_error=False)

router = APIRouter(prefix="/errors", tags=["Error log"])

ERROR_LOG_HTTP_BASE_PATH = "/api/v1/errors"


@router.post(
    "",
    response_model=ErrorLogResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="createErrorLog",
    summary="Append a learner error record",
    description=(
        "Appends an immutable error entry for the learner. Requires `Idempotency-Key`. "
        "Optional `conspectus_uuid` / `review_log_id` must be owned by the same learner."
    ),
    responses={
        status.HTTP_400_BAD_REQUEST: build_common_business_400_response(),
        status.HTTP_404_NOT_FOUND: {
            "model": ApiErrorResponse,
            "description": "User or referenced conspectus / review log not found.",
            "content": {
                "application/json": {
                    "examples": {
                        "reference_not_found": {
                            "summary": "Linked conspectus / review_log is not owned by this user",
                            "value": ERROR_LOG_REFERENCE_NOT_FOUND_EXAMPLE,
                        }
                    }
                }
            },
        },
        status.HTTP_409_CONFLICT: COMMON_IDEMPOTENCY_CONFLICT_409_RESPONSE,
        status.HTTP_413_CONTENT_TOO_LARGE: COMMON_BODY_TOO_LARGE_413_RESPONSE,
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "model": ValidationErrorResponse,
            "description": "Request validation errors for the create-error-log body.",
            "content": {
                "application/json": {
                    "examples": ERROR_LOG_CREATE_VALIDATION_ERROR_EXAMPLES,
                }
            },
        },
        **common_protected_route_responses(),
    },
)
def create_error_log(
    payload: Annotated[
        ErrorLogCreateRequest,
        Body(openapi_examples=ERROR_LOG_CREATE_REQUEST_EXAMPLES),
    ],
    session: Annotated[Session, Depends(get_db_session)],
    idempotency_key: Annotated[
        str,
        Header(
            alias="Idempotency-Key",
            min_length=1,
            max_length=128,
            pattern=r"^[ -~]+$",
            description="Required idempotency key (printable ASCII only).",
        ),
    ],
    api_key: Annotated[str | None, Security(api_key_security)] = None,
) -> ErrorLogResponse:
    """Handle ``POST /api/v1/errors`` with idempotent replay semantics.

    Args:
        payload: Validated request body.
        session: Request-scoped DB session.
        idempotency_key: Dedup token; required per :data:`COMMON_400`.
        api_key: Declared for OpenAPI; auth is enforced by middleware.

    Returns:
        Persisted or replayed :class:`ErrorLogResponse`.

    Raises:
        fastapi.HTTPException: 400 if header missing, 409 on payload mismatch,
            404 when the owner or referenced FK is not found.
    """
    _ = api_key
    if not idempotency_key:
        raise HTTPException(status_code=400, detail=COMMON_400.as_detail("business"))

    guard = IdempotencyGuard(
        session=session,
        endpoint_path=f"POST {ERROR_LOG_HTTP_BASE_PATH}",
        idempotency_key=idempotency_key,
        payload=payload.model_dump(mode="json"),
    )
    replayed = guard.replay_or_none(ErrorLogResponse)
    if replayed is not None:
        logger.info("error_log_create_idempotent_replay key=%s", idempotency_key)
        return replayed

    owner_client_uuid = resolve_owner_client_uuid(
        session,
        system_user_id=payload.system_user_id,
        system_uuid=payload.system_uuid,
    )
    entity = ErrorLogService(LearningErrorRepository(session)).create(
        payload=payload, owner_client_uuid=owner_client_uuid
    )
    response_model = ErrorLogResponse.model_validate(entity)
    guard.save(status_code=status.HTTP_201_CREATED, response=response_model)
    return response_model


@router.get(
    "",
    response_model=list[ErrorLogResponse],
    operation_id="listErrorLogs",
    summary="List learner error records",
    description=(
        "Returns the learner's own error rows, newest first, capped at 100. "
        "Cross-tenant references return an empty list (no leak)."
    ),
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ApiErrorResponse,
            "description": "User not found for the composite key.",
        },
        **common_protected_route_responses(),
    },
)
def list_error_logs(
    session: Annotated[Session, Depends(get_db_session)],
    system_user_id: Annotated[
        str,
        Query(min_length=1, max_length=36, description="External user id."),
    ],
    system_uuid: Annotated[
        UUID,
        Query(description="Source system UUID (`systems.system_uuid`)."),
    ],
    conspectus_uuid: Annotated[
        UUID | None,
        Query(description="Optional filter: only errors linked to this conspectus."),
    ] = None,
    api_key: Annotated[str | None, Security(api_key_security)] = None,
) -> list[ErrorLogResponse]:
    """Handle ``GET /api/v1/errors`` with optional conspectus filter.

    Args:
        session: DB session.
        system_user_id: External user id (query).
        system_uuid: Source system UUID (query).
        conspectus_uuid: Optional filter.
        api_key: Declared for OpenAPI; auth is enforced by middleware.

    Returns:
        Newest-first list of error rows, up to 100 items.

    Raises:
        fastapi.HTTPException: 404 when the owner is not found.
    """
    _ = api_key
    owner_client_uuid = resolve_owner_client_uuid(
        session,
        system_user_id=system_user_id,
        system_uuid=system_uuid,
    )
    service = ErrorLogService(LearningErrorRepository(session))
    entities = service.list_all(
        owner_client_uuid=owner_client_uuid,
        conspectus_uuid=str(conspectus_uuid) if conspectus_uuid is not None else None,
    )
    return [ErrorLogResponse.model_validate(entity) for entity in entities]
