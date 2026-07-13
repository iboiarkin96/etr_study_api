"""OpenAPI governance: lint + canon parity + runtime-spec regeneration.

Two artefacts, two purposes (per ADR 0036):

* **Canon** (`etr_study_app/merged-spec.json`) — analyst-authored contract,
  the source of truth for what the product API *should* be. Grown by
  hand-authored fragments under `openapi/etr_study_app/fragments/`.
* **Runtime spec** (`openapi.json` in the public portal) — dev artefact,
  the real thing `app.openapi()` emits. Auto-regenerated on `make docs-fix`
  and consumed by the public Scalar explorer; never hand-edited, never
  reviewed as a diff.

`command_check` enforces canon ⊆ code ⊆ canon∪exceptions; `command_regen`
refreshes the runtime spec so it never lags the code.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
# Runtime spec: dev-generated dump of `app.openapi()`, consumed by the public
# Scalar explorer. Regenerated on `make docs-fix` — never hand-edited.
RUNTIME_SPEC_PATH = ROOT / "services" / "portal" / "public" / "reference" / "api" / "openapi.json"
# ADR 0036 — the etr_study_app canon is the source of truth for product-facing
# operations. `openapi-check` compares the FastAPI runtime spec against this
# merged document so drift between the API-first canon and the shipped code
# fails CI instead of accumulating silently.
CANON_PATH = (
    ROOT
    / "services"
    / "portal"
    / "internal"
    / "services"
    / "api"
    / "openapi"
    / "etr_study_app"
    / "merged-spec.json"
)
# Operations that live in the FastAPI runtime spec but are intentionally *not*
# in the product canon:
#   - `/live`, `/ready`: Kubernetes-style health probes, no client contract.
# Every entry here is a red flag reviewable in each PR. Shrinks as canon grows.
KNOWN_NON_CANON_OPERATIONS: set[tuple[str, str]] = {
    ("get", "/live"),
    ("get", "/ready"),
}
HTTP_METHODS = {"get", "post", "put", "patch", "delete", "options", "head", "trace"}


def _ensure_minimal_env_for_app_import() -> None:
    """Set a placeholder ``DATABASE_URL`` if unset so ``app.main`` can import.

    The SQLAlchemy engine is lazy — this DSN never gets connected during import.
    Per ADR 0037; SQLite temp-file handling was removed here.

    Side effects:
        Mutates ``os.environ`` when ``DATABASE_URL`` is empty.
    """
    if os.environ.get("DATABASE_URL", "").strip():
        return
    os.environ["DATABASE_URL"] = "postgresql+psycopg://study_app:study_app@127.0.0.1:5432/study_app"


def _load_current_openapi() -> dict[str, Any]:
    """Import the FastAPI app and return its live OpenAPI schema dict.

    Returns:
        JSON-serializable OpenAPI document from :meth:`fastapi.FastAPI.openapi`.

    Note:
        Inserts :data:`ROOT` at the front of ``sys.path`` temporarily.
    """
    _ensure_minimal_env_for_app_import()
    sys.path.insert(0, str(ROOT / "services" / "api"))
    from app.main import app  # noqa: WPS433

    return app.openapi()


def _load_canon() -> dict[str, Any]:
    """Read the etr_study_app canon (merged fragments) JSON from disk.

    Returns:
        Parsed canon document.

    Raises:
        FileNotFoundError: If :data:`CANON_PATH` does not exist.
    """
    if not CANON_PATH.exists():
        raise FileNotFoundError(
            f"Canon not found: {CANON_PATH}. Regenerate with: make -C services/portal api-check"
        )
    return json.loads(CANON_PATH.read_text(encoding="utf-8"))


def _find_operation(spec: dict[str, Any], path: str, method: str) -> dict[str, Any]:
    """Return the operation dict for ``(path, method)`` or an empty dict if absent.

    Args:
        spec: OpenAPI document.
        path: URL template as it appears under ``paths``.
        method: Lower-cased HTTP method.

    Returns:
        The operation object, or an empty dict when either the path or method is missing.
    """
    path_item = spec.get("paths", {}).get(path)
    if not isinstance(path_item, dict):
        return {}
    op = path_item.get(method)
    return op if isinstance(op, dict) else {}


def _implementation_status(operation: dict[str, Any]) -> str:
    """Return the ``x-implementation-status`` of a canon operation.

    Values:
        - ``"shipped"`` (default when omitted): the code implements this operation.
          Parity gate enforces canon ⊆ code for it.
        - ``"pending"``: aspirational — canon-first, code hasn't landed yet.
          The «canon operation missing in code» check is skipped; all other
          checks still apply if the code does add the operation.

    Args:
        operation: OpenAPI operation object from the canon.

    Returns:
        The status string; ``"shipped"`` for missing/unknown values.
    """
    status = operation.get("x-implementation-status")
    if not isinstance(status, str) or status not in {"shipped", "pending"}:
        return "shipped"
    return status


def _write_runtime_spec(spec: dict[str, Any]) -> None:
    """Write ``spec`` to :data:`RUNTIME_SPEC_PATH` with stable JSON formatting.

    Args:
        spec: Full OpenAPI document to persist.
    """
    RUNTIME_SPEC_PATH.parent.mkdir(parents=True, exist_ok=True)
    RUNTIME_SPEC_PATH.write_text(
        json.dumps(spec, ensure_ascii=True, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _iter_operations(spec: dict[str, Any]):
    """Yield ``(path, method, operation_dict)`` for each HTTP operation in ``spec``.

    Args:
        spec: OpenAPI document containing a ``paths`` object.

    Yields:
        Path string, lowercased method name, and operation object.
    """
    for path, path_item in spec.get("paths", {}).items():
        if not isinstance(path_item, dict):
            continue
        for method, operation in path_item.items():
            if method.lower() not in HTTP_METHODS or not isinstance(operation, dict):
                continue
            yield path, method.lower(), operation


def _resolve_schema(schema: dict[str, Any] | None, spec: dict[str, Any]) -> dict[str, Any]:
    """Inline ``$ref`` and merge simple ``allOf`` fragments into one schema dict.

    Args:
        schema: Possibly partial schema object from OpenAPI.
        spec: Full root document for resolving internal ``#/`` references.

    Returns:
        Resolved schema dict, or empty dict if resolution fails.
    """
    if not isinstance(schema, dict):
        return {}
    resolved = dict(schema)
    while "$ref" in resolved:
        ref = resolved["$ref"]
        if not isinstance(ref, str) or not ref.startswith("#/"):
            return resolved
        node: Any = spec
        for part in ref[2:].split("/"):
            node = node.get(part) if isinstance(node, dict) else None
            if node is None:
                return {}
        if not isinstance(node, dict):
            return {}
        resolved = {**node, **{k: v for k, v in resolved.items() if k != "$ref"}}
    if "allOf" in resolved and isinstance(resolved["allOf"], list):
        merged: dict[str, Any] = {k: v for k, v in resolved.items() if k != "allOf"}
        required: set[str] = set(merged.get("required", []))
        properties: dict[str, Any] = dict(merged.get("properties", {}))
        for part in resolved["allOf"]:
            child = _resolve_schema(part if isinstance(part, dict) else {}, spec)
            required.update(child.get("required", []))
            properties.update(child.get("properties", {}))
        if required:
            merged["required"] = sorted(required)
        if properties:
            merged["properties"] = properties
        return merged
    return resolved


def _json_request_schema(operation: dict[str, Any], spec: dict[str, Any]) -> dict[str, Any]:
    """Resolve ``application/json`` request body schema for an operation.

    Args:
        operation: OpenAPI operation object.
        spec: Full document for ``$ref`` resolution.

    Returns:
        Resolved JSON Schema object, or empty dict if none.
    """
    body = operation.get("requestBody")
    if not isinstance(body, dict):
        return {}
    content = body.get("content")
    if not isinstance(content, dict):
        return {}
    app_json = content.get("application/json")
    if not isinstance(app_json, dict):
        return {}
    return _resolve_schema(app_json.get("schema"), spec)


def _json_response_schema(
    operation: dict[str, Any], status: str, spec: dict[str, Any]
) -> dict[str, Any]:
    """Resolve ``application/json`` response schema for a given HTTP status code.

    Args:
        operation: OpenAPI operation object.
        status: Response key (e.g. ``"200"``, ``"422"``).
        spec: Full document for ``$ref`` resolution.

    Returns:
        Resolved JSON Schema for the response body, or empty dict.
    """
    responses = operation.get("responses", {})
    if not isinstance(responses, dict):
        return {}
    payload = responses.get(status)
    if not isinstance(payload, dict):
        return {}
    content = payload.get("content")
    if not isinstance(content, dict):
        return {}
    app_json = content.get("application/json")
    if not isinstance(app_json, dict):
        return {}
    return _resolve_schema(app_json.get("schema"), spec)


def _required_fields(schema: dict[str, Any]) -> set[str]:
    """Return the set of required property names declared on a JSON Schema object.

    Args:
        schema: Object schema with optional ``required`` list.

    Returns:
        Set of field names; empty if ``required`` is missing or invalid.
    """
    required = schema.get("required", [])
    if not isinstance(required, list):
        return set()
    return {item for item in required if isinstance(item, str)}


def run_lint(spec: dict[str, Any]) -> list[str]:
    """Validate OpenAPI conventions: unique ``operationId``, summaries, 422 examples for writes.

    Args:
        spec: OpenAPI document to lint.

    Returns:
        Human-readable issue strings (empty if no problems).
    """
    issues: list[str] = []
    operation_ids: set[str] = set()
    for path, method, operation in _iter_operations(spec):
        op_id = operation.get("operationId")
        if not isinstance(op_id, str) or not op_id.strip():
            issues.append(f"{method.upper()} {path}: missing operationId")
        elif op_id in operation_ids:
            issues.append(f"{method.upper()} {path}: duplicate operationId '{op_id}'")
        else:
            operation_ids.add(op_id)

        summary = operation.get("summary")
        if not isinstance(summary, str) or not summary.strip():
            issues.append(f"{method.upper()} {path}: missing summary")

        responses = operation.get("responses")
        if not isinstance(responses, dict) or not responses:
            issues.append(f"{method.upper()} {path}: missing responses")
            continue

        if method in {"post", "put", "patch", "delete"}:
            if "422" not in responses:
                issues.append(f"{method.upper()} {path}: missing 422 response")
            else:
                content = responses.get("422", {}).get("content", {})
                examples = (
                    content.get("application/json", {}).get("examples", {})
                    if isinstance(content, dict)
                    else {}
                )
                if not isinstance(examples, dict) or not examples:
                    issues.append(f"{method.upper()} {path}: 422 response should include examples")
    return issues


def _param_key(parameter: dict[str, Any]) -> tuple[str, str]:
    """Stable tuple identity for an OpenAPI parameter (name + location).

    Args:
        parameter: Parameter object from ``operation["parameters"]``.

    Returns:
        ``(name, location)`` strings.
    """
    return str(parameter.get("name", "")), str(parameter.get("in", ""))


def _required_parameters(operation: dict[str, Any]) -> dict[tuple[str, str], bool]:
    """Map each parameter (name, in) to whether it is required.

    Args:
        operation: OpenAPI operation object.

    Returns:
        Dict keyed by :func:`_param_key` with boolean required flags.
    """
    result: dict[tuple[str, str], bool] = {}
    params = operation.get("parameters", [])
    if not isinstance(params, list):
        return result
    for item in params:
        if not isinstance(item, dict):
            continue
        result[_param_key(item)] = bool(item.get("required", False))
    return result


def run_parity_check(
    canon: dict[str, Any],
    current: dict[str, Any],
    non_canon: set[tuple[str, str]] | None = None,
) -> list[str]:
    """Ensure the FastAPI runtime spec is in parity with the API-first canon.

    Semantics:

    * Every operation declared in ``canon`` with
      ``x-implementation-status: shipped`` (or omitted — that's the default)
      must exist in ``current``. Fragments tagged
      ``x-implementation-status: pending`` are aspirational (canon-first,
      code hasn't caught up yet) and are exempt from this check — but if the
      operation *does* land in code, all other parity checks still apply.
    * Every operation in ``current`` must either be declared in ``canon`` or be
      listed in ``non_canon`` exceptions (health probes, telemetry). Anything
      else is silent drift and must be brought into canon or explicitly excluded.
    * For operations present in both, the code must not weaken the canon
      contract: canon-required parameters and request-body fields must stay
      required in code, and every canon-documented response status must be
      reachable in code.

    Args:
        canon: Merged canon document (see :data:`CANON_PATH`).
        current: FastAPI runtime OpenAPI document.
        non_canon: Set of ``(method_lower, path)`` tuples explicitly exempted
            from the "must be in canon" rule.

    Returns:
        Human-readable parity issues; empty when code and canon agree.
    """
    exceptions = non_canon or set()
    issues: list[str] = []

    canon_ops = {(method, path) for path, method, _ in _iter_operations(canon)}
    curr_ops = {(method, path) for path, method, _ in _iter_operations(current)}

    for method, path in sorted(canon_ops - curr_ops):
        canon_op = _find_operation(canon, path, method)
        # Aspirational canon (canon-first, code hasn't landed yet) is intentional.
        # The parity gate only flags shipped ops the code has silently dropped.
        if _implementation_status(canon_op) == "pending":
            continue
        issues.append(
            f"Canon operation missing in code: {method.upper()} {path}. "
            "If aspirational, tag the fragment with `x-implementation-status: pending`."
        )

    for method, path in sorted((curr_ops - canon_ops) - exceptions):
        issues.append(
            f"Operation in code but not in canon or exceptions: {method.upper()} {path}. "
            "Either back-fill it into openapi/etr_study_app/fragments/ or add to "
            "KNOWN_NON_CANON_OPERATIONS."
        )

    for method, path in sorted(canon_ops & curr_ops):
        canon_op = _find_operation(canon, path, method)
        curr_op = _find_operation(current, path, method)

        canon_id = canon_op.get("operationId")
        curr_id = curr_op.get("operationId")
        if isinstance(canon_id, str) and isinstance(curr_id, str) and canon_id != curr_id:
            issues.append(
                f"operationId mismatch for {method.upper()} {path}: "
                f"canon={canon_id!r} vs code={curr_id!r}"
            )

        canon_params = _required_parameters(canon_op)
        curr_params = _required_parameters(curr_op)
        for pkey, was_required in sorted(canon_params.items()):
            if was_required and not curr_params.get(pkey, False):
                issues.append(
                    f"Canon-required parameter '{pkey[0]}' (in={pkey[1]}) is missing or "
                    f"optional in code for {method.upper()} {path}"
                )

        canon_req_body = _required_fields(_json_request_schema(canon_op, canon))
        curr_req_body = _required_fields(_json_request_schema(curr_op, current))
        for field in sorted(canon_req_body - curr_req_body):
            issues.append(
                f"Canon-required request field '{field}' is missing or optional in code for "
                f"{method.upper()} {path}"
            )

        canon_codes = {str(code) for code in canon_op.get("responses", {}).keys()}
        curr_codes = {str(code) for code in curr_op.get("responses", {}).keys()}
        for code in sorted(canon_codes - curr_codes):
            issues.append(
                f"Canon-documented response {code} is missing in code for {method.upper()} {path}"
            )

        # 2xx response-schema parity: canon-required fields must stay required
        # in code. This closes the drift window where a spec page says «field X
        # is always present in 200» but the runtime drops it to optional.
        for code in sorted(canon_codes & curr_codes):
            if not code.startswith("2"):
                continue
            canon_resp = _required_fields(_json_response_schema(canon_op, code, canon))
            curr_resp = _required_fields(_json_response_schema(curr_op, code, current))
            for field in sorted(canon_resp - curr_resp):
                issues.append(
                    f"Canon-required response field '{field}' is missing or optional in "
                    f"code for {method.upper()} {path} [{code}]"
                )

    return issues


def _print_issues(title: str, issues: list[str]) -> None:
    """Print a pass/fail summary and bullet list of issues to stdout.

    Args:
        title: Short name of the check (e.g. ``OpenAPI lint``).
        issues: Non-empty to print failures; empty prints a checkmark line.
    """
    if not issues:
        print(f"✓ {title}: passed")
        return
    print(f"✗ {title}: {len(issues)} issue(s)")
    for item in issues:
        print(f"  - {item}")


def command_check() -> int:
    """Run lint + canon-parity checks against the ``etr_study_app`` canon.

    Route C of the API-first stack: the shipped FastAPI spec must stay in
    parity with the hand-authored canon. Non-product endpoints (health probes,
    telemetry) are allow-listed via :data:`KNOWN_NON_CANON_OPERATIONS`.

    Returns:
        ``0`` if both pass, ``1`` if either reports issues.
    """
    current = _load_current_openapi()
    canon = _load_canon()

    lint_issues = run_lint(current)
    parity_issues = run_parity_check(canon, current, KNOWN_NON_CANON_OPERATIONS)

    _print_issues("OpenAPI lint", lint_issues)
    _print_issues("OpenAPI canon parity (etr_study_app)", parity_issues)

    return 1 if lint_issues or parity_issues else 0


def command_regen() -> int:
    """Regenerate the runtime spec file from the current FastAPI app.

    Called from ``make docs-fix`` so the public Scalar explorer always renders
    the real code. Never a review gate — canon parity lives in ``check``.

    Returns:
        Always ``0`` after a successful write.
    """
    current = _load_current_openapi()
    _write_runtime_spec(current)
    print(f"✓ Runtime OpenAPI spec regenerated: {RUNTIME_SPEC_PATH}")
    return 0


def main() -> None:
    """Dispatch ``check`` or ``regen`` subcommands."""
    parser = argparse.ArgumentParser(
        description="OpenAPI governance: canon parity + runtime-spec regeneration."
    )
    parser.add_argument(
        "command",
        choices=["check", "regen"],
        help=(
            "check → lint + canon parity against etr_study_app/merged-spec.json. "
            "regen → refresh public/reference/api/openapi.json from app.openapi()."
        ),
    )
    args = parser.parse_args()

    if args.command == "check":
        raise SystemExit(command_check())
    raise SystemExit(command_regen())


if __name__ == "__main__":
    main()
