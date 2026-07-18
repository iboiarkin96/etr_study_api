"""Pydantic contracts for the Telegram Mini App auth endpoint."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class TelegramAuthRequest(BaseModel):
    """Request body for ``POST /api/v1/auth/telegram``."""

    model_config = ConfigDict(str_strip_whitespace=True)

    init_data: str = Field(
        ...,
        min_length=1,
        max_length=8192,
        description=(
            "Raw `window.Telegram.WebApp.initData` string. Server verifies its"
            " HMAC signature against `TELEGRAM_BOT_TOKEN`."
        ),
    )


class TelegramAuthUser(BaseModel):
    """Trusted user block returned alongside the JWT.

    Values come from Telegram's ``initData.user`` payload, joined with the
    identity row persisted in ``telegram_users``.
    """

    client_uuid: str = Field(..., description="Internal `users.client_uuid`, used as JWT `sub`.")
    telegram_user_id: int = Field(..., description="Telegram's numeric user id (int64).")
    telegram_username: str | None = Field(
        default=None, description="Public `@handle`, if the account has one."
    )
    telegram_photo_url: str | None = Field(
        default=None, description="Avatar URL from `initData`, if present."
    )
    locale: str | None = Field(
        default=None, description="BCP-47 language code from `initData.user.language_code`."
    )
    full_name: str = Field(..., description="Concatenated first+last name mirrored on `users`.")


class TelegramAuthResponse(BaseModel):
    """Response body for ``POST /api/v1/auth/telegram``."""

    jwt: str = Field(..., description="24 h HS256 JWT signed with `JWT_SECRET`.")
    expires_at_epoch: int = Field(..., description="Unix seconds when the JWT stops verifying.")
    token_type: str = Field(default="Bearer", description="Always `Bearer` (RFC 6750).")
    user: TelegramAuthUser
