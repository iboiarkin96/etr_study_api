"""Core business model: Telegram identity attached to a user.

Separates «who the learner is» (``users``) from «how they logged in via Telegram»
(this table). Each row binds one Telegram account to exactly one :class:`~app.models.core.user.User`
via ``client_uuid``. New auth methods (Google, Apple, etc.) get their own sibling
table so ``users`` never bloats with provider-specific columns.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _utc_now() -> datetime:
    """Return current UTC time with tzinfo for :class:`~datetime.datetime` columns."""
    return datetime.now(UTC)


if TYPE_CHECKING:
    from app.models.core.user import User


class TelegramUser(Base):
    """Telegram identity for one user — populated at ``/api/v1/auth/telegram``.

    ``telegram_user_id`` is Telegram's numeric user id (int64); it is the identity
    anchor for the auth flow and must be globally unique. Nullable fields
    (``telegram_username``, ``telegram_photo_url``, ``locale``) mirror the optional
    parts of Telegram's ``initData.user`` payload — an account without a public
    username or photo is legal.
    """

    __tablename__ = "telegram_users"

    telegram_user_uuid: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    client_uuid: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.client_uuid", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    telegram_user_id: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        unique=True,
        index=True,
    )
    telegram_username: Mapped[str] = mapped_column(String(64), nullable=True)
    telegram_photo_url: Mapped[str] = mapped_column(String(512), nullable=True)
    locale: Mapped[str] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utc_now,
        onupdate=_utc_now,
    )

    user: Mapped[User] = relationship(back_populates="telegram_user")
