"""Типы запроса для сценариев нагрузки."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, TypeAlias

JsonBody: TypeAlias = dict[str, Any] | None


@dataclass
class RunContext:
    """Контекст одного запроса в прогоне."""

    seq: int
    """Глобальный индекс запроса (0 .. total-1)."""
    run_in_scenario: int
    """Сколько раз уже выполняли этот сценарий в этом прогоне."""
    nonce: str
    """Уникальная строка на запрос (для idempotency / system_user_id)."""


@dataclass(frozen=True)
class BuiltRequest:
    method: str
    path: str
    """Путь относительно base_url, например /api/v1/user."""
    headers: dict[str, str]
    json: JsonBody
    params: dict[str, str] | None
    expect_status: int


ScenarioBuild: TypeAlias = Callable[[RunContext], BuiltRequest]
