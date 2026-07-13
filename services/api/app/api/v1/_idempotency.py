"""Shared idempotency guard used by write endpoints.

Each write route follows the same three-step dance: (1) hash the request body, (2) look
up a stored replay for the same ``Idempotency-Key`` and either replay or reject on
payload mismatch, (3) after the handler runs, persist the response so retries replay it
byte-for-byte. The class below encodes that dance once so router handlers stay short.
"""

from __future__ import annotations

from typing import TypeVar

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.idempotency import build_payload_hash
from app.errors.common import COMMON_409
from app.repositories.idempotency_repository import IdempotencyRepository

_ResponseT = TypeVar("_ResponseT", bound=BaseModel)


class IdempotencyGuard:
    """Per-request helper that hashes the body, replays a stored response, or saves a new one.

    Attributes:
        endpoint_path: Namespace under which the key is stored (e.g. ``POST /api/v1/errors``).
        idempotency_key: Client-supplied ``Idempotency-Key`` header value.
        payload_hash: SHA-256 of the canonicalised request body.
    """

    def __init__(
        self,
        *,
        session: Session,
        endpoint_path: str,
        idempotency_key: str,
        payload: dict[str, object],
    ) -> None:
        """Create a guard bound to one request and route.

        Args:
            session: Active DB session used for the underlying repository.
            endpoint_path: Namespace string identifying the operation.
            idempotency_key: Client-supplied token from the ``Idempotency-Key`` header.
            payload: JSON-serialisable request body (usually ``model.model_dump(mode="json")``).
        """
        self._repository = IdempotencyRepository(session)
        self.endpoint_path = endpoint_path
        self.idempotency_key = idempotency_key
        self.payload_hash = build_payload_hash(payload)

    def replay_or_none(self, response_cls: type[_ResponseT]) -> _ResponseT | None:
        """Return the stored replay body if one exists; raise 409 on payload mismatch.

        Args:
            response_cls: Pydantic model used to validate the stored body.

        Returns:
            Reconstructed response when a stored record with the same payload hash exists;
            ``None`` when no record is stored yet.

        Raises:
            fastapi.HTTPException: 409 :data:`COMMON_409` when the same key was previously
                used with a different body.
        """
        record = self._repository.get(
            endpoint_path=self.endpoint_path,
            idempotency_key=self.idempotency_key,
        )
        if record is None:
            return None
        if record.payload_hash != self.payload_hash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=COMMON_409.as_detail("business"),
            )
        return response_cls.model_validate(record.response_body)

    def save(self, *, status_code: int, response: BaseModel) -> None:
        """Persist the response body so future retries replay it.

        Args:
            status_code: HTTP status returned on the first successful call.
            response: The Pydantic response model instance to serialise.
        """
        self._repository.save(
            endpoint_path=self.endpoint_path,
            idempotency_key=self.idempotency_key,
            payload_hash=self.payload_hash,
            status_code=status_code,
            response_body=response.model_dump(mode="json"),
        )
