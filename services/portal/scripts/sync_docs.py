# check_service_imports: allow
# This is a build-time docs autogen tool that legitimately introspects the API
# service (FastAPI route table + stable-error catalog) to keep documentation in
# sync with code. See _shared/scripts/check_service_imports.py for the policy.
"""Auto-generate documentation sections from code sources.

Reads the Makefile help target and FastAPI app routes, then patches
marker-delimited sections in README.md and services/portal/internal/services/api/reference/errors.html.

Markers have the form:
    <!-- BEGIN:SECTION_NAME -->
    ...content replaced on every run...
    <!-- END:SECTION_NAME -->

Usage:
    python services/portal/scripts/sync_docs.py          # one-shot sync
"""

from __future__ import annotations

import argparse
import html
import os
import re
import subprocess
import sys
from functools import cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
NO_COLOR = os.getenv("NO_COLOR", "0") == "1"
COLOR_RESET = "" if NO_COLOR else "\033[0m"
COLOR_GREEN = "" if NO_COLOR else "\033[32m"
COLOR_CYAN = "" if NO_COLOR else "\033[36m"
ICON_OK = f"{COLOR_GREEN}✓{COLOR_RESET}"
ICON_STEP = f"{COLOR_CYAN}→{COLOR_RESET}"
ICON_INFO = "·"


@cache
def _tracked_dir_set() -> frozenset[Path] | None:
    """Resolved directories that contain at least one git-tracked file.

    Used to keep the README architecture tree in sync with what CI sees: a
    directory composed exclusively of gitignored files exists locally but
    not in CI, so listing it would create non-deterministic drift.
    """
    try:
        output = subprocess.check_output(
            ["git", "ls-files", "-z"],
            cwd=ROOT,
            stderr=subprocess.DEVNULL,
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    dirs: set[Path] = set()
    for rel in output.decode().split("\0"):
        if not rel:
            continue
        parent = (ROOT / rel).resolve().parent
        while parent != ROOT and parent not in dirs:
            dirs.add(parent)
            parent = parent.parent
    return frozenset(dirs)


def _ok(message: str) -> None:
    """Print a green success line to stdout.

    Args:
        message: Text after the checkmark icon.
    """
    print(f"{ICON_OK} {message}")


def _step(message: str) -> None:
    """Print a cyan progress line to stdout.

    Args:
        message: Text after the arrow icon.
    """
    print(f"{ICON_STEP} {message}")


def _info(message: str) -> None:
    """Print a neutral bullet line to stdout.

    Args:
        message: Informational text.
    """
    print(f"{ICON_INFO} {message}")


# ---------------------------------------------------------------------------
# Marker replacement engine
# ---------------------------------------------------------------------------

_MARKER_RE = re.compile(
    r"([ \t]*<!-- BEGIN:(\w+) -->)\n.*?\n([ \t]*<!-- END:\2 -->)",
    re.DOTALL,
)


def _replace_markers(text: str, sections: dict[str, str]) -> str:
    """Replace content between ``<!-- BEGIN:name -->`` / ``END`` pairs when ``name`` is in ``sections``.

    Args:
        text: Full file text containing marker pairs.
        sections: Map of marker name to replacement inner content (without markers).

    Returns:
        Text with matching sections substituted; unknown markers left unchanged.
    """

    def _sub(m: re.Match) -> str:
        """Substitute one regex match if the marker name exists in ``sections``."""
        name = m.group(2)
        if name in sections:
            return f"{m.group(1)}\n{sections[name]}\n{m.group(3)}"
        return m.group(0)

    return _MARKER_RE.sub(_sub, text)


# ---------------------------------------------------------------------------
# Makefile help parser
# ---------------------------------------------------------------------------

_HELP_LINE_RE = re.compile(
    r"make (\S+(?:\s+\w+=\S+)?)\s+(.+)",
)


def _parse_makefile_help() -> list[tuple[str, str]]:
    """Parse ``make help``-style echo lines from the root Makefile.

    Returns:
        Sorted list of ``(make_target, description)`` tuples; empty if Makefile missing.
    """
    makefile = ROOT / "Makefile"
    if not makefile.exists():
        return []

    entries_by_command: dict[str, str] = {}
    for line in makefile.read_text().splitlines():
        stripped = line.strip()
        if not stripped.startswith('@echo "  make '):
            continue
        # strip @echo " and trailing "
        inner = stripped.removeprefix('@echo "').removesuffix('"').strip()
        m = _HELP_LINE_RE.match(inner)
        if m:
            command = m.group(1)
            description = m.group(2).strip()
            if description.startswith("#"):
                description = description.lstrip("#").strip()
            # Keep the most complete/authoritative description in case of duplicates.
            entries_by_command[command] = description
    return sorted(entries_by_command.items(), key=lambda item: item[0])


def _render_makefile_table(entries: list[tuple[str, str]]) -> str:
    """Build a GitHub-flavored markdown table of make commands.

    Args:
        entries: Rows from :func:`_parse_makefile_help`.

    Returns:
        Markdown string for README embedding.
    """
    rows = ["| Command | Purpose |", "| ------- | ------- |"]
    for cmd, desc in entries:
        rows.append(f"| `make {cmd}` | {desc} |")
    return "\n".join(rows)


# ---------------------------------------------------------------------------
# FastAPI route introspector
# ---------------------------------------------------------------------------


def _get_fastapi_routes() -> list[tuple[str, str, str]]:
    """Introspect registered :class:`fastapi.routing.APIRoute` entries on the app.

    Returns:
        Sorted list of ``(HTTP method, path, summary)``; empty if import fails.
    """
    sys.path.insert(0, str(ROOT / "services" / "api"))
    try:
        from app.main import app  # noqa: WPS433
    except Exception as exc:
        print(f"  ⚠ Could not import FastAPI app: {exc}", file=sys.stderr)
        return []

    from fastapi.routing import APIRoute

    routes: list[tuple[str, str, str]] = []
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        for method in sorted(route.methods):
            summary = route.summary or route.name.replace("_", " ").title()
            routes.append((method, route.path, summary))
    routes.sort(key=lambda r: (r[1], r[0]))
    return routes


def _render_endpoints_md(routes: list[tuple[str, str, str]]) -> str:
    """Render route list as a markdown table for README markers.

    Args:
        routes: Output of :func:`_get_fastapi_routes`.

    Returns:
        Markdown table string.
    """
    rows = ["| Method | Path | Description |", "| ------ | ---- | ----------- |"]
    for method, path, summary in routes:
        rows.append(f"| `{method}` | `{path}` | {summary} |")
    return "\n".join(rows)


# ---------------------------------------------------------------------------
# Error catalog renderers (services/portal/internal/errors.html)
# ---------------------------------------------------------------------------


def _load_error_catalog() -> tuple[list[tuple[str, str, str]], list[tuple[str, str, str]]]:
    """Load stable error identities from ``app.errors`` modules.

    Returns:
        Two sorted lists of tuples ``(code, key, message)``:
        first for ``COMMON_*``, second for ``USER_*``.
    """
    sys.path.insert(0, str(ROOT / "services" / "api"))
    try:
        import app.errors.common as common_module  # noqa: WPS433
        import app.errors.user as user_module  # noqa: WPS433
        from app.errors.types import StableError  # noqa: WPS433
    except Exception as exc:
        print(f"  ⚠ Could not import error catalog: {exc}", file=sys.stderr)
        return [], []

    common_symbols = vars(common_module)
    common_rows: list[tuple[str, str, str]] = []
    for name, value in common_symbols.items():
        if not name.startswith("COMMON_") or not isinstance(value, StableError):
            continue
        common_rows.append((value.code, value.key, value.message))
    common_rows.sort(key=lambda row: row[0])

    user_symbols = vars(user_module)
    user_rows: list[tuple[str, str, str]] = []
    for name, value in user_symbols.items():
        if not name.startswith("USER_") or not isinstance(value, StableError):
            continue
        user_rows.append((value.code, value.key, value.message))
    user_rows.sort(key=lambda row: row[0])

    return common_rows, user_rows


def _load_validation_rule_rows() -> list[tuple[str, str, str, str, str]]:
    """Build rows for documented validation mapping dicts.

    Returns:
        Sorted list of ``(rule_set, field, pydantic_type, code, key)`` rows.
    """
    sys.path.insert(0, str(ROOT / "services" / "api"))
    try:
        from app.errors.user import (  # noqa: WPS433
            CREATE_USER_VALIDATION_RULES,
            UPDATE_USER_VALIDATION_RULES,
        )
    except Exception as exc:
        print(f"  ⚠ Could not import validation rules: {exc}", file=sys.stderr)
        return []

    rows: list[tuple[str, str, str, str, str]] = []
    for rule_set, mapping in (
        ("CREATE_USER_VALIDATION_RULES", CREATE_USER_VALIDATION_RULES),
        ("UPDATE_USER_VALIDATION_RULES", UPDATE_USER_VALIDATION_RULES),
    ):
        for (field, pydantic_type), err in mapping.items():
            rows.append((rule_set, field, pydantic_type, err.code, err.key))
    rows.sort(key=lambda row: (row[0], row[1], row[2], row[3]))
    return rows


def _render_error_rows_html(rows: list[tuple[str, str, str]], source_path: str) -> str:
    """Render ``(code, key, message)`` rows as HTML table body fragment.

    Args:
        rows: Error tuples loaded from code catalog modules.
        source_path: Relative path shown in the source column.

    Returns:
        HTML fragment with ``<tr>`` rows.
    """
    if not rows:
        return '                  <tr><td colspan="4"><em>No rows found.</em></td></tr>'

    out: list[str] = []
    for code, key, message in rows:
        out.extend(
            [
                "                  <tr>",
                f"                    <td><code>{html.escape(code)}</code></td>",
                f"                    <td><code>{html.escape(key)}</code></td>",
                f"                    <td>{html.escape(message)}</td>",
                f"                    <td><code>{html.escape(source_path)}</code></td>",
                "                  </tr>",
            ]
        )
    return "\n".join(out)


def _render_rule_rows_html(rows: list[tuple[str, str, str, str, str]]) -> str:
    """Render validation mapping rows as HTML fragment for docs marker.

    Args:
        rows: Tuples ``(rule_set, field, pydantic_type, code, key)``.

    Returns:
        HTML fragment with ``<tr>`` rows.
    """
    if not rows:
        return '                  <tr><td colspan="5"><em>No rows found.</em></td></tr>'

    out: list[str] = []
    for rule_set, field, pydantic_type, code, key in rows:
        out.extend(
            [
                "                  <tr>",
                f"                    <td><code>{html.escape(rule_set)}</code></td>",
                f"                    <td><code>{html.escape(field)}</code></td>",
                f"                    <td><code>{html.escape(pydantic_type)}</code></td>",
                f"                    <td><code>{html.escape(code)}</code></td>",
                f"                    <td><code>{html.escape(key)}</code></td>",
                "                  </tr>",
            ]
        )
    return "\n".join(out)


# ---------------------------------------------------------------------------
# Repository layout tree
# ---------------------------------------------------------------------------

_SKIP_DIRS = {
    ".venv",
    "venv",
    "__pycache__",
    ".git",
    ".cursor",
    "node_modules",
    ".mypy_cache",
    ".ruff_cache",
    ".pytest_cache",
    ".tox",
    ".nox",
    ".eggs",
    "htmlcov",
}

# Show only high-level architecture blocks at repository root.
# Canonical repo name for the README REPO_LAYOUT tree. Pinned so the rendered
# tree does not drift when the local checkout directory is named differently
# from the CI working directory (e.g. study_app vs etr_study_api).
_REPO_NAME = "study_app"

_ARCHITECTURE_ROOT_DIRS = ("app", "alembic", "services", "ops", "scripts")

# Default depth is 2 (root + one nested level), but some domains are worth 3.
_MAX_DEPTH_DEFAULT = 2
_MAX_DEPTH_BY_ROOT = {
    "services": 4,
}

_DIR_COMMENTS: dict[str, str] = {
    "services/api": "Python API service (FastAPI)",
    "services/api/app": "Application package",
    "services/api/app/api": "HTTP layer",
    "services/api/app/api/v1": "v1 routers",
    "services/api/app/core": "Settings, DB session",
    "services/api/app/models": "ORM models",
    "services/api/app/models/core": "Core domain entities",
    "services/api/app/models/reference": "Reference / lookup entities",
    "services/api/app/repositories": "Data-access layer",
    "services/api/app/schemas": "Pydantic request/response models",
    "services/api/app/services": "Business logic",
    "services/api/alembic": "Migration environment",
    "services/api/alembic/versions": "Migration scripts",
    "services": "Service-rooted layout per ADR 0028",
    "services/frontend": "Frontend artifacts (portal, future admin / dashboard)",
    "services/frontend/portal": "Static documentation portal — public + internal IA",
    "services/portal/developer": "Developer guides and onboarding",
    "services/portal/runbooks": "Operational troubleshooting guides",
    "services/portal/uml": "PlantUML diagrams",
    "services/portal/internal/handbook/uml/include": "Shared PlantUML skin (merged at Kroki render)",
    "services/portal/internal/handbook/uml/sequences": "Sequence diagram sources",
    "services/portal/internal/handbook/uml/rendered": "Rendered SVGs",
    "services/monitoring": "Prometheus, Grafana, Filebeat configs + compose stacks",
    "services/monitoring/filebeat": "Filebeat → Elasticsearch (local logging stack)",
    "services/monitoring/grafana": "Dashboards and provisioning",
    "services/monitoring/prometheus": "Scrape config, rules, Blackbox",
    "scripts": "Service-specific dev & CI helper scripts (portal + monitoring helpers)",
    "_shared": "Cross-cutting tooling shared across services (governance + LLM + checkers)",
    "_shared/scripts": "Repo-wide governance/CI scripts (changelog gate, PR body sync, asset/CSS/path checkers, LLM helpers)",
}


def _build_tree() -> str:
    """Build a fenced code block showing a small directory tree of key project folders.

    Returns:
        Markdown code block string for the ``REPO_LAYOUT`` marker.
    """

    lines: list[str] = [f"{_REPO_NAME}/"]

    _ROOT_FILE_COMMENTS: tuple[tuple[str, str], ...] = ()
    for fname, comment in _ROOT_FILE_COMMENTS:
        if (ROOT / fname).is_file():
            lines.append(f"├── {fname}  # {comment}")

    def _walk(directory: Path, prefix: str, rel: str, max_depth: int) -> None:
        """Recursively append directory lines up to ``max_depth`` relative to ``rel``.

        Args:
            directory: Current directory to list.
            prefix: ASCII tree prefix for this depth.
            rel: POSIX path relative to repo root for comment lookup.
            max_depth: Maximum number of path segments below root to show.
        """
        current_depth = len(rel.split("/")) if rel else 0
        if current_depth >= max_depth:
            return

        tracked_dirs = _tracked_dir_set()
        entries = sorted(
            [
                child
                for child in directory.iterdir()
                if child.is_dir()
                and child.name not in _SKIP_DIRS
                and (tracked_dirs is None or child.resolve() in tracked_dirs)
            ],
            key=lambda p: p.name,
        )

        for i, entry in enumerate(entries):
            is_last = i == len(entries) - 1
            connector = "└── " if is_last else "├── "
            child_rel = f"{rel}/{entry.name}" if rel else entry.name
            comment = _DIR_COMMENTS.get(child_rel, "")
            suffix = f"  # {comment}" if comment else ""
            lines.append(f"{prefix}{connector}{entry.name}/{suffix}")
            extension = "    " if is_last else "│   "
            _walk(entry, prefix + extension, child_rel, max_depth)

    existing_roots = [ROOT / name for name in _ARCHITECTURE_ROOT_DIRS if (ROOT / name).is_dir()]
    for i, directory in enumerate(existing_roots):
        is_last = i == len(existing_roots) - 1
        connector = "└── " if is_last else "├── "
        rel = directory.name
        comment = _DIR_COMMENTS.get(rel, "")
        suffix = f"  # {comment}" if comment else ""
        lines.append(f"{connector}{directory.name}/{suffix}")
        extension = "    " if is_last else "│   "
        max_depth = _MAX_DEPTH_BY_ROOT.get(directory.name, _MAX_DEPTH_DEFAULT)
        _walk(directory, extension, rel, max_depth)

    return "```text\n" + "\n".join(lines) + "\n```"


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def sync(check: bool = False) -> int:
    """Regenerate marker-delimited sections in README and HTML docs from live sources.

    Args:
        check: If True, do not write files; only count how many would change.

    Returns:
        Number of files that would be or were updated (stale count).
    """
    _step("Syncing docs from code sources...")
    makefile_entries = _parse_makefile_help()
    routes = _get_fastapi_routes()
    common_errors, user_errors = _load_error_catalog()
    rule_rows = _load_validation_rule_rows()
    stale_files = 0

    repo_layout = _build_tree()

    # --- README.md ---
    readme_path = ROOT / "README.md"
    if readme_path.exists():
        readme_sections: dict[str, str] = {}
        readme_sections["REPO_LAYOUT"] = repo_layout
        if makefile_entries:
            readme_sections["MAKEFILE_REF"] = _render_makefile_table(makefile_entries)
        if routes:
            readme_sections["HTTP_ENDPOINTS"] = _render_endpoints_md(routes)

        original = readme_path.read_text()
        updated = _replace_markers(original, readme_sections)
        if updated != original:
            stale_files += 1
            if check:
                print("✗ README.md is out of sync (run make docs-fix)")
            else:
                readme_path.write_text(updated)
                _ok("README.md updated")
        else:
            _info("README.md already up to date")

    # --- services/portal/internal/services/api/reference/errors.html (error catalog sync) ---
    errors_path = (
        ROOT / "services" / "portal" / "internal" / "services" / "api" / "reference" / "errors.html"
    )
    if errors_path.exists():
        errors_sections: dict[str, str] = {
            "ERROR_COMMON_ROWS": _render_error_rows_html(
                common_errors, "services/api/app/errors/common.py"
            ),
            "ERROR_USER_ROWS": _render_error_rows_html(
                user_errors, "services/api/app/errors/user.py"
            ),
            "ERROR_RULE_ROWS": _render_rule_rows_html(rule_rows),
        }

        original = errors_path.read_text()
        updated = _replace_markers(original, errors_sections)
        if updated != original:
            stale_files += 1
            if check:
                print(
                    "✗ services/portal/internal/services/api/reference/errors.html is out of sync (run make docs-fix)"
                )
            else:
                errors_path.write_text(updated)
                _ok("services/portal/internal/services/api/reference/errors.html updated")
        else:
            _info("services/portal/internal/services/api/reference/errors.html already up to date")
    return stale_files


def main() -> None:
    """CLI: run :func:`sync` with optional ``--check`` (exit 1 if stale in check mode)."""
    parser = argparse.ArgumentParser(description="Sync docs from source code.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check docs are in sync without modifying files.",
    )
    args = parser.parse_args()
    stale = sync(check=args.check)
    if args.check and stale:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
