"""Auto-generate documentation sections from code sources.

Reads the Makefile help target, FastAPI app routes, and .env.example,
then patches marker-delimited sections in README.md and docs/index.html.

Markers have the form:
    <!-- BEGIN:SECTION_NAME -->
    ...content replaced on every run...
    <!-- END:SECTION_NAME -->

Usage:
    python scripts/sync_docs.py          # one-shot sync
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Marker replacement engine
# ---------------------------------------------------------------------------

_MARKER_RE = re.compile(
    r"([ \t]*<!-- BEGIN:(\w+) -->)\n.*?\n([ \t]*<!-- END:\2 -->)",
    re.DOTALL,
)


def _replace_markers(text: str, sections: dict[str, str]) -> str:
    """Replace content between BEGIN/END markers with generated text."""

    def _sub(m: re.Match) -> str:
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
    """Extract (command, description) pairs from the help target echo lines."""
    makefile = ROOT / "Makefile"
    if not makefile.exists():
        return []

    entries: list[tuple[str, str]] = []
    for line in makefile.read_text().splitlines():
        stripped = line.strip()
        if not stripped.startswith('@echo "  make '):
            continue
        # strip @echo " and trailing "
        inner = stripped.removeprefix('@echo "').removesuffix('"').strip()
        m = _HELP_LINE_RE.match(inner)
        if m:
            entries.append((m.group(1), m.group(2)))
    return entries


def _render_makefile_table(entries: list[tuple[str, str]]) -> str:
    rows = ["| Command | Purpose |", "| ------- | ------- |"]
    for cmd, desc in entries:
        rows.append(f"| `make {cmd}` | {desc} |")
    return "\n".join(rows)


# ---------------------------------------------------------------------------
# FastAPI route introspector
# ---------------------------------------------------------------------------


def _get_fastapi_routes() -> list[tuple[str, str, str]]:
    """Return (method, path, summary) for every route registered on the app."""
    sys.path.insert(0, str(ROOT))
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
    rows = ["| Method | Path | Description |", "| ------ | ---- | ----------- |"]
    for method, path, summary in routes:
        rows.append(f"| `{method}` | `{path}` | {summary} |")
    return "\n".join(rows)


def _render_endpoints_html(routes: list[tuple[str, str, str]]) -> str:
    lines = ['      <div class="card">']
    for method, path, summary in routes:
        lines.append(
            f'        <p><span class="badge">{method} {path}</span> {summary}</p>'
        )
    lines.append("      </div>")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# .env.example parser
# ---------------------------------------------------------------------------

_ENV_LINE_RE = re.compile(r"^([A-Z_]+)=(.*)$")


def _parse_env_example() -> list[tuple[str, str]]:
    """Return (variable, example_value) pairs from .env.example."""
    path = ROOT / ".env.example"
    if not path.exists():
        return []
    entries: list[tuple[str, str]] = []
    for line in path.read_text().splitlines():
        m = _ENV_LINE_RE.match(line.strip())
        if m:
            entries.append((m.group(1), m.group(2)))
    return entries


_CONFIG_DESCRIPTIONS: dict[str, str] = {
    "APP_NAME": "Title shown in OpenAPI",
    "APP_ENV": "Logical environment label",
    "APP_HOST": "Bind address for Uvicorn",
    "APP_PORT": "Listen port",
    "SQLITE_DB_PATH": "SQLite database file (relative or absolute path)",
}


def _render_config_table(entries: list[tuple[str, str]]) -> str:
    rows = [
        "| Variable | Description | Example |",
        "| -------- | ----------- | ------- |",
    ]
    for var, val in entries:
        desc = _CONFIG_DESCRIPTIONS.get(var, "")
        rows.append(f"| `{var}` | {desc} | `{val}` |")
    return "\n".join(rows)


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def sync() -> None:
    makefile_entries = _parse_makefile_help()
    routes = _get_fastapi_routes()
    env_entries = _parse_env_example()

    # --- README.md ---
    readme_path = ROOT / "README.md"
    if readme_path.exists():
        readme_sections: dict[str, str] = {}
        if makefile_entries:
            readme_sections["MAKEFILE_REF"] = _render_makefile_table(makefile_entries)
        if routes:
            readme_sections["HTTP_ENDPOINTS"] = _render_endpoints_md(routes)
        if env_entries:
            readme_sections["CONFIG_TABLE"] = _render_config_table(env_entries)

        original = readme_path.read_text()
        updated = _replace_markers(original, readme_sections)
        if updated != original:
            readme_path.write_text(updated)
            print("✓ README.md updated")
        else:
            print("· README.md already up to date")

    # --- docs/index.html ---
    html_path = ROOT / "docs" / "index.html"
    if html_path.exists():
        html_sections: dict[str, str] = {}
        if routes:
            html_sections["API_CONTRACTS"] = _render_endpoints_html(routes)

        original = html_path.read_text()
        updated = _replace_markers(original, html_sections)
        if updated != original:
            html_path.write_text(updated)
            print("✓ docs/index.html updated")
        else:
            print("· docs/index.html already up to date")


if __name__ == "__main__":
    sync()
