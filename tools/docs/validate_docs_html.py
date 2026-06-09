"""Validate HTML consistency for docs pages."""

from __future__ import annotations

from pathlib import Path

import html5lib

ROOT = Path(__file__).resolve().parents[2]
DOCS_ROOT = ROOT / "services" / "portal"
FROZEN_DOCS_REL_PATHS = {
    Path("internal/team/people/ivan-boyarkin/sa-growth.html"),
    Path("internal/team/people/ivan-boyarkin/week-calendar-2026-05-07.html"),
}


def _iter_html_files() -> list[Path]:
    """Return all HTML files under services/portal/.

    pdoc-generated output under ``internal/services/api/code-reference/`` is
    skipped — those pages are emitted by an external generator (we cannot
    fix void-tag handling, optional-tag closing, etc. inside its templates).
    """
    out: list[Path] = []
    for path in sorted(DOCS_ROOT.glob("**/*.html")):
        rel = path.relative_to(DOCS_ROOT)
        if rel in FROZEN_DOCS_REL_PATHS:
            continue
        if len(rel.parts) >= 4 and rel.parts[0:4] == (
            "internal",
            "services",
            "api",
            "code-reference",
        ):
            continue
        out.append(path)
    return out


def main() -> None:
    """Validate docs HTML and fail on parser errors or known bad patterns."""
    parser = html5lib.HTMLParser(tree=html5lib.getTreeBuilder("etree"))
    errors: list[str] = []

    for html_path in _iter_html_files():
        rel = html_path.relative_to(ROOT)
        text = html_path.read_text(encoding="utf-8")

        # Guard against a known invalid pattern from earlier regressions.
        if "</wbr>" in text:
            errors.append(f"{rel}: contains invalid closing </wbr> tag")

        parser.errors.clear()
        parser.parse(text)
        if parser.errors:
            first = parser.errors[0]
            errors.append(f"{rel}: html5 parse error {first}")

    if errors:
        print("Docs HTML validation failed:")
        for item in errors:
            print(f" - {item}")
        raise SystemExit(1)

    print("Docs HTML validation passed")


if __name__ == "__main__":
    main()
