"""Check that every CSS ``var(--name)`` reference resolves to a ``--name:`` definition.

Scans every ``*.css`` file under the repo (excluding vendored / generated trees).
Builds a global set of declared custom properties from THREE sources:

1. ``*.css``: ``--name:`` on the left of a declaration.
2. ``*.html``: ``style="...; --name: …"`` inline-style attributes (tokens are
   commonly set on a portal scope element this way — e.g. ``--portal-tone``).
3. ``*.js``: ``element.style.setProperty('--name', …)`` and similar JS-driven
   custom-property declarations (e.g. ``--rocket-progress`` is set from
   ``docs-nav.js`` based on scroll position).

Then walks every ``var(--name[, fallback])`` reference in CSS files and reports
any name that is never declared by any of those sources.

References with a fallback (``var(--foo, 1rem)``) are NOT flagged — the
fallback is a deliberate "tunable knob" pattern (parent scope may set
``--foo``; otherwise the fallback applies). Only references without a
fallback are required to resolve to a declaration somewhere.

Run: ``python scripts/check_css_vars.py`` (exit code 1 on any unresolved ref).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

EXCLUDE_PARTS = {
    ".venv",
    ".git",
    "node_modules",
    "__pycache__",
    "code-reference",
    "pdoc",
}

DECL_RE = re.compile(r"(--[A-Za-z0-9_-]+)\s*:")
# Match ONLY var(--name) — no fallback. Refs with a fallback are
# intentional opt-in knobs and not required to be declared anywhere.
REF_RE = re.compile(r"var\(\s*(--[A-Za-z0-9_-]+)\s*\)")
SET_PROP_RE = re.compile(r"""setProperty\(\s*['"](--[A-Za-z0-9_-]+)['"]""")
INLINE_STYLE_RE = re.compile(r"""style\s*=\s*["']([^"']*)["']""")


def _iter_files(suffix: str) -> list[Path]:
    out: list[Path] = []
    for path in ROOT.rglob(f"*{suffix}"):
        rel_parts = path.relative_to(ROOT).parts
        if any(part in EXCLUDE_PARTS for part in rel_parts):
            continue
        out.append(path)
    return sorted(out)


def main() -> int:
    css_files = _iter_files(".css")
    html_files = _iter_files(".html")
    js_files = _iter_files(".js")
    declared: set[str] = set()
    refs: list[tuple[Path, int, str]] = []

    for path in css_files:
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            print(f"! {path.relative_to(ROOT)}: {exc}", file=sys.stderr)
            continue
        for token in DECL_RE.findall(text):
            declared.add(token)
        for line_no, line in enumerate(text.splitlines(), start=1):
            for token in REF_RE.findall(line):
                refs.append((path, line_no, token))

    for path in html_files:
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for style_body in INLINE_STYLE_RE.findall(text):
            for token in DECL_RE.findall(style_body):
                declared.add(token)

    for path in js_files:
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for token in SET_PROP_RE.findall(text):
            declared.add(token)

    missing = [(p, ln, t) for p, ln, t in refs if t not in declared]
    if not missing:
        print(
            f"check_css_vars: OK — {len(declared)} tokens declared, "
            f"{len(refs)} references, all resolved across {len(css_files)} CSS files."
        )
        return 0

    print(
        f"check_css_vars: FAIL — {len(missing)} unresolved var() references "
        f"({len(declared)} tokens declared, {len(refs)} total refs):",
        file=sys.stderr,
    )
    for path, line_no, token in missing[:200]:
        rel = path.relative_to(ROOT).as_posix()
        print(f"  {rel}:{line_no}  var({token})  — not declared in any CSS file", file=sys.stderr)
    if len(missing) > 200:
        print(f"  … and {len(missing) - 200} more", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
