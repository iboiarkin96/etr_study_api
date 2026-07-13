"""Shared helper that maps ``(system_user_id, system_uuid)`` to an owner ``client_uuid``.

All Conspectus / Schedule / Error-log endpoints scope by ``owner_client_uuid`` — this
helper centralises the composite-key lookup and the 404 USER_NOT_FOUND behaviour so the
domain services stay focused on their own logic.
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.errors.user import USER_404
from app.repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)


def resolve_owner_client_uuid(
    session: Session,
    *,
    system_user_id: str,
    system_uuid: str | UUID,
) -> str:
    """Return ``users.client_uuid`` for the composite key, or raise 404.

    Args:
        session: Active DB session.
        system_user_id: External user id from body or query.
        system_uuid: Source system UUID (accepts :class:`~uuid.UUID` or string).

    Returns:
        Internal client UUID string.

    Raises:
        fastapi.HTTPException: 404 with :data:`USER_404` when the user is missing.
    """
    su_str = str(system_uuid)
    user = UserRepository(session).get_by_system_user_id_and_system_uuid(
        system_user_id,
        su_str,
    )
    if user is None:
        logger.warning(
            "owner_lookup_failed system_user_id=%s system_uuid=%s",
            system_user_id,
            su_str,
        )
        raise HTTPException(status_code=404, detail=USER_404.as_detail("business"))
    return user.client_uuid
