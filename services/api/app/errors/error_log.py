"""Error-log domain ``ERR_*`` stable errors + validation rule map."""

from __future__ import annotations

from app.errors.types import StableError

# --- Business (non-422) ------------------------------------------------------

ERR_404 = StableError(
    "ERR_404",
    "ERROR_LOG_REFERENCE_NOT_FOUND",
    "Referenced `conspectus_uuid` or `review_log_id` is not owned by this user.",
)

# --- Validation (422) — create body ------------------------------------------

ERR_001 = StableError(
    "ERR_001",
    "ERROR_LOG_CREATE_SYSTEM_USER_ID_REQUIRED",
    "Field `system_user_id` is required.",
)
ERR_002 = StableError(
    "ERR_002",
    "ERROR_LOG_CREATE_SYSTEM_USER_ID_INVALID",
    "Field `system_user_id` must not be empty.",
)
ERR_003 = StableError(
    "ERR_003",
    "ERROR_LOG_CREATE_SYSTEM_UUID_REQUIRED",
    "Field `system_uuid` is required.",
)
ERR_004 = StableError(
    "ERR_004",
    "ERROR_LOG_CREATE_SYSTEM_UUID_INVALID",
    "Field `system_uuid` must be a valid UUID.",
)
ERR_005 = StableError(
    "ERR_005",
    "ERROR_LOG_CREATE_MESSAGE_REQUIRED",
    "Field `message` is required.",
)
ERR_006 = StableError(
    "ERR_006",
    "ERROR_LOG_CREATE_MESSAGE_TOO_SHORT",
    "Field `message` must not be empty.",
)
ERR_007 = StableError(
    "ERR_007",
    "ERROR_LOG_CREATE_MESSAGE_TOO_LONG",
    "Field `message` exceeds max length.",
)
ERR_008 = StableError(
    "ERR_008",
    "ERROR_LOG_CREATE_CONSPECTUS_UUID_INVALID",
    "Field `conspectus_uuid` must be a valid UUID.",
)
ERR_009 = StableError(
    "ERR_009",
    "ERROR_LOG_CREATE_REVIEW_LOG_ID_INVALID",
    "Field `review_log_id` must be an integer >= 1.",
)


CREATE_ERROR_LOG_VALIDATION_RULES: dict[tuple[str, str], StableError] = {
    ("system_user_id", "missing"): ERR_001,
    ("system_user_id", "string_too_short"): ERR_002,
    ("system_uuid", "missing"): ERR_003,
    ("system_uuid", "uuid_parsing"): ERR_004,
    ("system_uuid", "uuid_type"): ERR_004,
    ("message", "missing"): ERR_005,
    ("message", "string_too_short"): ERR_006,
    ("message", "value_error"): ERR_006,
    ("message", "string_too_long"): ERR_007,
    ("conspectus_uuid", "uuid_parsing"): ERR_008,
    ("conspectus_uuid", "uuid_type"): ERR_008,
    ("review_log_id", "int_parsing"): ERR_009,
    ("review_log_id", "greater_than_equal"): ERR_009,
}


LIST_ERROR_LOG_VALIDATION_RULES: dict[tuple[str, str], StableError] = {
    ("system_user_id", "missing"): ERR_001,
    ("system_user_id", "string_too_short"): ERR_002,
    ("system_uuid", "missing"): ERR_003,
    ("system_uuid", "uuid_parsing"): ERR_004,
    ("system_uuid", "uuid_type"): ERR_004,
    ("conspectus_uuid", "uuid_parsing"): ERR_008,
    ("conspectus_uuid", "uuid_type"): ERR_008,
}
