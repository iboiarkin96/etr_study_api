"""OpenAPI enrichment: document validation-error schemas (HTTPValidationError, ValidationError)."""

from __future__ import annotations

from typing import Any

_HTTP_VALIDATION_ERROR_DESC = (
    "Wrapper returned for HTTP 422 responses. The ``detail`` array carries one "
    "**ValidationError** per failing field, mirroring the FastAPI / Pydantic v2 contract. "
    "Clients should render each entry's ``loc`` and ``msg`` to guide the user."
)

_VALIDATION_ERROR_DESC = (
    "Single field-level validation failure. ``loc`` is the JSON path inside the request body "
    "or query that triggered the error; ``msg`` is a human-readable message; ``type`` is the "
    "Pydantic error code (for example ``string_too_short``); ``input`` and ``ctx`` are present "
    "when Pydantic supplies them."
)


def enrich_openapi_with_validation_error_descriptions(schema: dict[str, Any]) -> None:
    """Add ``description`` to the auto-generated validation-error schemas.

    FastAPI / Pydantic emit ``HTTPValidationError`` and ``ValidationError`` without a
    ``description`` field, which degrades introspection in Swagger UI / Scalar and
    downstream client generators. This helper fills that gap idempotently — pre-existing
    descriptions are preserved.

    Args:
        schema: OpenAPI document produced by :func:`fastapi.openapi.utils.get_openapi`.
    """
    components = schema.get("components")
    if not isinstance(components, dict):
        return
    schemas = components.get("schemas")
    if not isinstance(schemas, dict):
        return

    _set_description_if_missing(schemas, "HTTPValidationError", _HTTP_VALIDATION_ERROR_DESC)
    _set_description_if_missing(schemas, "ValidationError", _VALIDATION_ERROR_DESC)


def _set_description_if_missing(schemas: dict[str, Any], name: str, description: str) -> None:
    entry = schemas.get(name)
    if not isinstance(entry, dict):
        return
    if entry.get("description"):
        return
    entry["description"] = description
