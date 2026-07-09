#!/usr/bin/env python3
"""Verify every internal portal page is reachable from the sidebar.

Scans `services/portal/internal/**/*.html` and compares against `href`
entries in `services/frontend/portal/assets_v2/ui-kit/mocks/nav-tree-internal.json`.

Three failure modes (any → exit 1):
    1. Real page is not in the nav AND not on the EXCLUDED_GLOBS list AND not
       a redirect stub (HTML with `<meta http-equiv="refresh">`).
    2. Nav points to a non-existent file (broken nav link).
    3. JSON itself is malformed.

EXCLUDED_GLOBS is the only knob authors should edit. Each pattern is a glob
relative to repo root; matches use `fnmatch` semantics with `**` for any
depth. Add a pattern only when the page is genuinely reachable through
another mechanism (a hub page's own internal nav, a redirect, etc.) — never
just to suppress a missing nav entry.

Pre-commit usage: invoke without arguments. Exit code 1 blocks the commit.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve()
ROOT = SCRIPT.parents[2]
INTERNAL = ROOT / "services" / "portal" / "internal"
NAV = (
    ROOT
    / "services"
    / "frontend"
    / "portal"
    / "assets_v2"
    / "ui-kit"
    / "mocks"
    / "nav-tree-internal.json"
)

# Pages allowed to be absent from the sidebar.
# Each entry is a glob relative to repo root. `**` matches any number of
# path segments; `*` matches a single segment (no `/`).
EXCLUDED_GLOBS: list[str] = [
    # pdoc-generated descendants. The hub `code-reference/index.html`
    # IS in the sidebar; pdoc provides its own intra-tree navigation.
    "services/portal/internal/services/*/code-reference/**",
    # Personal sandbox / WIP notes on individual team-member profiles.
    # The profile `index.html` page is reachable from People; sub-notes
    # are linked from there, not the global sidebar.
    "services/portal/internal/team/people/*/sa-growth.html",
    # Swagger UI viewer for OpenAPI fragments — a dev tool reachable
    # from the SA tutorial + ADR 0036, not from the global sidebar.
    "services/portal/internal/services/api/openapi/test/preview.html",
    "services/portal/internal/services/api/openapi/etr_study_app/preview.html",
]

REDIRECT_MARKER = 'http-equiv="refresh"'


def load_nav_hrefs() -> set[str]:
    """Walk the nav tree and return the set of internal-pointing hrefs."""
    data = json.loads(NAV.read_text(encoding="utf-8"))
    hrefs: set[str] = set()

    def walk(node: object) -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                if k == "href" and isinstance(v, str):
                    p = v.lstrip("/")
                    if p.startswith("services/portal/internal/"):
                        hrefs.add(p)
                else:
                    walk(v)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(data)
    return hrefs


def collect_real_pages() -> set[str]:
    """All .html files under services/portal/internal/, as repo-relative paths."""
    return {str(p.relative_to(ROOT)) for p in INTERNAL.rglob("*.html")}


def is_excluded(rel_path: str) -> bool:
    return any(fnmatch.fnmatch(rel_path, pat) for pat in EXCLUDED_GLOBS)


def is_redirect_stub(rel_path: str) -> bool:
    """Cheap heuristic: file declares a meta refresh in its first 4 KiB."""
    try:
        head = (ROOT / rel_path).read_text(encoding="utf-8", errors="replace")[:4096]
    except OSError:
        return False
    return REDIRECT_MARKER in head


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Verify every internal portal page is reachable from the sidebar.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Print nothing on success (still exits 1 on failure).",
    )
    args = parser.parse_args(argv)

    if not NAV.exists():
        print(f"nav-tree not found: {NAV}", file=sys.stderr)
        return 1
    if not INTERNAL.exists():
        print(f"internal docs root not found: {INTERNAL}", file=sys.stderr)
        return 1

    try:
        nav_hrefs = load_nav_hrefs()
    except json.JSONDecodeError as exc:
        print(f"nav-tree-internal.json is malformed: {exc}", file=sys.stderr)
        return 1

    real = collect_real_pages()
    broken = sorted(nav_hrefs - real)
    candidates = sorted(real - nav_hrefs)

    missing: list[str] = []
    excluded_by_pattern = 0
    excluded_by_redirect = 0
    for rel in candidates:
        if is_excluded(rel):
            excluded_by_pattern += 1
            continue
        if is_redirect_stub(rel):
            excluded_by_redirect += 1
            continue
        missing.append(rel)

    failures = bool(broken or missing)

    if failures:
        print("─" * 78, file=sys.stderr)
        print("SIDEBAR COVERAGE — FAIL", file=sys.stderr)
        print("─" * 78, file=sys.stderr)

        if broken:
            print(
                f"\n{len(broken)} broken nav link(s) — href points to a file that does not exist:",
                file=sys.stderr,
            )
            for b in broken:
                print(f"  ✗ {b}", file=sys.stderr)
            print(
                "\n  Fix: remove the entry from nav-tree-internal.json,"
                " or restore the missing file.",
                file=sys.stderr,
            )

        if missing:
            print(
                f"\n{len(missing)} page(s) not reachable from the sidebar"
                " and not on the exclusion list:",
                file=sys.stderr,
            )
            for m in missing:
                print(f"  ✗ {m}", file=sys.stderr)
            print(
                "\n  Fix one of:"
                "\n    1. Add an entry to nav-tree-internal.json (preferred);"
                "\n    2. If the page is genuinely hub-reachable (e.g. pdoc-style"
                "\n       subtree), add a glob to EXCLUDED_GLOBS in"
                "\n       tools/docs/check_sidebar_coverage.py."
                "\n    3. If the page is a redirect stub, add"
                f"\n       <meta {REDIRECT_MARKER} ...> — it will be auto-skipped.",
                file=sys.stderr,
            )
        return 1

    if not args.quiet:
        coverage = 100 * len(nav_hrefs & real) // max(len(real), 1)
        print("─" * 78)
        print("SIDEBAR COVERAGE — OK")
        print("─" * 78)
        print(f"  real pages:           {len(real)}")
        print(f"  in sidebar:           {len(nav_hrefs & real)}  ({coverage}%)")
        print(f"  excluded (pattern):   {excluded_by_pattern}")
        print(f"  excluded (redirect):  {excluded_by_redirect}")
        print("  broken nav links:     0")
    return 0


if __name__ == "__main__":
    sys.exit(main())
