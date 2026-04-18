#!/usr/bin/env python3
"""Insert docs-theme.css and early theme script into hand-written docs HTML pages."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"

THEME_MARKER = "docs-theme.css"
SCRIPT_MARKER = "docs-theme-preference"

EARLY_SCRIPT = """  <script>(function(){try{var k="docs-theme-preference",v=localStorage.getItem(k);if(v==="dark")document.documentElement.setAttribute("data-theme","dark");else if(v==="light")document.documentElement.setAttribute("data-theme","light");}catch(e){}})();</script>
"""


def _theme_href(html_path: Path) -> str:
    """Return the relative href to ``docs-theme.css`` from a file under ``docs/``."""
    rel = html_path.relative_to(DOCS)
    depth = len(rel.parts) - 1
    if depth == 0:
        return "./assets/docs-theme.css"
    return f"{'../' * depth}assets/docs-theme.css"


def _inject_theme_link(lines: list[str], html_path: Path) -> tuple[list[str], bool]:
    """Insert a ``docs-theme.css`` link after the first ``docs.css`` link if missing."""
    if any(THEME_MARKER in line for line in lines):
        return lines, False
    href = _theme_href(html_path)
    out: list[str] = []
    inserted = False
    for line in lines:
        out.append(line)
        if inserted:
            continue
        if "docs.css" in line and "href=" in line and "docs-theme" not in line:
            li = line[: len(line) - len(line.lstrip())]
            out.append(f'{li}<link rel="stylesheet" href="{href}" />\n')
            inserted = True
    return out, inserted


def _inject_early_script(text: str) -> tuple[str, bool]:
    """Insert a synchronous script that applies stored theme before first paint."""
    if SCRIPT_MARKER in text:
        return text, False
    if "<head>" not in text:
        return text, False
    return text.replace("<head>", "<head>\n" + EARLY_SCRIPT, 1), True


def main() -> int:
    """Walk ``docs/**/*.html``, patch pages that reference ``docs.css``.

    Returns:
        Process exit code (always 0).
    """
    changed = 0
    for path in sorted(DOCS.rglob("*.html")):
        raw = path.read_text(encoding="utf-8")
        if "docs.css" not in raw:
            continue
        lines = raw.splitlines(keepends=True)
        lines, did_link = _inject_theme_link(lines, path)
        text = "".join(lines)
        text, did_script = _inject_early_script(text)
        if did_link or did_script:
            path.write_text(text, encoding="utf-8")
            changed += 1
    if changed:
        print(f"Updated {changed} file(s) with docs theme assets.")
    else:
        print("No files needed updates (already injected or no docs.css).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
