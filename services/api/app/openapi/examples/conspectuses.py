"""OpenAPI examples for the Conspectus endpoints — request bodies + 422 responses."""

from __future__ import annotations

from typing import Final, cast

from app.errors.conspectus import (
    CONS_001,
    CONS_005,
    CONS_007,
    CONS_010,
    CONS_037,
    CONS_050,
    CONS_070,
    CONS_071,
    CONS_072,
    CONS_102,
    CONS_404,
    CONS_409,
)
from app.openapi.examples.errors import _validation_error_example

# --- Reference values reused across bodies -----------------------------------

_SYSTEM_USER_ID = "134tg"
_SYSTEM_UUID = "b2c3d4e5-0002-4000-8000-000000000002"
_INVALIDATION_REASON_UUID = "c3d4e5f6-0003-4000-8000-000000000003"
_CONSPECTUS_UUID = "aa11bb22-1111-4000-8000-111111110001"

_CREATE_ENDPOINT = "POST /api/v1/conspectuses"
_PATCH_ENDPOINT = f"PATCH /api/v1/conspectuses/{_CONSPECTUS_UUID}"
_DELETE_ENDPOINT = f"DELETE /api/v1/conspectuses/{_CONSPECTUS_UUID}"
_REVIEW_ENDPOINT = f"POST /api/v1/conspectuses/{_CONSPECTUS_UUID}/actions/review"

# --- Request body examples ---------------------------------------------------

CONSPECTUS_CREATE_REQUEST_EXAMPLES: Final[dict[str, dict[str, object]]] = {
    "default": {
        "summary": "Full ETR note",
        "value": {
            "system_user_id": _SYSTEM_USER_ID,
            "system_uuid": _SYSTEM_UUID,
            "title": "OAuth 2.0 authorisation code flow",
            "cue_sheet": {
                "terms": ["PKCE", "authorisation code"],
                "questions": ["What does the state parameter protect against?"],
            },
            "dense_paragraph": (
                "The auth-code flow trades an opaque code for tokens on the server side. "
                "PKCE binds the code to a device via a hashed code verifier."
            ),
            "bullets": [
                "Client redirects to /authorize with code_challenge",
                "User authenticates and consents",
                "Auth server returns a code",
                "Server exchanges code + code_verifier for tokens",
            ],
        },
    },
    "minimal": {
        "summary": "No title, single bullet",
        "value": {
            "system_user_id": _SYSTEM_USER_ID,
            "system_uuid": _SYSTEM_UUID,
            "cue_sheet": {"terms": ["ETR"]},
            "dense_paragraph": "Encode-Trigger-Recall study loop.",
            "bullets": ["encode -> trigger -> recall"],
        },
    },
}

CONSPECTUS_PATCH_REQUEST_EXAMPLES: Final[dict[str, dict[str, object]]] = {
    "title_only": {
        "summary": "Rename the note",
        "value": {
            "system_user_id": _SYSTEM_USER_ID,
            "system_uuid": _SYSTEM_UUID,
            "title": "OAuth 2.1 — auth code + PKCE",
        },
    },
    "clear_title": {
        "summary": "Clear the title (title is nullable)",
        "value": {
            "system_user_id": _SYSTEM_USER_ID,
            "system_uuid": _SYSTEM_UUID,
            "title": None,
        },
    },
    "rewrite_content": {
        "summary": "Replace body and bullets in one call",
        "value": {
            "system_user_id": _SYSTEM_USER_ID,
            "system_uuid": _SYSTEM_UUID,
            "dense_paragraph": "Tightened summary after the second reading.",
            "bullets": [
                "PKCE is mandatory in 2.1",
                "Implicit flow is removed",
            ],
        },
    },
}

CONSPECTUS_DELETE_REQUEST_EXAMPLES: Final[dict[str, dict[str, object]]] = {
    "default": {
        "summary": "Archive with a reason",
        "value": {
            "system_user_id": _SYSTEM_USER_ID,
            "system_uuid": _SYSTEM_UUID,
            "invalidation_reason_uuid": _INVALIDATION_REASON_UUID,
        },
    },
}

CONSPECTUS_REVIEW_REQUEST_EXAMPLES: Final[dict[str, dict[str, object]]] = {
    "easy": {
        "summary": "Recalled effortlessly — advance the ladder",
        "value": {
            "system_user_id": _SYSTEM_USER_ID,
            "system_uuid": _SYSTEM_UUID,
            "tag": "easy",
        },
    },
    "hard_with_cas": {
        "summary": "Struggled to recall, using optimistic concurrency control",
        "value": {
            "system_user_id": _SYSTEM_USER_ID,
            "system_uuid": _SYSTEM_UUID,
            "tag": "hard",
            "expected_schedule_revision": 3,
        },
    },
    "forgot": {
        "summary": "Reset to slot A",
        "value": {
            "system_user_id": _SYSTEM_USER_ID,
            "system_uuid": _SYSTEM_UUID,
            "tag": "forgot",
        },
    },
}

# --- Business-error examples -------------------------------------------------

CONSPECTUS_PATCH_BODY_EMPTY_EXAMPLE: Final[dict[str, object]] = cast(
    dict[str, object], CONS_102.as_detail("business")
)
CONSPECTUS_NOT_FOUND_ERROR_EXAMPLE: Final[dict[str, object]] = cast(
    dict[str, object], CONS_404.as_detail("business")
)
CONSPECTUS_REVIEW_REVISION_CONFLICT_EXAMPLE: Final[dict[str, object]] = cast(
    dict[str, object], CONS_409.as_detail("business")
)

# --- 422 examples ------------------------------------------------------------

CONSPECTUS_CREATE_VALIDATION_ERROR_EXAMPLES: Final[dict[str, dict[str, object]]] = {
    "missing_system_user_id": {
        "summary": "Missing required field system_user_id",
        "value": _validation_error_example(
            CONS_001,
            endpoint=_CREATE_ENDPOINT,
            field="system_user_id",
            error_type="missing",
            loc=["body", "system_user_id"],
            input_value={"system_uuid": _SYSTEM_UUID},
            ctx=None,
        ),
    },
    "missing_cue_sheet": {
        "summary": "Missing required field cue_sheet",
        "value": _validation_error_example(
            CONS_005,
            endpoint=_CREATE_ENDPOINT,
            field="cue_sheet",
            error_type="missing",
            loc=["body", "cue_sheet"],
            input_value={"system_user_id": _SYSTEM_USER_ID, "system_uuid": _SYSTEM_UUID},
            ctx=None,
        ),
    },
    "empty_dense_paragraph": {
        "summary": "dense_paragraph is empty",
        "value": _validation_error_example(
            CONS_007,
            endpoint=_CREATE_ENDPOINT,
            field="dense_paragraph",
            error_type="missing",
            loc=["body", "dense_paragraph"],
            input_value={"system_user_id": _SYSTEM_USER_ID, "system_uuid": _SYSTEM_UUID},
            ctx=None,
        ),
    },
    "missing_bullets": {
        "summary": "Missing required field bullets",
        "value": _validation_error_example(
            CONS_010,
            endpoint=_CREATE_ENDPOINT,
            field="bullets",
            error_type="missing",
            loc=["body", "bullets"],
            input_value={"system_user_id": _SYSTEM_USER_ID, "system_uuid": _SYSTEM_UUID},
            ctx=None,
        ),
    },
}

CONSPECTUS_PATCH_VALIDATION_ERROR_EXAMPLES: Final[dict[str, dict[str, object]]] = {
    "null_dense_paragraph": {
        "summary": "Explicit null on non-nullable dense_paragraph",
        "value": _validation_error_example(
            CONS_037,
            endpoint=_PATCH_ENDPOINT,
            field=None,
            error_type="value_error",
            loc=["body"],
            input_value={"dense_paragraph": None},
            ctx={
                "error": "`dense_paragraph` must not be null; omit the field to leave it unchanged."
            },
        ),
    },
}

CONSPECTUS_DELETE_VALIDATION_ERROR_EXAMPLES: Final[dict[str, dict[str, object]]] = {
    "missing_reason": {
        "summary": "Missing invalidation_reason_uuid",
        "value": _validation_error_example(
            CONS_050,
            endpoint=_DELETE_ENDPOINT,
            field="invalidation_reason_uuid",
            error_type="missing",
            loc=["body", "invalidation_reason_uuid"],
            input_value={"system_user_id": _SYSTEM_USER_ID, "system_uuid": _SYSTEM_UUID},
            ctx=None,
        ),
    },
}

CONSPECTUS_REVIEW_VALIDATION_ERROR_EXAMPLES: Final[dict[str, dict[str, object]]] = {
    "missing_tag": {
        "summary": "Missing required tag",
        "value": _validation_error_example(
            CONS_070,
            endpoint=_REVIEW_ENDPOINT,
            field="tag",
            error_type="missing",
            loc=["body", "tag"],
            input_value={"system_user_id": _SYSTEM_USER_ID, "system_uuid": _SYSTEM_UUID},
            ctx=None,
        ),
    },
    "bad_tag": {
        "summary": "Invalid tag value",
        "value": _validation_error_example(
            CONS_071,
            endpoint=_REVIEW_ENDPOINT,
            field="tag",
            error_type="literal_error",
            loc=["body", "tag"],
            input_value="maybe",
            ctx={"expected": "'easy', 'hard' or 'forgot'"},
        ),
    },
    "bad_expected_revision": {
        "summary": "expected_schedule_revision below minimum",
        "value": _validation_error_example(
            CONS_072,
            endpoint=_REVIEW_ENDPOINT,
            field="expected_schedule_revision",
            error_type="greater_than_equal",
            loc=["body", "expected_schedule_revision"],
            input_value=0,
            ctx={"ge": 1},
        ),
    },
}
