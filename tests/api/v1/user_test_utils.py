"""Пути и тела для тестов User API — те же источники, что и в tools/load_testing (схема из app)."""

from __future__ import annotations

from typing import Any

from app.api.v1.user import USER_HTTP_BASE_PATH
from app.schemas.user import UserCreateRequest

# Re-export для тестов: один импорт вместо дублирования строки пути.
__all__ = [
    "USER_HTTP_BASE_PATH",
    "USER_CREATE_OPERATION",
    "user_create_body",
    "user_resource_path",
]

USER_CREATE_OPERATION: str = f"POST {USER_HTTP_BASE_PATH}"


def user_resource_path(system_user_id: str) -> str:
    """GET /api/v1/user/{system_user_id}"""
    return f"{USER_HTTP_BASE_PATH}/{system_user_id}"


def user_create_body(
    system_user_id: str,
    *,
    full_name: str = "Ivan Petrov",
    timezone: str = "UTC",
    username: str | None = None,
) -> dict[str, Any]:
    """Валидное тело POST создания пользователя (как в API)."""
    return UserCreateRequest(
        system_user_id=system_user_id,
        full_name=full_name,
        timezone=timezone,
        username=username,
    ).model_dump(mode="json")
