"""Тела POST создания пользователя и поломки полей под 422.

Валидное тело строится через Pydantic-модель из приложения (`UserCreateRequest`), чтобы при
смене полей в API не править дублирующий dict вручную. Нагрузочный раннер по-прежнему ходит по
HTTP (как curl), а не вызывает Python-обработчик напрямую — так же считаются метрики и middleware.
"""

from __future__ import annotations

import copy
from typing import Any

from app.schemas.user import UserCreateRequest

# Имена полей всегда совпадают со схемой API
BREAKABLE_FIELDS: frozenset[str] = frozenset(UserCreateRequest.model_fields.keys())


def base_user_create(system_user_id: str) -> dict[str, Any]:
    """Минимально валидное JSON-тело такое же, как у принятого UserCreateRequest."""
    return UserCreateRequest(
        system_user_id=system_user_id,
        full_name="Load Test User",
        timezone="UTC",
    ).model_dump(mode="json")


def apply_break_field(body: dict[str, Any], field: str) -> dict[str, Any]:
    """Копия тела с заведомо невалидным значением для поля (ожидается 422)."""
    if field not in BREAKABLE_FIELDS:
        raise ValueError(
            f"Неизвестное поле для поломки: {field!r}. Допустимо: {sorted(BREAKABLE_FIELDS)}"
        )

    out = copy.deepcopy(body)

    if field == "system_user_id":
        out[field] = ""
    elif field == "username":
        out[field] = "x" * 300
    elif field == "full_name":
        out[field] = ""
    elif field == "timezone":
        out[field] = "Not/A/Valid/Timezone"
    elif field == "system_uuid":
        out[field] = "not-a-uuid"
    elif field == "invalidation_reason_uuid":
        out[field] = "bad"
    elif field == "is_row_invalid":
        out[field] = 9

    return out
