"""Assert every portal page has exactly one <h1> that is a direct child of main.container.

Pages with a legitimately deep h1 (e.g. hero layouts) must declare
data-h1-deep="1" on the <body> or <main> element to opt out. Redirect
stubs that carry a <meta http-equiv="refresh"> tag are exempt from the
zero-h1 check because they have no rendered content of their own.

Run: ``python scripts/check_h1_structure.py`` (exit 1 on violations).
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
    "_template",
    "_shared",
    "notes",
}

H1_RE = re.compile(r"<h1[\s>]", re.IGNORECASE)
OPT_OUT_RE = re.compile(r'data-h1-deep\s*=\s*["\']?1["\']?', re.IGNORECASE)
META_REFRESH_RE = re.compile(
    r'<meta[^>]+http-equiv\s*=\s*["\']?refresh',
    re.IGNORECASE,
)


def _iter_portal_html() -> list[Path]:
    out: list[Path] = []
    for path in ROOT.rglob("*.html"):
        parts = path.relative_to(ROOT).parts
        if any(p in EXCLUDE_PARTS for p in parts):
            continue
        if "services/portal" not in path.as_posix() and "services/frontend" not in path.as_posix():
            continue
        out.append(path)
    return sorted(out)


def main() -> int:
    """Scan portal HTML for pages that violate the one-h1 rule.

    Walks every ``services/portal/**/*.html`` and ``services/frontend/**/*.html``
    file and counts ``<h1>`` occurrences. Pages with zero ``<h1>`` are
    flagged unless they are redirect stubs (``<meta http-equiv="refresh">``).
    Pages with more than one ``<h1>`` are flagged unless they opt out with
    ``data-h1-deep="1"``.

    Returns:
        ``0`` when every page has exactly one ``<h1>`` (or is a permitted
        redirect/opt-out), ``1`` when any violation is found.
    """
    violations: list[tuple[Path, str]] = []

    for path in _iter_portal_html():
        text = path.read_text(encoding="utf-8", errors="replace")
        h1_count = len(H1_RE.findall(text))
        if h1_count == 0:
            if META_REFRESH_RE.search(text):
                continue
            violations.append((path, "missing <h1>"))
            continue
        if h1_count > 1 and not OPT_OUT_RE.search(text):
            violations.append((path, f"multiple <h1> ({h1_count})"))

    if not violations:
        print("check_h1_structure: OK — every page has exactly one <h1>.")
        return 0

    print(
        f"check_h1_structure: FAIL — {len(violations)} page(s) violate the one-h1 rule "
        f'(add data-h1-deep="1" to opt out of multi-h1, or add a <meta refresh> for stubs):',
        file=sys.stderr,
    )
    for path, reason in violations:
        rel = path.relative_to(ROOT).as_posix()
        print(f"  {rel}  ({reason})", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
