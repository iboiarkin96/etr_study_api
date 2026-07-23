"""Orchestrator for the Telegram Mini App auth flow.

Verifier and JWT-minter live in :mod:`app.core.telegram_init_data` and
:mod:`app.core.jwt_tokens` respectively. This module wires them to persistence:

  1. Verify raw ``initData`` (HMAC + freshness).
  2. Find-or-create a row in ``telegram_users`` keyed on ``telegram_user_id``.
  3. Find-or-create the paired ``users`` row via composite key
     ``(TELEGRAM_SYSTEM_UUID, str(telegram_user_id))``.
  4. Refresh the Telegram-side fields (``username``, ``photo_url``, ``locale``)
     from every fresh ``initData`` payload — Telegram updates them silently.
  5. Mint a 24 h JWT with ``sub = users.client_uuid``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from app.core.jwt_tokens import mint_jwt
from app.core.telegram_identity import TELEGRAM_SYSTEM_UUID
from app.core.telegram_init_data import (
    InvalidInitData,
    TelegramInitData,
    TelegramInitDataUser,
    verify_init_data,
)
from app.models.core.telegram_user import TelegramUser
from app.models.core.user import User
from app.repositories.telegram_user_repository import TelegramUserRepository
from app.repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AuthOutcome:
    """Result of a successful :meth:`AuthService.sign_in_with_init_data` call.

    Attributes:
        user: Persisted (fresh or existing) core :class:`~app.models.core.user.User`.
        telegram_user: Persisted (fresh or existing) :class:`~app.models.core.telegram_user.TelegramUser`.
        jwt: Signed 24 h Bearer token.
        expires_at_epoch: Unix seconds when the JWT stops verifying.
    """

    user: User
    telegram_user: TelegramUser
    jwt: str
    expires_at_epoch: int


class AuthService:
    """Orchestrates the ``POST /api/v1/auth/telegram`` flow.

    The ``sign_in_with_init_data`` method is the only public entry point; it
    verifies the payload, upserts the two identity rows, and mints the JWT.
    """

    def __init__(
        self,
        *,
        user_repository: UserRepository,
        telegram_user_repository: TelegramUserRepository,
        bot_token: str,
        init_data_max_age_seconds: int,
        jwt_secret: str,
        jwt_ttl_seconds: int,
    ) -> None:
        """Bind collaborators + config.

        Args:
            user_repository: Data access for the core ``users`` table.
            telegram_user_repository: Data access for the ``telegram_users`` table.
            bot_token: HMAC key for verifying Telegram ``initData``.
            init_data_max_age_seconds: Reject ``initData`` older than this
                (replay protection).
            jwt_secret: HMAC key for signing the response JWT.
            jwt_ttl_seconds: JWT lifetime; typically 24 h.
        """
        self._user_repository = user_repository
        self._telegram_user_repository = telegram_user_repository
        self._bot_token = bot_token
        self._init_data_max_age_seconds = init_data_max_age_seconds
        self._jwt_secret = jwt_secret
        self._jwt_ttl_seconds = jwt_ttl_seconds

    def sign_in_with_init_data(self, raw_init_data: str) -> AuthOutcome:
        """Verify ``initData``, upsert identity rows, mint JWT.

        Args:
            raw_init_data: The exact string from ``window.Telegram.WebApp.initData``.

        Returns:
            :class:`AuthOutcome` with the persisted user + JWT.

        Raises:
            InvalidInitData: HMAC failed, ``auth_date`` is stale, or the
                payload is malformed. Caller maps this to HTTP 401.
        """
        verified = verify_init_data(
            raw_init_data,
            self._bot_token,
            max_age_seconds=self._init_data_max_age_seconds,
        )
        session = self._user_repository.session

        user = self._upsert_user(verified)
        telegram_user = self._upsert_telegram_user(verified, user_client_uuid=user.client_uuid)
        session.commit()
        session.refresh(user)
        session.refresh(telegram_user)

        jwt_token, expires_at = mint_jwt(
            subject=user.client_uuid,
            secret=self._jwt_secret,
            ttl_seconds=self._jwt_ttl_seconds,
        )
        logger.info(
            "auth_telegram_success telegram_user_id=%s client_uuid=%s",
            verified.user.id,
            user.client_uuid,
        )
        return AuthOutcome(
            user=user,
            telegram_user=telegram_user,
            jwt=jwt_token,
            expires_at_epoch=expires_at,
        )

    def _upsert_user(self, verified: TelegramInitData) -> User:
        """Return an existing ``users`` row for this Telegram id or create a fresh one."""
        system_user_id = str(verified.user.id)
        existing = self._user_repository.get_by_system_user_id_and_system_uuid(
            system_user_id, TELEGRAM_SYSTEM_UUID
        )
        if existing is not None:
            existing.full_name = _display_name(verified.user)
            return existing

        user = User(
            system_user_id=system_user_id,
            system_uuid=TELEGRAM_SYSTEM_UUID,
            username=verified.user.username,
            full_name=_display_name(verified.user),
        )
        self._user_repository.session.add(user)
        self._user_repository.session.flush()  # populate client_uuid + timestamps
        return user

    def _upsert_telegram_user(
        self, verified: TelegramInitData, *, user_client_uuid: str
    ) -> TelegramUser:
        """Refresh the Telegram-side row for this ``telegram_user_id``, or create it."""
        existing = self._telegram_user_repository.get_by_telegram_user_id(verified.user.id)
        if existing is not None:
            existing.telegram_username = verified.user.username
            existing.telegram_photo_url = verified.user.photo_url
            existing.locale = verified.user.language_code
            return existing

        row = TelegramUser(
            client_uuid=user_client_uuid,
            telegram_user_id=verified.user.id,
            telegram_username=verified.user.username,
            telegram_photo_url=verified.user.photo_url,
            locale=verified.user.language_code,
        )
        self._telegram_user_repository.session.add(row)
        self._telegram_user_repository.session.flush()
        return row


def _display_name(user: TelegramInitDataUser) -> str:
    """Build a non-empty ``full_name`` from Telegram's optional pieces."""
    parts = [user.first_name or "", user.last_name or ""]
    joined = " ".join(part for part in parts if part).strip()
    if joined:
        return joined
    if user.username:
        return f"@{user.username}"
    return f"Telegram user {user.id}"


__all__ = ["AuthService", "AuthOutcome", "InvalidInitData"]
