"""Schedule domain ``SCHED_*`` stable errors + validation rule maps for query params."""

from __future__ import annotations

from app.errors.types import StableError

# --- Validation (422) — shared query params ---------------------------------

SCHED_001 = StableError(
    "SCHED_001",
    "SCHEDULE_QUERY_SYSTEM_USER_ID_REQUIRED",
    "Query parameter `system_user_id` is required.",
)
SCHED_002 = StableError(
    "SCHED_002",
    "SCHEDULE_QUERY_SYSTEM_USER_ID_INVALID",
    "Query parameter `system_user_id` must not be empty.",
)
SCHED_003 = StableError(
    "SCHED_003",
    "SCHEDULE_QUERY_SYSTEM_UUID_REQUIRED",
    "Query parameter `system_uuid` is required.",
)
SCHED_004 = StableError(
    "SCHED_004",
    "SCHEDULE_QUERY_SYSTEM_UUID_INVALID",
    "Query parameter `system_uuid` must be a valid UUID.",
)

# --- Validation (422) — /schedule/preview specific --------------------------

SCHED_010 = StableError(
    "SCHED_010",
    "SCHEDULE_PREVIEW_WINDOW_INVALID",
    "Query parameter `window` must be one of `PT1H`, `PT4H`, `PT24H`, `P1D`.",
)
SCHED_011 = StableError(
    "SCHED_011",
    "SCHEDULE_PREVIEW_LIMIT_INVALID",
    "Query parameter `limit` must be an integer in range [1, 100].",
)
SCHED_012 = StableError(
    "SCHED_012",
    "SCHEDULE_PREVIEW_RANDOM_SEED_INVALID",
    "Query parameter `random_seed` must match `[A-Za-z0-9_-]{1,64}`.",
)


SCHEDULE_SUMMARY_VALIDATION_RULES: dict[tuple[str, str], StableError] = {
    ("system_user_id", "missing"): SCHED_001,
    ("system_user_id", "string_too_short"): SCHED_002,
    ("system_uuid", "missing"): SCHED_003,
    ("system_uuid", "uuid_parsing"): SCHED_004,
    ("system_uuid", "uuid_type"): SCHED_004,
}


SCHEDULE_PREVIEW_VALIDATION_RULES: dict[tuple[str, str], StableError] = {
    ("system_user_id", "missing"): SCHED_001,
    ("system_user_id", "string_too_short"): SCHED_002,
    ("system_uuid", "missing"): SCHED_003,
    ("system_uuid", "uuid_parsing"): SCHED_004,
    ("system_uuid", "uuid_type"): SCHED_004,
    ("window", "literal_error"): SCHED_010,
    ("window", "enum"): SCHED_010,
    ("limit", "int_parsing"): SCHED_011,
    ("limit", "greater_than_equal"): SCHED_011,
    ("limit", "less_than_equal"): SCHED_011,
    ("random_seed", "string_pattern_mismatch"): SCHED_012,
    ("random_seed", "string_too_long"): SCHED_012,
    ("random_seed", "string_too_short"): SCHED_012,
}
