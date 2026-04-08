"""Shared validation constants and constrained types for Pydantic schemas."""

from __future__ import annotations

from typing import Annotated

from pydantic import AfterValidator
from zoneinfo import available_timezones

VALID_TIMEZONES: frozenset[str] = frozenset(available_timezones())


def _check_timezone(value: str) -> str:
    if value not in VALID_TIMEZONES:
        raise ValueError(
            f"Unknown timezone '{value}'. "
            "Use a valid IANA timezone (e.g. 'UTC', 'Europe/Moscow', 'America/New_York')."
        )
    return value


TimezoneField = Annotated[str, AfterValidator(_check_timezone)]
