"""Route Pydantic validation failures to the right per-endpoint stable-error table.

The single entry point :func:`build_validation_error_payload` inspects the failed
request (method + path), picks the correct ``(field, error_type) -> StableError`` map,
and returns the 422 envelope used by :class:`app.schemas.errors.ValidationErrorResponse`.

Fallback rule when no map matches: :data:`app.errors.common.COMMON_000` — this preserves
existing behaviour and makes it safe to add new endpoints without also touching this
dispatcher up front.
"""

from __future__ import annotations

import re
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError

from app.errors.common import COMMON_000
from app.errors.conspectus import (
    CREATE_CONSPECTUS_VALIDATION_RULES,
    DELETE_CONSPECTUS_VALIDATION_RULES,
    PATCH_CONSPECTUS_VALIDATION_RULES,
    REVIEW_CONSPECTUS_VALIDATION_RULES,
)
from app.errors.error_log import (
    CREATE_ERROR_LOG_VALIDATION_RULES,
    LIST_ERROR_LOG_VALIDATION_RULES,
)
from app.errors.schedule import (
    SCHEDULE_PREVIEW_VALIDATION_RULES,
    SCHEDULE_SUMMARY_VALIDATION_RULES,
)
from app.errors.types import StableError
from app.errors.user import CREATE_USER_VALIDATION_RULES, UPDATE_USER_VALIDATION_RULES

_PUT_PATCH_USER_BY_COMPOSITE_PATH = re.compile(r"^/api/v1/user/[^/]+/[^/]+$")
_CONSPECTUS_BY_UUID_PATH = re.compile(r"^/api/v1/conspectuses/[^/]+$")
_CONSPECTUS_REVIEW_PATH = re.compile(r"^/api/v1/conspectuses/[^/]+/actions/review$")


def _json_safe(value: Any) -> Any:
    """Coerce arbitrary values into JSON-friendly types for the error ``details``.

    Args:
        value: Object from a Pydantic error (loc, input, ctx, etc.).

    Returns:
        Same value when it is already JSON-native; ``str(value)`` otherwise.
    """
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    return str(value)


def _field_from_loc(loc: list[Any]) -> str | None:
    """Return the leading body / query field name from a Pydantic ``loc`` tuple.

    Handles both ``["body", "field"]`` and ``["query", "field"]``; falls back to
    ``None`` for unusual loc shapes so the dispatcher uses the model-level entry
    ``("", ...)`` where applicable.
    """
    if len(loc) >= 2 and loc[0] in ("body", "query") and isinstance(loc[1], str):
        return loc[1]
    return None


def _select_rule_table(method: str, path: str) -> dict[tuple[str, str], StableError]:
    """Pick the ``(field, error_type) -> StableError`` map for a request.

    Args:
        method: Uppercase HTTP method.
        path: URL path (already prefix-stripped by FastAPI).

    Returns:
        The domain-specific rule table; empty dict when no domain matches so
        the caller falls back to :data:`COMMON_000` for every field.
    """
    # User (existing).
    if method == "POST" and path == "/api/v1/user":
        return CREATE_USER_VALIDATION_RULES
    if method in ("PUT", "PATCH") and _PUT_PATCH_USER_BY_COMPOSITE_PATH.match(path):
        return UPDATE_USER_VALIDATION_RULES

    # Conspectus.
    if method == "POST" and path == "/api/v1/conspectuses":
        return CREATE_CONSPECTUS_VALIDATION_RULES
    if method == "POST" and _CONSPECTUS_REVIEW_PATH.match(path):
        return REVIEW_CONSPECTUS_VALIDATION_RULES
    if method == "PATCH" and _CONSPECTUS_BY_UUID_PATH.match(path):
        return PATCH_CONSPECTUS_VALIDATION_RULES
    if method == "DELETE" and _CONSPECTUS_BY_UUID_PATH.match(path):
        return DELETE_CONSPECTUS_VALIDATION_RULES

    # Error log.
    if method == "POST" and path == "/api/v1/errors":
        return CREATE_ERROR_LOG_VALIDATION_RULES
    if method == "GET" and path == "/api/v1/errors":
        return LIST_ERROR_LOG_VALIDATION_RULES

    # Schedule projections.
    if method == "GET" and path == "/api/v1/schedule/summary":
        return SCHEDULE_SUMMARY_VALIDATION_RULES
    if method == "GET" and path == "/api/v1/schedule/preview":
        return SCHEDULE_PREVIEW_VALIDATION_RULES

    return {}


def build_validation_error_payload(request: Request, exc: RequestValidationError) -> dict[str, Any]:
    """Normalise FastAPI/Pydantic validation errors into the API 422 contract.

    Args:
        request: Failing request; ``method`` + ``url.path`` select the rule table.
        exc: FastAPI wrapper around Pydantic's error list.

    Returns:
        Dict shaped like :class:`~app.schemas.errors.ValidationErrorResponse`.
    """
    endpoint = f"{request.method} {request.url.path}"
    rule_table = _select_rule_table(request.method.upper(), request.url.path)

    errors: list[dict[str, Any]] = []
    for item in exc.errors():
        loc = list[Any](item.get("loc", []))
        error_type = str(item.get("type", "value_error"))
        field = _field_from_loc(loc)
        rule_key = (field or "", error_type)
        rule: StableError = rule_table.get(rule_key, COMMON_000)

        errors.append(
            {
                "code": rule.code,
                "key": rule.key,
                "message": rule.message,
                "field": field,
                "source": "validation",
                "details": {
                    "type": error_type,
                    "loc": _json_safe(loc),
                    "input": _json_safe(item.get("input")),
                    "ctx": _json_safe(item.get("ctx")),
                },
            }
        )

    return {"error_type": "validation_error", "endpoint": endpoint, "errors": errors}
