"""Opaque cursor helpers for keyset-paginated list endpoints."""

from __future__ import annotations

import base64
import json
from datetime import datetime

from fastapi import HTTPException

from app.errors.common import COMMON_000


def encode_list_cursor(created_at: datetime, uuid_value: str) -> str:
    """Encode a ``(created_at, uuid)`` cursor as a URL-safe base64 token.

    Args:
        created_at: The row's ``created_at`` timestamp (UTC).
        uuid_value: The row's UUID for tiebreaking equal timestamps.

    Returns:
        Opaque token safe for use in query parameters.
    """
    payload = json.dumps({"c": created_at.isoformat(), "u": uuid_value}, separators=(",", ":"))
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii").rstrip("=")


def decode_list_cursor(token: str) -> tuple[datetime, str]:
    """Reverse :func:`encode_list_cursor`; 422 on any parse failure.

    Args:
        token: Opaque cursor from a previous ``next_cursor``.

    Returns:
        ``(created_at, uuid)`` tuple.

    Raises:
        fastapi.HTTPException: 422 :data:`COMMON_000` when the token is malformed.
    """
    try:
        padded = token + "=" * (-len(token) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
        return datetime.fromisoformat(payload["c"]), str(payload["u"])
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=COMMON_000.as_detail("validation", message=f"Invalid cursor token: {exc}"),
        ) from exc


def encode_history_cursor(created_at: datetime, event_id: str) -> str:
    """Encode a ``(created_at, event_id)`` history cursor.

    Args:
        created_at: The row's ``created_at`` timestamp.
        event_id: Type-prefixed event id (``r<n>`` for review logs, ``e<n>`` for content events).

    Returns:
        Opaque URL-safe base64 token.
    """
    payload = json.dumps({"c": created_at.isoformat(), "e": event_id}, separators=(",", ":"))
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii").rstrip("=")


def decode_history_cursor(token: str) -> tuple[datetime, str]:
    """Reverse :func:`encode_history_cursor`; 422 on any parse failure.

    Args:
        token: Opaque cursor from a previous ``next_cursor``.

    Returns:
        ``(created_at, event_id)`` tuple.

    Raises:
        fastapi.HTTPException: 422 :data:`COMMON_000` when the token is malformed.
    """
    try:
        padded = token + "=" * (-len(token) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
        return datetime.fromisoformat(payload["c"]), str(payload["e"])
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=COMMON_000.as_detail("validation", message=f"Invalid cursor token: {exc}"),
        ) from exc
