"""Repair and validate structural HTML issues in docs pages."""

from __future__ import annotations

import argparse
from pathlib import Path

import html5lib

ROOT = Path(__file__).resolve().parents[3]
DOCS_ROOT = ROOT / "services" / "portal"
FROZEN_DOCS_REL_PATHS = {
    Path("internal/team/people/ivan-boyarkin/sa-growth.html"),
    Path("internal/team/people/ivan-boyarkin/week-calendar-2026-05-07.html"),
}


def _iter_target_files() -> list[Path]:
    """Return docs HTML files that should be normalized."""
    targets: list[Path] = []
    for html_path in sorted(DOCS_ROOT.glob("**/*.html")):
        rel = html_path.relative_to(DOCS_ROOT)
        # pdoc output is generator-owned; keep it untouched. Covers both the
        # legacy roots (api/, pdoc/) and the current location
        # services/portal/internal/services/api/code-reference/.
        if rel.parts and rel.parts[0] in {"api", "pdoc"}:
            continue
        if len(rel.parts) >= 4 and rel.parts[0:4] == (
            "internal",
            "services",
            "api",
            "code-reference",
        ):
            continue
        if rel in FROZEN_DOCS_REL_PATHS:
            continue
        targets.append(html_path)
    return targets


def _repair_html(text: str) -> str:
    """Parse and re-serialize HTML5 to fix broken nesting/closing tags.

    Note on idempotency: html5lib emits a literal newline between text nodes and
    closing tags, so each parse-serialize cycle would grow the blank-line gap
    before ``</body></html>``. Collapse runs of >=2 newlines back to exactly one
    blank line before ``</body>`` so a clean file is a fixed point.
    """
    parser = html5lib.HTMLParser(tree=html5lib.getTreeBuilder("etree"))
    document = parser.parse(text)
    repaired = html5lib.serialize(
        document,
        tree="etree",
        omit_optional_tags=False,
        quote_attr_values="always",
        alphabetical_attributes=False,
        inject_meta_charset=False,
    )
    # Collapse "\n\n+" before </body> into a single blank line so repeated
    # repair passes converge.
    import re as _re

    repaired = _re.sub(r"\n{3,}(?=</body>)", "\n\n", repaired)
    if not repaired.endswith("\n"):
        repaired += "\n"
    if not repaired.lower().startswith("<!doctype html>"):
        repaired = "<!doctype html>\n" + repaired.lstrip()
    return repaired


def _collect_drifted_files() -> list[Path]:
    """Return HTML files that differ from normalized HTML5 output."""
    drifted: list[Path] = []
    for html_path in _iter_target_files():
        original = html_path.read_text(encoding="utf-8")
        repaired = _repair_html(original)
        if repaired != original:
            drifted.append(html_path)
    return drifted


def _apply_fixes() -> int:
    """Rewrite drifted files with repaired HTML and return count."""
    updated_count = 0
    for html_path in _iter_target_files():
        original = html_path.read_text(encoding="utf-8")
        repaired = _repair_html(original)
        if repaired != original:
            html_path.write_text(repaired, encoding="utf-8")
            updated_count += 1
    return updated_count


def main() -> None:
    """CLI entrypoint for repair or check mode."""
    parser = argparse.ArgumentParser(description="Repair/validate docs HTML structure.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check mode: fail if any docs HTML file needs repair.",
    )
    args = parser.parse_args()

    if args.check:
        drifted = _collect_drifted_files()
        if drifted:
            print("Docs HTML consistency check failed. Files requiring repair:")
            for path in drifted:
                print(f" - {path.relative_to(ROOT)}")
            raise SystemExit(1)
        print("Docs HTML consistency check passed")
        return

    updated_count = _apply_fixes()
    print(f"Repaired docs HTML files: {updated_count} updated")


if __name__ == "__main__":
    main()
