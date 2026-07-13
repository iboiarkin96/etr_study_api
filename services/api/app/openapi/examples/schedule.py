"""OpenAPI examples for the Schedule projection endpoints (query params only)."""

from __future__ import annotations

from typing import Final

from app.errors.schedule import SCHED_001, SCHED_003, SCHED_010, SCHED_011, SCHED_012
from app.openapi.examples.errors import _validation_error_example

_SUMMARY_ENDPOINT = "GET /api/v1/schedule/summary"
_PREVIEW_ENDPOINT = "GET /api/v1/schedule/preview"


SCHEDULE_SUMMARY_VALIDATION_ERROR_EXAMPLES: Final[dict[str, dict[str, object]]] = {
    "missing_system_user_id": {
        "summary": "Missing query parameter system_user_id",
        "value": _validation_error_example(
            SCHED_001,
            endpoint=_SUMMARY_ENDPOINT,
            field="system_user_id",
            error_type="missing",
            loc=["query", "system_user_id"],
            input_value=None,
            ctx=None,
        ),
    },
    "missing_system_uuid": {
        "summary": "Missing query parameter system_uuid",
        "value": _validation_error_example(
            SCHED_003,
            endpoint=_SUMMARY_ENDPOINT,
            field="system_uuid",
            error_type="missing",
            loc=["query", "system_uuid"],
            input_value=None,
            ctx=None,
        ),
    },
}


SCHEDULE_PREVIEW_VALIDATION_ERROR_EXAMPLES: Final[dict[str, dict[str, object]]] = {
    "bad_window": {
        "summary": "window enum value is not supported",
        "value": _validation_error_example(
            SCHED_010,
            endpoint=_PREVIEW_ENDPOINT,
            field="window",
            error_type="literal_error",
            loc=["query", "window"],
            input_value="PT12H",
            ctx={"expected": "'PT1H', 'PT4H', 'PT24H' or 'P1D'"},
        ),
    },
    "bad_limit": {
        "summary": "limit is above the max",
        "value": _validation_error_example(
            SCHED_011,
            endpoint=_PREVIEW_ENDPOINT,
            field="limit",
            error_type="less_than_equal",
            loc=["query", "limit"],
            input_value=250,
            ctx={"le": 100},
        ),
    },
    "bad_random_seed": {
        "summary": "random_seed contains disallowed characters",
        "value": _validation_error_example(
            SCHED_012,
            endpoint=_PREVIEW_ENDPOINT,
            field="random_seed",
            error_type="string_pattern_mismatch",
            loc=["query", "random_seed"],
            input_value="spaces are not allowed",
            ctx={"pattern": "^[A-Za-z0-9_-]+$"},
        ),
    },
}
