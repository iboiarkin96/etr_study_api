"""OpenAPI examples for the Error-log endpoints."""

from __future__ import annotations

from typing import Final, cast

from app.errors.error_log import ERR_001, ERR_005, ERR_007, ERR_008, ERR_404
from app.openapi.examples.errors import _validation_error_example

_SYSTEM_USER_ID = "134tg"
_SYSTEM_UUID = "b2c3d4e5-0002-4000-8000-000000000002"
_CONSPECTUS_UUID = "aa11bb22-1111-4000-8000-111111110001"

_CREATE_ENDPOINT = "POST /api/v1/errors"

# --- Request body examples ---------------------------------------------------

ERROR_LOG_CREATE_REQUEST_EXAMPLES: Final[dict[str, dict[str, object]]] = {
    "standalone": {
        "summary": "Standalone mistake (no linked note)",
        "value": {
            "system_user_id": _SYSTEM_USER_ID,
            "system_uuid": _SYSTEM_UUID,
            "message": "Confused the auth-code flow with the implicit flow.",
        },
    },
    "linked_to_conspectus": {
        "summary": "Linked to the note that surfaced the mistake",
        "value": {
            "system_user_id": _SYSTEM_USER_ID,
            "system_uuid": _SYSTEM_UUID,
            "message": "Called the token endpoint before verifying state.",
            "conspectus_uuid": _CONSPECTUS_UUID,
        },
    },
}

# --- Business-error example --------------------------------------------------

ERROR_LOG_REFERENCE_NOT_FOUND_EXAMPLE: Final[dict[str, object]] = cast(
    dict[str, object], ERR_404.as_detail("business")
)

# --- 422 examples ------------------------------------------------------------

ERROR_LOG_CREATE_VALIDATION_ERROR_EXAMPLES: Final[dict[str, dict[str, object]]] = {
    "missing_system_user_id": {
        "summary": "Missing required field system_user_id",
        "value": _validation_error_example(
            ERR_001,
            endpoint=_CREATE_ENDPOINT,
            field="system_user_id",
            error_type="missing",
            loc=["body", "system_user_id"],
            input_value={"system_uuid": _SYSTEM_UUID, "message": "hello"},
            ctx=None,
        ),
    },
    "missing_message": {
        "summary": "Missing required field message",
        "value": _validation_error_example(
            ERR_005,
            endpoint=_CREATE_ENDPOINT,
            field="message",
            error_type="missing",
            loc=["body", "message"],
            input_value={"system_user_id": _SYSTEM_USER_ID, "system_uuid": _SYSTEM_UUID},
            ctx=None,
        ),
    },
    "message_too_long": {
        "summary": "message exceeds max length",
        "value": _validation_error_example(
            ERR_007,
            endpoint=_CREATE_ENDPOINT,
            field="message",
            error_type="string_too_long",
            loc=["body", "message"],
            input_value="x" * 2001,
            ctx={"max_length": 2000},
        ),
    },
    "bad_conspectus_uuid": {
        "summary": "conspectus_uuid is not a UUID",
        "value": _validation_error_example(
            ERR_008,
            endpoint=_CREATE_ENDPOINT,
            field="conspectus_uuid",
            error_type="uuid_parsing",
            loc=["body", "conspectus_uuid"],
            input_value="not-a-uuid",
            ctx={
                "error": "invalid character: expected an optional prefix of `urn:uuid:` followed by [0-9a-fA-F-], found `n` at 1"
            },
        ),
    },
}
