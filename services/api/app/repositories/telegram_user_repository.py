"""Data access layer for the Telegram identity table."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core.telegram_user import TelegramUser


class TelegramUserRepository:
    """Persistence layer for :class:`~app.models.core.telegram_user.TelegramUser`."""

    def __init__(self, session: Session) -> None:
        """Create a repository bound to one SQLAlchemy session.

        Args:
            session: Active SQLAlchemy session (caller owns transaction boundaries).
        """
        self.session = session

    def get_by_telegram_user_id(self, telegram_user_id: int) -> TelegramUser | None:
        """Load a row by Telegram's numeric user id, or ``None``.

        Args:
            telegram_user_id: The Telegram int64 identifier.

        Returns:
            ORM entity or ``None``.
        """
        stmt = select(TelegramUser).where(TelegramUser.telegram_user_id == telegram_user_id)
        return self.session.execute(stmt).scalar_one_or_none()
