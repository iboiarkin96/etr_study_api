"""HTTP handlers for the Conspectus resource (`/api/v1/conspectuses`)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Path, Query, Security, status
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.orm import Session

from app.api.v1._cursor import (
    decode_history_cursor,
    decode_list_cursor,
    encode_history_cursor,
    encode_list_cursor,
)
from app.api.v1._idempotency import IdempotencyGuard
from app.core.database import get_db_session
from app.errors.common import COMMON_000, COMMON_400
from app.openapi.examples.conspectuses import (
    CONSPECTUS_CREATE_REQUEST_EXAMPLES,
    CONSPECTUS_CREATE_VALIDATION_ERROR_EXAMPLES,
    CONSPECTUS_DELETE_REQUEST_EXAMPLES,
    CONSPECTUS_DELETE_VALIDATION_ERROR_EXAMPLES,
    CONSPECTUS_NOT_FOUND_ERROR_EXAMPLE,
    CONSPECTUS_PATCH_BODY_EMPTY_EXAMPLE,
    CONSPECTUS_PATCH_REQUEST_EXAMPLES,
    CONSPECTUS_PATCH_VALIDATION_ERROR_EXAMPLES,
    CONSPECTUS_REVIEW_REQUEST_EXAMPLES,
    CONSPECTUS_REVIEW_REVISION_CONFLICT_EXAMPLE,
    CONSPECTUS_REVIEW_VALIDATION_ERROR_EXAMPLES,
)
from app.openapi.responses import (
    COMMON_BODY_TOO_LARGE_413_RESPONSE,
    COMMON_IDEMPOTENCY_CONFLICT_409_RESPONSE,
    build_common_business_400_response,
    common_protected_route_responses,
)
from app.repositories.conspectus_repository import (
    ConspectusRepository,
    ConspectusView,
    HistoryRow,
)
from app.schemas.conspectus import (
    ConspectusCreateRequest,
    ConspectusDeleteRequest,
    ConspectusHistoryActor,
    ConspectusHistoryContentPatchPayload,
    ConspectusHistoryEvent,
    ConspectusHistoryResponse,
    ConspectusHistoryReviewPayload,
    ConspectusListResponse,
    ConspectusPatchRequest,
    ConspectusResponse,
    ConspectusReviewRequest,
)
from app.schemas.errors import ApiErrorResponse, ValidationErrorResponse
from app.services.conspectus_service import ConspectusService
from app.services.owner_resolver import resolve_owner_client_uuid

logger = logging.getLogger(__name__)
api_key_security = APIKeyHeader(name="X-API-Key", auto_error=False)

router = APIRouter(prefix="/conspectuses", tags=["Conspectus"])

CONSPECTUS_HTTP_BASE_PATH = "/api/v1/conspectuses"


def _view_to_response(view: ConspectusView) -> ConspectusResponse:
    """Build the flat response DTO from the repository view (attribute-mapped)."""
    return ConspectusResponse.model_validate(view)


def _idempotency_endpoint(method: str, suffix: str) -> str:
    """Namespace idempotency keys by ``METHOD /path``."""
    return f"{method} {CONSPECTUS_HTTP_BASE_PATH}{suffix}"


# ---------------------------------------------------------------------------
# POST /conspectuses (create)
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=ConspectusResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="createConspectus",
    summary="Create a conspectus",
    responses={
        status.HTTP_400_BAD_REQUEST: build_common_business_400_response(),
        status.HTTP_404_NOT_FOUND: {
            "model": ApiErrorResponse,
            "description": "User not found for the composite key.",
        },
        status.HTTP_409_CONFLICT: COMMON_IDEMPOTENCY_CONFLICT_409_RESPONSE,
        status.HTTP_413_CONTENT_TOO_LARGE: COMMON_BODY_TOO_LARGE_413_RESPONSE,
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "model": ValidationErrorResponse,
            "description": "Request validation errors for the create-conspectus body.",
            "content": {
                "application/json": {
                    "examples": CONSPECTUS_CREATE_VALIDATION_ERROR_EXAMPLES,
                }
            },
        },
        **common_protected_route_responses(),
    },
)
def create_conspectus(
    payload: Annotated[
        ConspectusCreateRequest,
        Body(openapi_examples=CONSPECTUS_CREATE_REQUEST_EXAMPLES),
    ],
    session: Annotated[Session, Depends(get_db_session)],
    idempotency_key: Annotated[
        str,
        Header(
            alias="Idempotency-Key",
            min_length=1,
            max_length=128,
            pattern=r"^[ -~]+$",
        ),
    ],
    api_key: Annotated[str | None, Security(api_key_security)] = None,
) -> ConspectusResponse:
    """POST /conspectuses with idempotent replay and initial schedule row."""
    _ = api_key
    if not idempotency_key:
        raise HTTPException(status_code=400, detail=COMMON_400.as_detail("business"))

    guard = IdempotencyGuard(
        session=session,
        endpoint_path=_idempotency_endpoint("POST", ""),
        idempotency_key=idempotency_key,
        payload=payload.model_dump(mode="json"),
    )
    replayed = guard.replay_or_none(ConspectusResponse)
    if replayed is not None:
        logger.info("conspectus_create_idempotent_replay key=%s", idempotency_key)
        return replayed

    owner_client_uuid = resolve_owner_client_uuid(
        session,
        system_user_id=payload.system_user_id,
        system_uuid=payload.system_uuid,
    )
    view = ConspectusService(ConspectusRepository(session)).create(
        payload=payload, owner_client_uuid=owner_client_uuid
    )
    response = _view_to_response(view)
    guard.save(status_code=status.HTTP_201_CREATED, response=response)
    return response


# ---------------------------------------------------------------------------
# GET /conspectuses (list)
# ---------------------------------------------------------------------------


@router.get(
    "",
    response_model=ConspectusListResponse,
    operation_id="listConspectuses",
    summary="List conspectuses (newest first, cursor-paginated)",
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ApiErrorResponse,
            "description": "User not found for the composite key.",
        },
        **common_protected_route_responses(),
    },
)
def list_conspectuses(
    session: Annotated[Session, Depends(get_db_session)],
    system_user_id: Annotated[str, Query(min_length=1, max_length=36)],
    system_uuid: Annotated[UUID, Query()],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    cursor: Annotated[str | None, Query()] = None,
    slot: Annotated[Literal["A", "B", "C", "D"] | None, Query()] = None,
    created_after: Annotated[datetime | None, Query()] = None,
    created_before: Annotated[datetime | None, Query()] = None,
    include_invalid: Annotated[bool, Query()] = False,
    api_key: Annotated[str | None, Security(api_key_security)] = None,
) -> ConspectusListResponse:
    """GET /conspectuses with keyset cursor pagination."""
    _ = api_key
    owner_client_uuid = resolve_owner_client_uuid(
        session,
        system_user_id=system_user_id,
        system_uuid=system_uuid,
    )
    if created_after is not None and created_before is not None and created_after >= created_before:
        raise HTTPException(
            status_code=422,
            detail=COMMON_000.as_detail(
                "validation",
                message="`created_after` must be strictly earlier than `created_before`.",
            ),
        )

    parsed_cursor = decode_list_cursor(cursor) if cursor is not None else None
    service = ConspectusService(ConspectusRepository(session))
    page, has_more, next_cursor = service.list_page(
        owner_client_uuid=owner_client_uuid,
        limit=limit,
        cursor=parsed_cursor,
        slot=slot,
        created_after=created_after,
        created_before=created_before,
        include_invalid=include_invalid,
    )
    return ConspectusListResponse(
        items=[_view_to_response(view) for view in page],
        next_cursor=encode_list_cursor(next_cursor[0], next_cursor[1]) if next_cursor else None,
        count=len(page),
        has_more=has_more,
    )


# ---------------------------------------------------------------------------
# GET /conspectuses/due (top-100)
# ---------------------------------------------------------------------------


@router.get(
    "/due",
    response_model=list[ConspectusResponse],
    operation_id="listDueConspectuses",
    summary="List conspectuses due for review (bounded top-100)",
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ApiErrorResponse,
            "description": "User not found for the composite key.",
        },
        **common_protected_route_responses(),
    },
)
def list_due_conspectuses(
    session: Annotated[Session, Depends(get_db_session)],
    system_user_id: Annotated[str, Query(min_length=1, max_length=36)],
    system_uuid: Annotated[UUID, Query()],
    due_before: Annotated[datetime | None, Query()] = None,
    slot: Annotated[Literal["A", "B", "C", "D"] | None, Query()] = None,
    api_key: Annotated[str | None, Security(api_key_security)] = None,
) -> list[ConspectusResponse]:
    """GET /conspectuses/due (top-100, sorted by next_review_at ASC)."""
    _ = api_key
    owner_client_uuid = resolve_owner_client_uuid(
        session,
        system_user_id=system_user_id,
        system_uuid=system_uuid,
    )
    threshold = due_before if due_before is not None else datetime.now(UTC)
    service = ConspectusService(ConspectusRepository(session))
    views = service.list_due(
        owner_client_uuid=owner_client_uuid,
        due_before=threshold,
        slot=slot,
    )
    return [_view_to_response(view) for view in views]


# ---------------------------------------------------------------------------
# GET /conspectuses/{id}/history
# ---------------------------------------------------------------------------


@router.get(
    "/{conspectus_uuid}/history",
    response_model=ConspectusHistoryResponse,
    operation_id="getConspectusHistory",
    summary="Get an ordered audit trail for a conspectus",
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ApiErrorResponse,
            "description": "User or conspectus not found (both collapse to 404).",
        },
        **common_protected_route_responses(),
    },
)
def get_conspectus_history(
    conspectus_uuid: Annotated[UUID, Path()],
    session: Annotated[Session, Depends(get_db_session)],
    system_user_id: Annotated[str, Query(min_length=1, max_length=36)],
    system_uuid: Annotated[UUID, Query()],
    event_type: Annotated[Literal["review", "content_patch", "all"], Query()] = "all",
    since: Annotated[datetime | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    cursor: Annotated[str | None, Query()] = None,
    api_key: Annotated[str | None, Security(api_key_security)] = None,
) -> ConspectusHistoryResponse:
    """GET /conspectuses/{id}/history — merged review + content events, oldest first."""
    _ = api_key
    owner_client_uuid = resolve_owner_client_uuid(
        session,
        system_user_id=system_user_id,
        system_uuid=system_uuid,
    )
    parsed_cursor = decode_history_cursor(cursor) if cursor is not None else None
    filter_type: Literal["review", "content_patch"] | None
    filter_type = None if event_type == "all" else event_type

    service = ConspectusService(ConspectusRepository(session))
    conspectus_uuid_str = str(conspectus_uuid)
    rows, has_more, next_cursor = service.history(
        conspectus_uuid=conspectus_uuid_str,
        owner_client_uuid=owner_client_uuid,
        event_type=filter_type,
        since=since,
        limit=limit,
        cursor=parsed_cursor,
    )

    items = [_history_row_to_response(row, system_user_id, str(system_uuid)) for row in rows]
    return ConspectusHistoryResponse(
        conspectus_uuid=conspectus_uuid_str,
        items=items,
        next_cursor=encode_history_cursor(next_cursor[0], next_cursor[1]) if next_cursor else None,
        count=len(items),
        has_more=has_more,
    )


def _history_row_to_response(
    row: HistoryRow,
    requesting_system_user_id: str,
    requesting_system_uuid: str,
) -> ConspectusHistoryEvent:
    """Adapt a repository history row to the response schema.

    Args:
        row: Merged ``HistoryRow`` from the review-log + content-event union.
        requesting_system_user_id: Fallback ``actor.system_user_id`` when the row lacks one.
        requesting_system_uuid: Fallback ``actor.system_uuid`` when the row lacks one.

    Returns:
        Populated :class:`ConspectusHistoryEvent` with only the matching discriminator body filled in.
    """
    actor = ConspectusHistoryActor(
        system_user_id=row.actor_system_user_id or requesting_system_user_id,
        system_uuid=row.actor_system_uuid or requesting_system_uuid,
    )
    if row.event_type == "review":
        assert row.tag is not None
        assert row.slot_before is not None
        assert row.slot_after is not None
        assert row.next_review_at_after is not None
        return ConspectusHistoryEvent(
            event_id=row.event_id,
            event_type="review",
            created_at=row.created_at,
            actor=actor,
            review=ConspectusHistoryReviewPayload(
                tag=row.tag,
                slot_from=row.slot_before,
                slot_to=row.slot_after,
                slot_d_ladder_index_from=row.slot_d_ladder_index_before or 0,
                slot_d_ladder_index_to=row.slot_d_ladder_index_after or 0,
                schedule_revision_after=row.schedule_revision_after or 0,
                next_review_at_after=row.next_review_at_after,
            ),
        )
    return ConspectusHistoryEvent(
        event_id=row.event_id,
        event_type="content_patch",
        created_at=row.created_at,
        actor=actor,
        content_patch=ConspectusHistoryContentPatchPayload(
            changed_fields=row.changed_fields or [],
            content_version_after=row.content_version_after or 0,
        ),
    )


# ---------------------------------------------------------------------------
# GET /conspectuses/{id}
# ---------------------------------------------------------------------------


@router.get(
    "/{conspectus_uuid}",
    response_model=ConspectusResponse,
    operation_id="getConspectusById",
    summary="Get one conspectus by uuid",
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ApiErrorResponse,
            "description": "User or conspectus not found (both collapse to 404).",
        },
        **common_protected_route_responses(),
    },
)
def get_conspectus(
    conspectus_uuid: Annotated[UUID, Path()],
    session: Annotated[Session, Depends(get_db_session)],
    system_user_id: Annotated[str, Query(min_length=1, max_length=36)],
    system_uuid: Annotated[UUID, Query()],
    api_key: Annotated[str | None, Security(api_key_security)] = None,
) -> ConspectusResponse:
    """GET /conspectuses/{id}."""
    _ = api_key
    owner_client_uuid = resolve_owner_client_uuid(
        session,
        system_user_id=system_user_id,
        system_uuid=system_uuid,
    )
    service = ConspectusService(ConspectusRepository(session))
    view = service.get_or_404(
        conspectus_uuid=str(conspectus_uuid),
        owner_client_uuid=owner_client_uuid,
    )
    return _view_to_response(view)


# ---------------------------------------------------------------------------
# PATCH /conspectuses/{id}
# ---------------------------------------------------------------------------


@router.patch(
    "/{conspectus_uuid}",
    response_model=ConspectusResponse,
    operation_id="patchConspectus",
    summary="Update conspectus content (at least one ETR field)",
    responses={
        status.HTTP_400_BAD_REQUEST: build_common_business_400_response(
            extra_examples={
                "patch_body_empty": {
                    "summary": "No ETR field present in body",
                    "value": CONSPECTUS_PATCH_BODY_EMPTY_EXAMPLE,
                },
            }
        ),
        status.HTTP_404_NOT_FOUND: {
            "model": ApiErrorResponse,
            "description": "User or conspectus not found.",
            "content": {
                "application/json": {
                    "examples": {
                        "conspectus_not_found": {
                            "summary": "Conspectus does not exist or is not owned by this user",
                            "value": CONSPECTUS_NOT_FOUND_ERROR_EXAMPLE,
                        }
                    }
                }
            },
        },
        status.HTTP_409_CONFLICT: COMMON_IDEMPOTENCY_CONFLICT_409_RESPONSE,
        status.HTTP_413_CONTENT_TOO_LARGE: COMMON_BODY_TOO_LARGE_413_RESPONSE,
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "model": ValidationErrorResponse,
            "description": "Request validation errors for the patch-conspectus body.",
            "content": {
                "application/json": {
                    "examples": CONSPECTUS_PATCH_VALIDATION_ERROR_EXAMPLES,
                }
            },
        },
        **common_protected_route_responses(),
    },
)
def patch_conspectus(
    conspectus_uuid: Annotated[UUID, Path()],
    payload: Annotated[
        ConspectusPatchRequest,
        Body(openapi_examples=CONSPECTUS_PATCH_REQUEST_EXAMPLES),
    ],
    session: Annotated[Session, Depends(get_db_session)],
    idempotency_key: Annotated[
        str,
        Header(
            alias="Idempotency-Key",
            min_length=1,
            max_length=128,
            pattern=r"^[ -~]+$",
        ),
    ],
    api_key: Annotated[str | None, Security(api_key_security)] = None,
) -> ConspectusResponse:
    """PATCH /conspectuses/{id} — partial content update with idempotent replay."""
    _ = api_key
    if not idempotency_key:
        raise HTTPException(status_code=400, detail=COMMON_400.as_detail("business"))

    conspectus_uuid_str = str(conspectus_uuid)
    guard = IdempotencyGuard(
        session=session,
        endpoint_path=_idempotency_endpoint("PATCH", f"/{conspectus_uuid_str}"),
        idempotency_key=idempotency_key,
        payload=payload.model_dump(mode="json", exclude_unset=True),
    )
    replayed = guard.replay_or_none(ConspectusResponse)
    if replayed is not None:
        return replayed

    owner_client_uuid = resolve_owner_client_uuid(
        session,
        system_user_id=payload.system_user_id,
        system_uuid=payload.system_uuid,
    )
    view = ConspectusService(ConspectusRepository(session)).patch(
        conspectus_uuid=conspectus_uuid_str,
        owner_client_uuid=owner_client_uuid,
        payload=payload,
    )
    response = _view_to_response(view)
    guard.save(status_code=status.HTTP_200_OK, response=response)
    return response


# ---------------------------------------------------------------------------
# DELETE /conspectuses/{id} (soft delete)
# ---------------------------------------------------------------------------


@router.delete(
    "/{conspectus_uuid}",
    response_model=ConspectusResponse,
    operation_id="deleteConspectus",
    summary="Soft-delete a conspectus (returns the updated row)",
    responses={
        status.HTTP_400_BAD_REQUEST: build_common_business_400_response(),
        status.HTTP_404_NOT_FOUND: {
            "model": ApiErrorResponse,
            "description": "User or conspectus not found.",
            "content": {
                "application/json": {
                    "examples": {
                        "conspectus_not_found": {
                            "summary": "Conspectus does not exist or is not owned by this user",
                            "value": CONSPECTUS_NOT_FOUND_ERROR_EXAMPLE,
                        }
                    }
                }
            },
        },
        status.HTTP_409_CONFLICT: COMMON_IDEMPOTENCY_CONFLICT_409_RESPONSE,
        status.HTTP_413_CONTENT_TOO_LARGE: COMMON_BODY_TOO_LARGE_413_RESPONSE,
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "model": ValidationErrorResponse,
            "description": "Request validation errors for the delete-conspectus body.",
            "content": {
                "application/json": {
                    "examples": CONSPECTUS_DELETE_VALIDATION_ERROR_EXAMPLES,
                }
            },
        },
        **common_protected_route_responses(),
    },
)
def delete_conspectus(
    conspectus_uuid: Annotated[UUID, Path()],
    payload: Annotated[
        ConspectusDeleteRequest,
        Body(openapi_examples=CONSPECTUS_DELETE_REQUEST_EXAMPLES),
    ],
    session: Annotated[Session, Depends(get_db_session)],
    idempotency_key: Annotated[
        str,
        Header(
            alias="Idempotency-Key",
            min_length=1,
            max_length=128,
            pattern=r"^[ -~]+$",
        ),
    ],
    api_key: Annotated[str | None, Security(api_key_security)] = None,
) -> ConspectusResponse:
    """DELETE /conspectuses/{id} — soft-delete via reason FK and unlink learner errors."""
    _ = api_key
    if not idempotency_key:
        raise HTTPException(status_code=400, detail=COMMON_400.as_detail("business"))

    conspectus_uuid_str = str(conspectus_uuid)
    guard = IdempotencyGuard(
        session=session,
        endpoint_path=_idempotency_endpoint("DELETE", f"/{conspectus_uuid_str}"),
        idempotency_key=idempotency_key,
        payload=payload.model_dump(mode="json"),
    )
    replayed = guard.replay_or_none(ConspectusResponse)
    if replayed is not None:
        return replayed

    owner_client_uuid = resolve_owner_client_uuid(
        session,
        system_user_id=payload.system_user_id,
        system_uuid=payload.system_uuid,
    )
    view = ConspectusService(ConspectusRepository(session)).soft_delete(
        conspectus_uuid=conspectus_uuid_str,
        owner_client_uuid=owner_client_uuid,
        payload=payload,
    )
    response = _view_to_response(view)
    guard.save(status_code=status.HTTP_200_OK, response=response)
    return response


# ---------------------------------------------------------------------------
# POST /conspectuses/{id}/actions/review
# ---------------------------------------------------------------------------


@router.post(
    "/{conspectus_uuid}/actions/review",
    response_model=ConspectusResponse,
    operation_id="reviewConspectus",
    summary="Apply a review outcome and advance the schedule",
    responses={
        status.HTTP_400_BAD_REQUEST: build_common_business_400_response(),
        status.HTTP_404_NOT_FOUND: {
            "model": ApiErrorResponse,
            "description": "User or conspectus not found.",
            "content": {
                "application/json": {
                    "examples": {
                        "conspectus_not_found": {
                            "summary": "Conspectus does not exist or is not owned by this user",
                            "value": CONSPECTUS_NOT_FOUND_ERROR_EXAMPLE,
                        }
                    }
                }
            },
        },
        status.HTTP_409_CONFLICT: {
            "model": ApiErrorResponse,
            "description": "Idempotency conflict or schedule revision conflict.",
            "content": {
                "application/json": {
                    "examples": {
                        "revision_conflict": {
                            "summary": "expected_schedule_revision does not match current revision",
                            "value": CONSPECTUS_REVIEW_REVISION_CONFLICT_EXAMPLE,
                        }
                    }
                }
            },
        },
        status.HTTP_413_CONTENT_TOO_LARGE: COMMON_BODY_TOO_LARGE_413_RESPONSE,
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "model": ValidationErrorResponse,
            "description": "Request validation errors for the review-conspectus body.",
            "content": {
                "application/json": {
                    "examples": CONSPECTUS_REVIEW_VALIDATION_ERROR_EXAMPLES,
                }
            },
        },
        **common_protected_route_responses(),
    },
)
def review_conspectus(
    conspectus_uuid: Annotated[UUID, Path()],
    payload: Annotated[
        ConspectusReviewRequest,
        Body(openapi_examples=CONSPECTUS_REVIEW_REQUEST_EXAMPLES),
    ],
    session: Annotated[Session, Depends(get_db_session)],
    idempotency_key: Annotated[
        str,
        Header(
            alias="Idempotency-Key",
            min_length=1,
            max_length=128,
            pattern=r"^[ -~]+$",
        ),
    ],
    api_key: Annotated[str | None, Security(api_key_security)] = None,
) -> ConspectusResponse:
    """POST /conspectuses/{id}/actions/review — state machine + optimistic CC."""
    _ = api_key
    if not idempotency_key:
        raise HTTPException(status_code=400, detail=COMMON_400.as_detail("business"))

    conspectus_uuid_str = str(conspectus_uuid)
    guard = IdempotencyGuard(
        session=session,
        endpoint_path=_idempotency_endpoint("POST", f"/{conspectus_uuid_str}/actions/review"),
        idempotency_key=idempotency_key,
        payload=payload.model_dump(mode="json"),
    )
    replayed = guard.replay_or_none(ConspectusResponse)
    if replayed is not None:
        return replayed

    owner_client_uuid = resolve_owner_client_uuid(
        session,
        system_user_id=payload.system_user_id,
        system_uuid=payload.system_uuid,
    )
    view = ConspectusService(ConspectusRepository(session)).review(
        conspectus_uuid=conspectus_uuid_str,
        owner_client_uuid=owner_client_uuid,
        payload=payload,
    )
    response = _view_to_response(view)
    guard.save(status_code=status.HTTP_200_OK, response=response)
    return response
