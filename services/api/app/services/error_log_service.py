"""Business logic for the Error-log domain."""

from __future__ import annotations

import logging

from fastapi import HTTPException

from app.errors.error_log import ERR_404
from app.models.core.learning_error import LearningError
from app.repositories.learning_error_repository import LearningErrorRepository
from app.schemas.error_log import ErrorLogCreateRequest

logger = logging.getLogger(__name__)


class ErrorLogService:
    """Domain logic for the append-only ``learning_errors`` table."""

    def __init__(self, repository: LearningErrorRepository) -> None:
        """Bind to a repository.

        Args:
            repository: Data-access instance for this request.
        """
        self.repository = repository

    def create(
        self,
        *,
        payload: ErrorLogCreateRequest,
        owner_client_uuid: str,
    ) -> LearningError:
        """Insert a new error-log row after validating optional FK ownership.

        Args:
            payload: Validated request body.
            owner_client_uuid: Owner resolved from the composite key.

        Returns:
            Persisted :class:`LearningError` after commit + refresh.

        Raises:
            fastapi.HTTPException: 404 :data:`ERR_404` when an FK is not owned.
        """
        conspectus_uuid = (
            str(payload.conspectus_uuid) if payload.conspectus_uuid is not None else None
        )
        if conspectus_uuid is not None and not self.repository.conspectus_owned_by(
            conspectus_uuid, owner_client_uuid
        ):
            logger.info(
                "error_log_create_reference_not_found kind=conspectus owner=%s ref=%s",
                owner_client_uuid,
                conspectus_uuid,
            )
            raise HTTPException(status_code=404, detail=ERR_404.as_detail("business"))

        if payload.review_log_id is not None and not self.repository.review_log_owned_by(
            payload.review_log_id, owner_client_uuid
        ):
            logger.info(
                "error_log_create_reference_not_found kind=review_log owner=%s ref=%s",
                owner_client_uuid,
                payload.review_log_id,
            )
            raise HTTPException(status_code=404, detail=ERR_404.as_detail("business"))

        entity = LearningError(
            owner_client_uuid=owner_client_uuid,
            message=payload.message,
            conspectus_uuid=conspectus_uuid,
            review_log_id=payload.review_log_id,
        )
        persisted = self.repository.save(entity)
        logger.info(
            "error_log_created error_uuid=%s owner=%s conspectus_uuid=%s review_log_id=%s",
            persisted.error_uuid,
            owner_client_uuid,
            conspectus_uuid,
            payload.review_log_id,
        )
        return persisted

    def list_all(
        self,
        *,
        owner_client_uuid: str,
        conspectus_uuid: str | None = None,
    ) -> list[LearningError]:
        """Return newest-first errors for the owner (bounded at 100).

        Args:
            owner_client_uuid: Owner scope.
            conspectus_uuid: Optional exact-match filter.

        Returns:
            Sorted list; empty when nothing matches.
        """
        return self.repository.list_by_owner(
            owner_client_uuid=owner_client_uuid,
            conspectus_uuid=conspectus_uuid,
        )
