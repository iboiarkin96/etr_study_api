#!/usr/bin/env python3
"""OpenAPI-driven mock server (layer 3 of the API-first toolchain).

Reads the canonical ``merged-spec.json`` produced by
``tools/governance/validate_openapi.py`` and serves every documented
operation. Documentation:
``services/portal/internal/handbook/sa/reference/api-first-toolchain.html``.

Four behaviours, all driven by the spec:

* **Default response** — first documented 2xx example.
* **Dynamic overlay** — the caller's request body (POST/PUT/PATCH) and query
  string (GET/DELETE) are overlaid on top of the picked example. Only keys
  the example already contains are overwritten; we never invent response
  fields the schema does not declare. Turn off with
  ``Prefer: dynamic=off`` when you want the raw documented example verbatim
  (useful for testing the spec, not for demoing UX).
* **Prefer header** (Stripe / RFC 7240 style) — pick a specific example or
  status:
  - ``Prefer: example=full`` → returns the example named ``full`` from the
    default success status.
  - ``Prefer: code=409`` → returns the first example of the documented 409.
  - ``Prefer: code=400, example=name_too_long`` → both at once.
* **Request body validation** — for ``POST/PUT/PATCH/DELETE`` with a body
  schema, the incoming JSON is validated against the spec's schema. Invalid
  payloads return ``400`` with our documented ``ErrorBody`` envelope
  (``{"code": "validation_error", "message": "<field>: <reason>"}``).

Usage::

    make api-mock                       # the recommended entry point
    .venv/bin/python tools/api/mock_server.py [--port 8001] [--spec PATH] [--no-reload]

Auto-reload is ON by default: uvicorn watches ``tools/api/*.py`` and every
``services/portal/internal/services/api/openapi/test/fragments/**/*.yaml``. On any
save the worker restarts, re-runs ``refresh_spec()`` (which regenerates
``merged-spec.json`` + ``fragments-index.json`` via the validator), and boots
the new Connexion app. Pass ``--no-reload`` for CI / one-shot smoke tests.

Implementation notes:
* Connexion 3.x with the Flask extra. Routes are derived from the spec at
  startup — adding a new fragment + running the validator + restarting the
  mock surfaces the new operation immediately.
* The indexer follows file-level ``$ref`` (e.g. tier-B per-resource error
  responses under ``fragments/{resource}/error-{NNN}/*.yaml``) so error
  examples are pickable via ``Prefer: code=NNN``.
* Body validation uses ``jsonschema`` (Draft 2020-12) — independent of
  Connexion's own validation, which is disabled to keep the Prefer header
  (an undeclared parameter) and other test cruft from being rejected
  pre-handler.
* CORS is permissive on purpose: Swagger UI's "Try it out" runs in a browser
  served from a different origin (the portal at ``:8080``).
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

import connexion
import yaml
from connexion.exceptions import BadRequestProblem
from connexion.lifecycle import ConnexionResponse
from connexion.middleware import MiddlewarePosition
from connexion.resolver import Resolution, Resolver
from flask import request
from starlette.middleware.cors import CORSMiddleware

REPO_ROOT = Path(__file__).resolve().parents[2]
OPENAPI_ROOT = REPO_ROOT / "services" / "portal" / "internal" / "services" / "api" / "openapi"

# Which canon tree to serve. Any subdirectory `openapi/{TREE}/fragments/` is
# a discoverable tree — the smoke `test` tree is bound to 8001 for backwards
# compatibility, real product canons get 8002, 8003, … alphabetically.
# Port allocation is delegated to the validator's `tree_port()` so the two
# tools stay in sync (single source of truth for the convention).
DEFAULT_TREE = os.environ.get("TREE") or os.environ.get("MOCK_TREE") or "test"


def _tree_port(tree_name: str) -> int:
    """Delegate to the validator's tree_port so mock ↔ merged-spec agree."""
    try:
        sys.path.insert(0, str(REPO_ROOT / "tools" / "governance"))
        from validate_openapi import tree_port as _resolve
    except ImportError:
        return 8001
    return _resolve(tree_name, str(OPENAPI_ROOT.relative_to(REPO_ROOT)))


OPENAPI_DIR = OPENAPI_ROOT / DEFAULT_TREE
DEFAULT_SPEC = OPENAPI_DIR / "merged-spec.json"
FRAGMENTS_DIR = OPENAPI_DIR / "fragments"
DEFAULT_PORT = _tree_port(DEFAULT_TREE)

# 2xx codes we'll pick the default example from, in priority order.
SUCCESS_CODES = (200, 201, 202, 203, 204)

# OperationIndex = dict[op_id, OperationIndexEntry]
# OperationIndexEntry = {
#     "request_schema": dict | None,                   # JSON Schema for the body
#     "responses": dict[int, {                         # status code (int)
#         "examples": dict[str, object],               # example_name → value
#         "default_example_name": str | None,          # first declared key
#     }],
# }

logger = logging.getLogger("mock_server")


def _load_yaml_or_json(path: Path) -> object:
    """Load YAML or JSON depending on the suffix."""
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        return json.loads(text)
    return yaml.safe_load(text)


def _resolve_ref(ref: str, base_dir: Path) -> object:
    """Resolve a relative file ``$ref`` against ``base_dir``.

    Handles ``./file.yaml``, ``./file.yaml#/fragment``, ``../file.yaml``. Returns
    the loaded sub-document (already navigated to the fragment pointer).
    Local refs (``#/components/...``) are NOT resolved here — the merger has
    already inlined them with operationId-prefixed names.
    """
    file_part, _, pointer = ref.partition("#")
    if not file_part or "://" in file_part:
        return None
    target = (base_dir / file_part).resolve()
    if not target.exists():
        return None
    doc = _load_yaml_or_json(target)
    if pointer:
        for token in pointer.lstrip("/").split("/"):
            token = token.replace("~1", "/").replace("~0", "~")
            if isinstance(doc, dict):
                doc = doc.get(token)
            elif isinstance(doc, list):
                doc = doc[int(token)] if token.isdigit() else None
            else:
                return None
    return doc


def _resolve_local_ref(ref: str, spec: dict) -> object:
    """Resolve a document-local ``$ref`` (``#/components/examples/foo``) against ``spec``."""
    if not ref.startswith("#/"):
        return None
    node: object = spec
    for token in ref[2:].split("/"):
        token = token.replace("~1", "/").replace("~0", "~")
        if isinstance(node, dict):
            node = node.get(token)
        elif isinstance(node, list):
            node = node[int(token)] if token.isdigit() else None
        else:
            return None
        if node is None:
            return None
    return node


def _maybe_resolve(node: object, base_dir: Path, spec: dict | None = None) -> object:
    """If ``node`` is ``{"$ref": "..."}``, resolve it (file OR local).

    - File refs (``./x.yaml``, ``../x.yaml``) → load and navigate.
    - Local refs (``#/components/examples/foo``) → look up in ``spec``.
    Anything else → return as-is.
    """
    if isinstance(node, dict) and "$ref" in node and len(node) == 1:
        ref = node["$ref"]
        if isinstance(ref, str) and ref.startswith("#") and spec is not None:
            resolved = _resolve_local_ref(ref, spec)
            if resolved is not None:
                return resolved
        elif isinstance(ref, str):
            resolved = _resolve_ref(ref, base_dir)
            if resolved is not None:
                return resolved
    return node


def _index_operation(op: dict, base_dir: Path, spec: dict) -> dict:
    """Build the (request_schema, responses) index for one operation."""
    responses_out: dict[int, dict] = {}
    for code_str, response in (op.get("responses") or {}).items():
        try:
            code_int = int(code_str)
        except (TypeError, ValueError):
            continue
        response = _maybe_resolve(response, base_dir, spec)
        if not isinstance(response, dict):
            continue
        content = (response.get("content") or {}).get("application/json") or {}
        examples_map: dict[str, object] = {}
        examples = content.get("examples")
        if isinstance(examples, dict):
            for name, ex in examples.items():
                # Examples can also be $refs (into #/components/examples/...).
                ex = _maybe_resolve(ex, base_dir, spec)
                if isinstance(ex, dict) and "value" in ex:
                    examples_map[name] = ex["value"]
        if not examples_map:
            schema = content.get("schema") or {}
            if isinstance(schema, dict) and "example" in schema:
                examples_map["default"] = schema["example"]
            else:
                examples_map["default"] = {}
        responses_out[code_int] = {
            "examples": examples_map,
            "default_example_name": next(iter(examples_map.keys()), None),
        }

    request_body = op.get("requestBody")
    request_schema = None
    if isinstance(request_body, dict):
        content = (request_body.get("content") or {}).get("application/json") or {}
        schema = content.get("schema")
        if isinstance(schema, dict):
            request_schema = schema

    return {"request_schema": request_schema, "responses": responses_out}


def _index_examples(spec: dict, base_dir: Path) -> dict[str, dict]:
    """Pre-walk the spec; map every operationId to its index entry."""
    out: dict[str, dict] = {}
    paths = spec.get("paths") or {}
    if not isinstance(paths, dict):
        return out
    for path_item in paths.values():
        if not isinstance(path_item, dict):
            continue
        for method, op in path_item.items():
            if method.lower() not in {
                "get",
                "post",
                "put",
                "patch",
                "delete",
                "head",
                "options",
            }:
                continue
            if not isinstance(op, dict):
                continue
            op_id = op.get("operationId")
            if not isinstance(op_id, str) or not op_id:
                continue
            out[op_id] = _index_operation(op, base_dir, spec)
    return out


def _parse_prefer(header_value: str | None) -> dict[str, str]:
    """Parse ``Prefer`` per RFC 7240: comma-separated `key=value` pairs."""
    out: dict[str, str] = {}
    if not header_value:
        return out
    for part in header_value.split(","):
        if "=" not in part:
            continue
        key, _, value = part.strip().partition("=")
        out[key.strip().lower()] = value.strip().strip('"')
    return out


def _pick_response(entry: dict, prefer: dict[str, str]) -> tuple[int, object]:
    """Pick (status, example_value) based on the Prefer header.

    Selection order:
    1. ``Prefer: code=NNN`` — use that status if documented.
    2. Otherwise: first declared SUCCESS_CODES status that's documented.
    3. Within the picked status: ``Prefer: example=NAME`` if it matches a
       documented example; otherwise the first declared example.
    """
    responses = entry.get("responses") or {}
    wanted_code = prefer.get("code") or prefer.get("status")
    code: int | None = None
    if wanted_code and wanted_code.isdigit() and int(wanted_code) in responses:
        code = int(wanted_code)
    else:
        for c in SUCCESS_CODES:
            if c in responses:
                code = c
                break
    if code is None and responses:
        code = sorted(responses.keys())[0]
    if code is None:
        return 200, {}

    examples = responses[code].get("examples") or {}
    wanted_name = prefer.get("example")
    if wanted_name and wanted_name in examples:
        return code, examples[wanted_name]
    if examples:
        return code, next(iter(examples.values()))
    return code, {}


def _overlay_dynamic(example: object, body: object, query: dict[str, str]) -> object:
    """Overlay caller input onto the picked example — Stripe-mock «echo» style.

    Keys that already exist in ``example`` are overwritten from the request
    body (POST/PUT/PATCH) and query string (GET/DELETE); we NEVER invent keys
    the response schema doesn't declare (the example is the proxy for the
    schema). Non-dict examples (arrays, scalars) are returned unchanged.

    Turn off with ``Prefer: dynamic=off`` — then the raw documented example
    is returned as-is.
    """
    if not isinstance(example, dict):
        return example
    result = dict(example)
    if isinstance(body, dict):
        for key, value in body.items():
            if key in result:
                result[key] = value
    for key, raw in query.items():
        if key in result:
            result[key] = _coerce_query(raw, result[key])
    return result


def _coerce_query(raw: str, existing: object) -> object:
    """Best-effort convert a query string value to the type of the existing example key."""
    if isinstance(existing, bool):
        return raw.lower() in {"1", "true", "yes", "on"}
    if isinstance(existing, int) and not isinstance(existing, bool):
        try:
            return int(raw)
        except ValueError:
            return raw
    if isinstance(existing, float):
        try:
            return float(raw)
        except ValueError:
            return raw
    return raw


class ExampleResolver(Resolver):
    """Connexion resolver — picks the example based on Prefer header + validates body."""

    def __init__(self, index: dict[str, dict]):
        super().__init__()
        self._index = index

    def resolve(self, operation) -> Resolution:
        op_id = operation.operation_id or "mock"
        entry = self._index.get(op_id, {"request_schema": None, "responses": {}})

        def handler(*_args, **_kwargs):
            # Body validation is handled by Connexion BEFORE this handler runs.
            # If we reach here, the body matched the spec — pick the response.
            prefer = _parse_prefer(request.headers.get("Prefer"))
            status, value = _pick_response(entry, prefer)

            if prefer.get("dynamic", "on").lower() != "off":
                body = None
                if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
                    body = request.get_json(silent=True)
                query = {k: request.args.get(k, "") for k in request.args.keys()}
                value = _overlay_dynamic(value, body, query)

            return value, status

        handler.__name__ = f"mock_{op_id}"
        return Resolution(handler, op_id)


def _bad_request_to_error_body(_request, exc: Exception) -> ConnexionResponse:
    """Map Connexion's BadRequestProblem → our documented ErrorBody envelope.

    Without this hook, Connexion returns its default Problem-Details shape
    (``{type, title, detail, status}``). We reshape it to match what the spec
    documents under ``_shared/schemas/ErrorBody.yaml``:
    ``{code, message}`` — the same shape every 4xx in our fragments uses.
    """
    detail = getattr(exc, "detail", str(exc))
    body = {"code": "validation_error", "message": detail}
    return ConnexionResponse(
        status_code=400,
        content_type="application/json",
        body=json.dumps(body).encode("utf-8"),
    )


def build_app(spec_path: Path) -> connexion.FlaskApp:
    """Construct a Connexion Flask app serving examples from ``spec_path``."""
    with spec_path.open(encoding="utf-8") as f:
        spec = json.load(f)
    index = _index_examples(spec, spec_path.parent)
    logger.info("Loaded %d operations from %s", len(index), spec_path)
    for op_id, entry in sorted(index.items()):
        statuses = sorted(entry.get("responses", {}).keys())
        examples_per_status = (
            ", ".join(
                f"{code}[{','.join(entry['responses'][code]['examples'].keys())}]"
                for code in statuses
            )
            or "(none)"
        )
        has_body = "body-schema" if entry.get("request_schema") else "no-body"
        logger.info("  · %s · %s · %s", op_id, has_body, examples_per_status)

    app = connexion.FlaskApp(__name__, specification_dir=str(spec_path.parent))
    app.add_api(
        spec_path.name,
        resolver=ExampleResolver(index),
        strict_validation=False,
        validate_responses=False,
    )
    app.add_middleware(
        CORSMiddleware,
        position=MiddlewarePosition.BEFORE_EXCEPTION,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Reshape Connexion's default Problem-Details 400 into our ErrorBody envelope.
    app.add_error_handler(BadRequestProblem, _bad_request_to_error_body)
    return app


def refresh_spec() -> None:
    """Regenerate ``merged-spec.json`` + ``fragments-index.json`` from disk.

    Called at every process boot — including uvicorn --reload restarts — so any
    edit to a fragment surfaces without a manual validator run. Failures are
    logged but do not crash the mock; it keeps serving whatever ``merged-spec.json``
    was on disk.
    """
    import importlib.util

    val_path = REPO_ROOT / "tools" / "governance" / "validate_openapi.py"
    if not val_path.exists():
        logger.warning("Validator not found at %s — spec refresh skipped", val_path)
        return
    try:
        spec_module = importlib.util.spec_from_file_location("_mock_validate_openapi", val_path)
        if spec_module is None or spec_module.loader is None:
            return
        module = importlib.util.module_from_spec(spec_module)
        spec_module.loader.exec_module(module)
        module.regenerate_index()
        module.regenerate_merged_spec()
    except Exception as exc:
        logger.warning("Spec refresh failed (%s) — falling back to on-disk merged-spec.json", exc)


def create_app(spec_path: Path = DEFAULT_SPEC) -> connexion.FlaskApp:
    """Refresh the merged spec from current fragments, then build the Connexion app.

    This is the entry point that uvicorn's ``--reload`` machinery imports as
    ``mock_server:app`` — every fresh worker process runs it end-to-end, so a
    fragment save auto-propagates to the mock's routes without a manual step.
    """
    logging.basicConfig(
        level=os.environ.get("MOCK_LOG_LEVEL", "INFO"),
        format="%(asctime)s · %(name)s · %(levelname)s · %(message)s",
    )
    refresh_spec()
    if not spec_path.exists():
        raise RuntimeError(
            f"merged-spec.json not found at {spec_path}. Refresh failed and no "
            f"prior file exists — run `make -C services/portal doc-api-swagger-check-all`."
        )
    return build_app(spec_path)


# Module-level app so that uvicorn --reload can import it as "mock_server:app".
app = create_app()


def _discover_trees() -> list[str]:
    """Return the tree names present under OPENAPI_ROOT/, alphabetical + `test` first."""
    try:
        sys.path.insert(0, str(REPO_ROOT / "tools" / "governance"))
        from validate_openapi import discover_trees
    except ImportError:
        return ["test"]
    return discover_trees(str(OPENAPI_ROOT.relative_to(REPO_ROOT)))


def _run_all_canons() -> int:
    """Fork one mock subprocess per discovered canon; wait until Ctrl-C.

    Each subprocess reruns this script with `TREE=<name>` set; the tree's
    port is picked up from the shared `tree_port()` convention. Ctrl-C
    propagates: uvicorn's own signal handler stops each child gracefully.
    """
    import signal
    import subprocess

    trees = _discover_trees()
    if not trees:
        print("⚠️  No canons discovered — nothing to serve.", flush=True)
        return 1

    procs: list[subprocess.Popen] = []
    print(f"🟢 Starting {len(trees)} mock server(s):", flush=True)
    for name in trees:
        port = _tree_port(name)
        print(f"   · {name:24} → http://127.0.0.1:{port}", flush=True)
        env = os.environ.copy()
        env["TREE"] = name
        procs.append(
            subprocess.Popen(
                [sys.executable, str(Path(__file__).resolve()), "--single"],
                env=env,
            )
        )

    def _forward_stop(_signo, _frame):
        for p in procs:
            if p.poll() is None:
                p.send_signal(signal.SIGTERM)

    signal.signal(signal.SIGINT, _forward_stop)
    signal.signal(signal.SIGTERM, _forward_stop)

    exit_codes: list[int] = []
    for p in procs:
        try:
            exit_codes.append(p.wait())
        except KeyboardInterrupt:
            _forward_stop(None, None)
            exit_codes.append(p.wait())
    return max(exit_codes, default=0)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="OpenAPI-driven mock server (Connexion + Flask)")
    parser.add_argument(
        "--spec",
        type=Path,
        default=DEFAULT_SPEC,
        help=f"Path to merged-spec.json (default: {DEFAULT_SPEC.relative_to(REPO_ROOT)})",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"TCP port to bind (default: {DEFAULT_PORT})",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Interface to bind (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--no-reload",
        action="store_true",
        help="Disable auto-reload on fragment / code changes (default: reload ON)",
    )
    parser.add_argument(
        "--single",
        action="store_true",
        help="Serve exactly one canon (the one picked by TREE env var). "
        "Default is to fan out to every discovered canon.",
    )
    args = parser.parse_args(argv)

    # Fan-out mode: no TREE env var set → launch a subprocess per canon.
    # The subprocess is this same script with `--single` set, which falls
    # through to the single-canon branch below.
    if not args.single and not os.environ.get("TREE") and not os.environ.get("MOCK_TREE"):
        return _run_all_canons()

    logging.basicConfig(
        level=os.environ.get("MOCK_LOG_LEVEL", "INFO"),
        format="%(asctime)s · %(name)s · %(levelname)s · %(message)s",
    )

    if args.no_reload:
        # One-shot mode: use the app that was already built at module import.
        print(
            f"🟢 Mock server up on http://{args.host}:{args.port} "
            f"(spec: {args.spec.relative_to(REPO_ROOT)}) · reload OFF",
            flush=True,
        )
        app.run(host=args.host, port=args.port)
        return 0

    # Reload mode: uvicorn re-imports mock_server:app on every watched change,
    # which triggers create_app() → refresh_spec() → new merged-spec.json → new
    # routes. Fragments YAML and mock server code are watched; the two
    # auto-generated JSON artefacts are excluded to prevent restart loops.
    import uvicorn

    print(
        f"🟢 Mock server up on http://{args.host}:{args.port} "
        f"(spec: {args.spec.relative_to(REPO_ROOT)}) · reload ON",
        flush=True,
    )
    print(
        "   Watching: tools/api/*.py + "
        "services/portal/internal/services/api/openapi/test/fragments/**/*.yaml",
        flush=True,
    )
    uvicorn.run(
        "mock_server:app",
        host=args.host,
        port=args.port,
        reload=True,
        app_dir=str(Path(__file__).parent),
        reload_dirs=[
            str(Path(__file__).parent),
            str(FRAGMENTS_DIR),
        ],
        reload_includes=["*.py", "*.yaml", "*.yml"],
        reload_excludes=["merged-spec.json", "fragments-index.json"],
        log_level=os.environ.get("MOCK_LOG_LEVEL", "info").lower(),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
