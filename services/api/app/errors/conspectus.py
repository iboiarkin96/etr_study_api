"""Conspectus domain ``CONS_*`` stable errors + Pydantic (field, error_type) rule maps."""

from __future__ import annotations

from app.errors.types import StableError

# --- Business (non-422) ------------------------------------------------------

CONS_102 = StableError(
    "CONS_102",
    "CONSPECTUS_PATCH_BODY_EMPTY",
    "PATCH body must include at least one content field to update.",
)

CONS_404 = StableError(
    "CONS_404",
    "CONSPECTUS_NOT_FOUND",
    "Conspectus does not exist or is not owned by this user.",
)

CONS_409 = StableError(
    "CONS_409",
    "CONSPECTUS_REVIEW_REVISION_CONFLICT",
    "Provided `expected_schedule_revision` does not match current schedule revision.",
)

# --- Validation (422) — create body ------------------------------------------

CONS_001 = StableError(
    "CONS_001",
    "CONSPECTUS_CREATE_SYSTEM_USER_ID_REQUIRED",
    "Field `system_user_id` is required.",
)
CONS_002 = StableError(
    "CONS_002",
    "CONSPECTUS_CREATE_SYSTEM_USER_ID_INVALID",
    "Field `system_user_id` must not be empty.",
)
CONS_003 = StableError(
    "CONS_003",
    "CONSPECTUS_CREATE_SYSTEM_UUID_REQUIRED",
    "Field `system_uuid` is required.",
)
CONS_004 = StableError(
    "CONS_004",
    "CONSPECTUS_CREATE_SYSTEM_UUID_INVALID",
    "Field `system_uuid` must be a valid UUID.",
)
CONS_005 = StableError(
    "CONS_005",
    "CONSPECTUS_CREATE_CUE_SHEET_REQUIRED",
    "Field `cue_sheet` is required.",
)
CONS_006 = StableError(
    "CONS_006",
    "CONSPECTUS_CREATE_CUE_SHEET_INVALID",
    "Field `cue_sheet` must be a JSON object.",
)
CONS_007 = StableError(
    "CONS_007",
    "CONSPECTUS_CREATE_DENSE_PARAGRAPH_REQUIRED",
    "Field `dense_paragraph` is required.",
)
CONS_008 = StableError(
    "CONS_008",
    "CONSPECTUS_CREATE_DENSE_PARAGRAPH_TOO_SHORT",
    "Field `dense_paragraph` must not be empty.",
)
CONS_009 = StableError(
    "CONS_009",
    "CONSPECTUS_CREATE_DENSE_PARAGRAPH_TOO_LONG",
    "Field `dense_paragraph` exceeds max length.",
)
CONS_010 = StableError(
    "CONS_010",
    "CONSPECTUS_CREATE_BULLETS_REQUIRED",
    "Field `bullets` is required.",
)
CONS_011 = StableError(
    "CONS_011",
    "CONSPECTUS_CREATE_BULLETS_TOO_FEW",
    "Field `bullets` must contain at least one item.",
)
CONS_012 = StableError(
    "CONS_012",
    "CONSPECTUS_CREATE_BULLETS_TOO_MANY",
    "Field `bullets` exceeds max item count.",
)
CONS_013 = StableError(
    "CONS_013",
    "CONSPECTUS_CREATE_BULLETS_ITEM_INVALID",
    "Each item in `bullets` must be a non-empty string within the max length.",
)
CONS_014 = StableError(
    "CONS_014",
    "CONSPECTUS_CREATE_TITLE_TOO_LONG",
    "Field `title` exceeds max length.",
)

# --- Validation (422) — patch body -------------------------------------------

CONS_030 = StableError(
    "CONS_030",
    "CONSPECTUS_PATCH_TITLE_TOO_LONG",
    "Field `title` exceeds max length.",
)
CONS_031 = StableError(
    "CONS_031",
    "CONSPECTUS_PATCH_CUE_SHEET_INVALID",
    "Field `cue_sheet` must be a JSON object when present.",
)
CONS_032 = StableError(
    "CONS_032",
    "CONSPECTUS_PATCH_DENSE_PARAGRAPH_TOO_SHORT",
    "Field `dense_paragraph` must not be empty.",
)
CONS_033 = StableError(
    "CONS_033",
    "CONSPECTUS_PATCH_DENSE_PARAGRAPH_TOO_LONG",
    "Field `dense_paragraph` exceeds max length.",
)
CONS_034 = StableError(
    "CONS_034",
    "CONSPECTUS_PATCH_BULLETS_TOO_FEW",
    "Field `bullets` must contain at least one item when present.",
)
CONS_035 = StableError(
    "CONS_035",
    "CONSPECTUS_PATCH_BULLETS_TOO_MANY",
    "Field `bullets` exceeds max item count.",
)
CONS_036 = StableError(
    "CONS_036",
    "CONSPECTUS_PATCH_BULLETS_ITEM_INVALID",
    "Each item in `bullets` must be a non-empty string within the max length.",
)
CONS_037 = StableError(
    "CONS_037",
    "CONSPECTUS_PATCH_NULL_REPLACEMENT",
    "Non-nullable fields must not be `null`; omit them to leave unchanged.",
)

# --- Validation (422) — delete body ------------------------------------------

CONS_050 = StableError(
    "CONS_050",
    "CONSPECTUS_DELETE_INVALIDATION_REASON_UUID_REQUIRED",
    "Field `invalidation_reason_uuid` is required.",
)
CONS_051 = StableError(
    "CONS_051",
    "CONSPECTUS_DELETE_INVALIDATION_REASON_UUID_INVALID",
    "Field `invalidation_reason_uuid` must be a valid UUID.",
)

# --- Validation (422) — review body ------------------------------------------

CONS_070 = StableError(
    "CONS_070",
    "CONSPECTUS_REVIEW_TAG_REQUIRED",
    "Field `tag` is required.",
)
CONS_071 = StableError(
    "CONS_071",
    "CONSPECTUS_REVIEW_TAG_INVALID",
    "Field `tag` must be one of `easy`, `hard`, `forgot`.",
)
CONS_072 = StableError(
    "CONS_072",
    "CONSPECTUS_REVIEW_EXPECTED_REVISION_INVALID",
    "Field `expected_schedule_revision` must be an integer >= 1.",
)

# --- (field, pydantic_error_type) -> StableError ----------------------------

CREATE_CONSPECTUS_VALIDATION_RULES: dict[tuple[str, str], StableError] = {
    ("system_user_id", "missing"): CONS_001,
    ("system_user_id", "string_too_short"): CONS_002,
    ("system_uuid", "missing"): CONS_003,
    ("system_uuid", "uuid_parsing"): CONS_004,
    ("system_uuid", "uuid_type"): CONS_004,
    ("cue_sheet", "missing"): CONS_005,
    ("cue_sheet", "dict_type"): CONS_006,
    ("cue_sheet", "model_type"): CONS_006,
    ("dense_paragraph", "missing"): CONS_007,
    ("dense_paragraph", "string_too_short"): CONS_008,
    ("dense_paragraph", "string_too_long"): CONS_009,
    ("bullets", "missing"): CONS_010,
    ("bullets", "too_short"): CONS_011,
    ("bullets", "too_long"): CONS_012,
    ("bullets", "value_error"): CONS_013,
    ("title", "string_too_long"): CONS_014,
}

PATCH_CONSPECTUS_VALIDATION_RULES: dict[tuple[str, str], StableError] = {
    ("title", "string_too_long"): CONS_030,
    ("cue_sheet", "dict_type"): CONS_031,
    ("dense_paragraph", "string_too_short"): CONS_032,
    ("dense_paragraph", "string_too_long"): CONS_033,
    ("bullets", "too_short"): CONS_034,
    ("bullets", "too_long"): CONS_035,
    ("bullets", "value_error"): CONS_036,
    # Body-level validators land under loc "__root__" / no field.
    ("", "value_error"): CONS_037,
}

DELETE_CONSPECTUS_VALIDATION_RULES: dict[tuple[str, str], StableError] = {
    ("invalidation_reason_uuid", "missing"): CONS_050,
    ("invalidation_reason_uuid", "uuid_parsing"): CONS_051,
    ("invalidation_reason_uuid", "uuid_type"): CONS_051,
}

REVIEW_CONSPECTUS_VALIDATION_RULES: dict[tuple[str, str], StableError] = {
    ("tag", "missing"): CONS_070,
    ("tag", "literal_error"): CONS_071,
    ("tag", "enum"): CONS_071,
    ("expected_schedule_revision", "int_parsing"): CONS_072,
    ("expected_schedule_revision", "greater_than_equal"): CONS_072,
}
