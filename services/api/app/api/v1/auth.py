"""HTTP handler for the Telegram Mini App auth exchange.

Anonymous endpoint — the auth middleware exempts it through the
:data:`app.core.security.ANONYMOUS_API_PATHS` tuple. This is the only door
through which a client can obtain a Bearer JWT.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db_session
from app.core.telegram_init_data import InvalidInitData
from app.errors.common import COMMON_401, COMMON_422
from app.repositories.telegram_user_repository import TelegramUserRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import TelegramAuthRequest, TelegramAuthResponse, TelegramAuthUser
from app.schemas.errors import ValidationErrorResponse
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])

# Public path for this router: main includes it under `/api/v1`.
TELEGRAM_AUTH_HTTP_PATH = "/api/v1/auth/telegram"


@router.post(
    "/telegram",
    response_model=TelegramAuthResponse,
    status_code=status.HTTP_200_OK,
    operation_id="signInWithTelegramInitData",
    summary="Exchange Telegram initData for a 24 h Bearer JWT",
    description=(
        "Verifies the HMAC signature of `initData` against `TELEGRAM_BOT_TOKEN`,"
        " upserts the caller's identity in `users` + `telegram_users`, and"
        " returns a signed JWT for use as `Authorization: Bearer <jwt>` on"
        " every subsequent `/api/v1/*` call. Anonymous endpoint — the Bearer"
        " middleware exempts it."
    ),
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "initData is missing, tampered, or older than the freshness window."
        },
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "model": ValidationErrorResponse,
            "description": "Request body did not match the expected shape.",
            "content": {
                "application/json": {
                    "examples": {
                        "missing_init_data": {
                            "summary": "Missing `init_data` field",
                            "value": {
                                "error_type": "validation_error",
                                "endpoint": "POST /api/v1/auth/telegram",
                                "errors": [
                                    {
                                        "code": COMMON_422.code,
                                        "key": COMMON_422.key,
                                        "message": COMMON_422.message,
                                        "field": "init_data",
                                        "source": "validation",
                                        "details": {
                                            "type": "missing",
                                            "loc": ["body", "init_data"],
                                            "input": {},
                                            "ctx": None,
                                        },
                                    }
                                ],
                            },
                        },
                    },
                }
            },
        },
    },
)
def sign_in_with_telegram(
    payload: TelegramAuthRequest,
    session: Annotated[Session, Depends(get_db_session)],
) -> TelegramAuthResponse:
    """Handle the auth exchange.

    Args:
        payload: Body carrying the raw ``initData`` string.
        session: SQLAlchemy session from :func:`app.core.database.get_db_session`.

    Returns:
        JWT + user block on success.

    Raises:
        fastapi.HTTPException: 401 when initData fails HMAC verification or is
            stale; 503 when the bot token is not configured on the server.
    """
    settings = get_settings()
    if not settings.telegram_bot_token:
        logger.error("auth_telegram_bot_token_missing")
        raise HTTPException(
            status_code=503,
            detail={
                "code": "SERVICE_UNAVAILABLE",
                "key": "AUTH_TELEGRAM_BOT_TOKEN_MISSING",
                "source": "security",
                "message": "Telegram bot token is not configured on the server.",
            },
        )
    if not settings.jwt_secret:
        logger.error("auth_jwt_secret_missing")
        raise HTTPException(
            status_code=503,
            detail={
                "code": "SERVICE_UNAVAILABLE",
                "key": "AUTH_JWT_SECRET_MISSING",
                "source": "security",
                "message": "JWT signing secret is not configured on the server.",
            },
        )

    service = AuthService(
        user_repository=UserRepository(session),
        telegram_user_repository=TelegramUserRepository(session),
        bot_token=settings.telegram_bot_token,
        init_data_max_age_seconds=settings.telegram_init_data_max_age_seconds,
        jwt_secret=settings.jwt_secret,
        jwt_ttl_seconds=settings.jwt_ttl_seconds,
    )
    try:
        outcome = service.sign_in_with_init_data(payload.init_data)
    except InvalidInitData as exc:
        logger.warning("auth_telegram_rejected reason=%s", exc)
        raise HTTPException(
            status_code=401,
            detail=COMMON_401.as_detail("security", message=str(exc)),
        ) from exc

    return TelegramAuthResponse(
        jwt=outcome.jwt,
        expires_at_epoch=outcome.expires_at_epoch,
        user=TelegramAuthUser(
            client_uuid=outcome.user.client_uuid,
            telegram_user_id=outcome.telegram_user.telegram_user_id,
            telegram_username=outcome.telegram_user.telegram_username,
            telegram_photo_url=outcome.telegram_user.telegram_photo_url,
            locale=outcome.telegram_user.locale,
            full_name=outcome.user.full_name,
        ),
    )
