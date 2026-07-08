"""Cross-document consistency lint between analyst specs, OpenAPI, and the error catalog.

Runs three checks:

1. **operationId ↔ page status oracle** — split by :data:`data-spec-status`:
   * ``implemented`` → operationId must be in the **runtime spec**
     (``services/portal/public/reference/api/openapi.json``), the actual code
     ``app.openapi()`` output. If the spec page claims the operation is
     shipped, the code must ship it.
   * ``approved`` / ``in-review`` → operationId must be in the **canon**
     (``services/portal/internal/services/api/openapi/etr_study_app/merged-spec.json``),
     the analyst-authored contract. The analyst promised it; API-first
     requires the promise land in canon before the code catches up.
   * ``draft`` → free pass (page is a stub, oracle skipped).
   Every page declaring ``data-spec-operation-id`` must be unique across pages
   regardless of status.

2. **OpenAPI → spec page** — every ``operationId`` in the runtime spec must
   have a spec page (else it's an undocumented shipped operation). Stub pages
   with no ``data-spec-operation-id`` are skipped (``spec_lint.py`` flags them).

3. **Error code/key ↔ catalog**: every ``code`` / ``key`` pair listed in section 12 of an
   operation page must be registered on ``services/portal/internal/api/_shared/error-catalog.html``. Catalog
   entries that no operation references are reported as warnings (not failures).

Exit codes:
    0 — all checks pass.
    1 — any check failed.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections.abc import Iterable
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
OPERATIONS_GLOB = "services/portal/internal/services/api/reference/*/operations/*.html"
ERROR_CATALOG = (
    REPO_ROOT / "services/portal/internal/services/api/reference/_shared/error-catalog.html"
)
RUNTIME_SPEC = REPO_ROOT / "services/portal/public/reference/api/openapi.json"
CANON_SPEC = (
    REPO_ROOT / "services/portal/internal/services/api/openapi/etr_study_app/merged-spec.json"
)

# Draft pages are stubs — no oracle applied. Every other status is checked
# against either the canon (approved/in-review) or the runtime spec (implemented).
DRAFT_STATUSES: frozenset[str] = frozenset({"draft"})
CANON_STATUSES: frozenset[str] = frozenset({"approved", "in-review"})
RUNTIME_STATUSES: frozenset[str] = frozenset({"implemented"})

# OpenAPI operations tagged with any of these names are infrastructure plumbing
# (health probes, internal telemetry) and intentionally have no analyst-facing spec page.
SKIP_OPENAPI_TAGS: frozenset[str] = frozenset({"System"})


def _attribute(html: str, attr: str, *, on_tag: str = "body") -> str | None:
    """Read ``attr`` value from the first ``<{on_tag} ...>`` opening tag."""
    tag_match = re.search(rf"<{on_tag}\b[^>]*>", html, flags=re.IGNORECASE | re.DOTALL)
    if tag_match is None:
        return None
    attr_match = re.search(
        rf'\b{re.escape(attr)}\s*=\s*"([^"]*)"',
        tag_match.group(0),
        flags=re.IGNORECASE,
    )
    return attr_match.group(1) if attr_match else None


def _find_section(html: str, section_id: str) -> str | None:
    """Return the inner HTML of ``<section data-spec-section="<id>">...``, or ``None``."""
    open_pattern = re.compile(
        rf'<section\b[^>]*\bdata-spec-section\s*=\s*"{re.escape(section_id)}"[^>]*>',
        flags=re.IGNORECASE,
    )
    open_match = open_pattern.search(html)
    if open_match is None:
        return None
    start = open_match.end()
    close = html.find("</section>", start)
    if close == -1:
        return None
    return html[start:close]


# Tokens like USER_404, COMMON_409, CONS_409, ERR_404 — domain prefix + 3-digit suffix.
_CODE_RE = re.compile(r"\b([A-Z]+_\d{3})\b")
# Tokens like CONSPECTUS_REVIEW_REVISION_CONFLICT — uppercase + underscores; min 2 segments.
_KEY_RE = re.compile(r"\b([A-Z][A-Z0-9]+(?:_[A-Z0-9]+){1,})\b")

# Catalog rows carrying this marker describe cross-cutting / operator-only conditions
# (e.g. middleware misconfiguration). Operation pages are not expected to enumerate them
# in their §12 error table, so the unreferenced-catalog-entry warning is suppressed.
_OPERATOR_ONLY_ROW_RE = re.compile(
    r'<tr\b[^>]*\bdata-operator-only\s*=\s*"true"[^>]*>(.*?)</tr>',
    flags=re.IGNORECASE | re.DOTALL,
)


def _collect_error_tokens(html: str) -> tuple[set[str], set[str]]:
    """Return ``(codes, keys)`` parsed from the error-catalog section of an operation page.

    Args:
        html: Whole-document HTML.

    Returns:
        Tuple of two sets — distinct ``code`` values and ``key`` values found in section 12.
        Returns empty sets when the section is missing.
    """
    body = _find_section(html, "error-catalog")
    if body is None:
        return set(), set()
    codes = set(_CODE_RE.findall(body))
    keys = set(_KEY_RE.findall(body))
    # Domain prefix tokens (USER_, CONS_, ERR_, COMMON_) standalone are not codes; the regex
    # already filters those by requiring digits. But it does match keys like USER_NOT_FOUND
    # which we want — those are keys, not codes.
    keys -= codes
    return codes, keys


def _collect_catalog_tokens(html: str) -> tuple[set[str], set[str], set[str], set[str]]:
    """Return ``(codes, keys, operator_only_codes, operator_only_keys)`` from the catalog.

    Catalog rows tagged ``data-operator-only="true"`` describe conditions that no
    operation page is expected to enumerate (e.g. middleware misconfiguration). Their
    codes/keys are still registered so other operation pages can reference them, but
    they are excluded from the unreferenced-entry warning.
    """
    operator_only_codes: set[str] = set()
    operator_only_keys: set[str] = set()
    for row in _OPERATOR_ONLY_ROW_RE.finditer(html):
        body = row.group(1)
        operator_only_codes |= set(_CODE_RE.findall(body))
        operator_only_keys |= set(_KEY_RE.findall(body))
    operator_only_keys -= operator_only_codes

    codes = set(_CODE_RE.findall(html))
    keys = set(_KEY_RE.findall(html))
    keys -= codes
    return codes, keys, operator_only_codes, operator_only_keys


def _read_openapi_operations(path: Path) -> dict[str, list[str]]:
    """Read ``operationId`` → ``tags`` mapping from an OpenAPI document.

    Args:
        path: Path to an OpenAPI JSON (runtime spec or merged canon).

    Returns:
        Mapping from ``operationId`` to its declared tag list (possibly empty);
        empty dict when the file is missing or unreadable.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return {}
    try:
        doc = json.loads(text)
    except json.JSONDecodeError:
        return {}
    out: dict[str, list[str]] = {}
    paths = doc.get("paths") if isinstance(doc, dict) else None
    if not isinstance(paths, dict):
        return out
    for _path, methods in paths.items():
        if not isinstance(methods, dict):
            continue
        for _method, op in methods.items():
            if not isinstance(op, dict):
                continue
            op_id = op.get("operationId")
            if not isinstance(op_id, str):
                continue
            raw_tags = op.get("tags")
            tags: list[str] = (
                [t for t in raw_tags if isinstance(t, str)] if isinstance(raw_tags, list) else []
            )
            out[op_id] = tags
    return out


def _collect_specs(repo_root: Path) -> list[Path]:
    """Return every operation spec page sorted by path."""
    return sorted(repo_root.glob(OPERATIONS_GLOB))


def _consistency_run(repo_root: Path) -> tuple[list[str], list[str]]:
    """Execute the three consistency checks.

    Args:
        repo_root: Repository root.

    Returns:
        ``(failures, warnings)`` — lists of human-readable messages. ``failures`` non-empty
        means the script exits 1.
    """
    failures: list[str] = []
    warnings: list[str] = []

    spec_paths = _collect_specs(repo_root)
    if not spec_paths:
        return ["spec_consistency: no operation specs found"], []

    # Check 1 + 2: operationId mapping — split oracle.
    runtime_ops = _read_openapi_operations(RUNTIME_SPEC)
    canon_ops = _read_openapi_operations(CANON_SPEC)
    runtime_ids = set(runtime_ops.keys())
    canon_ids = set(canon_ops.keys())
    spec_ids: dict[str, list[Path]] = {}
    for path in spec_paths:
        html = path.read_text(encoding="utf-8")
        op_id = _attribute(html, "data-spec-operation-id")
        status = _attribute(html, "data-spec-status") or ""
        if not op_id:
            warnings.append(f"{path.relative_to(repo_root)}: no data-spec-operation-id (skipped)")
            continue
        spec_ids.setdefault(op_id, []).append(path)
        if status in RUNTIME_STATUSES and op_id not in runtime_ids:
            failures.append(
                f"{path.relative_to(repo_root)}: status={status} but operationId "
                f"{op_id!r} not in runtime spec ({RUNTIME_SPEC.relative_to(repo_root)})",
            )
        elif status in CANON_STATUSES and op_id not in canon_ids:
            failures.append(
                f"{path.relative_to(repo_root)}: status={status} but operationId "
                f"{op_id!r} not in canon ({CANON_SPEC.relative_to(repo_root)})",
            )
        elif (
            status
            and status not in DRAFT_STATUSES
            and status not in RUNTIME_STATUSES
            and status not in CANON_STATUSES
        ):
            # Unknown status (e.g. deprecated) — require presence in at least one oracle.
            if op_id not in runtime_ids and op_id not in canon_ids:
                failures.append(
                    f"{path.relative_to(repo_root)}: status={status} but operationId "
                    f"{op_id!r} not in runtime spec or canon",
                )

    for op_id, paths in spec_ids.items():
        if len(paths) > 1:
            joined = ", ".join(str(p.relative_to(repo_root)) for p in paths)
            failures.append(f"operationId {op_id!r} declared on multiple pages: {joined}")

    declared = set(spec_ids.keys())
    orphan_in_runtime = sorted(runtime_ids - declared)
    for op_id in orphan_in_runtime:
        tags = runtime_ops.get(op_id, [])
        if any(tag in SKIP_OPENAPI_TAGS for tag in tags):
            continue
        warnings.append(f"runtime operationId {op_id!r} has no internal spec page")

    # Check 3: error tokens vs catalog.
    if not ERROR_CATALOG.exists():
        failures.append(
            f"shared error catalog not found at {ERROR_CATALOG.relative_to(repo_root)}",
        )
        return failures, warnings

    catalog_html = ERROR_CATALOG.read_text(encoding="utf-8")
    catalog_codes, catalog_keys, operator_only_codes, operator_only_keys = _collect_catalog_tokens(
        catalog_html
    )

    seen_codes: set[str] = set()
    seen_keys: set[str] = set()
    for path in spec_paths:
        html = path.read_text(encoding="utf-8")
        codes, keys = _collect_error_tokens(html)
        seen_codes |= codes
        seen_keys |= keys
        for code in sorted(codes - catalog_codes):
            failures.append(
                f"{path.relative_to(repo_root)}: error code {code!r} not in shared error catalog",
            )
        for key in sorted(keys - catalog_keys):
            failures.append(
                f"{path.relative_to(repo_root)}: error key {key!r} not in shared error catalog",
            )

    for code in sorted(catalog_codes - seen_codes - operator_only_codes):
        warnings.append(f"catalog code {code!r} is not referenced by any operation page")
    for key in sorted(catalog_keys - seen_keys - operator_only_keys):
        warnings.append(f"catalog key {key!r} is not referenced by any operation page")

    return failures, warnings


def main(argv: Iterable[str] | None = None) -> int:
    """CLI entry point.

    Args:
        argv: Argument vector. ``None`` defers to :data:`sys.argv`.

    Returns:
        Exit code (0 on success, 1 on any failure).
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--strict-warnings",
        action="store_true",
        help="Treat warnings as failures.",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    failures, warnings = _consistency_run(REPO_ROOT)

    out = sys.stderr if (failures or (args.strict_warnings and warnings)) else sys.stdout
    if failures:
        print("FAIL spec_consistency:", file=out)
        for msg in failures:
            print(f"     - {msg}", file=out)
    if warnings:
        print("WARN spec_consistency:", file=out)
        for msg in warnings:
            print(f"     - {msg}", file=out)
    if not failures and not warnings:
        print("spec_consistency: OK", file=out)

    if failures:
        return 1
    if args.strict_warnings and warnings:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
