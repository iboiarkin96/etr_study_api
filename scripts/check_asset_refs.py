"""Check that asset references in HTML/CSS resolve on disk.

Scans HTML for ``href=``, ``src=``, ``poster=``, ``data-src=`` attributes and CSS
for ``url(...)``. For each reference that is a relative or root-absolute path
(not ``http://``, ``https://``, ``data:``, ``mailto:``, ``tel:``, ``#fragment``),
we resolve it relative to the file's directory (or the repo root for paths
starting with ``/``) and assert the target exists.

Out of scope (intentionally skipped):

* Cross-origin URLs (http/https/protocol-relative).
* ``data:`` URIs and ``mailto:``/``tel:`` schemes.
* Pure fragment links (``#id``) — anchor validity is enforced by other checkers.
* References inside the auto-generated ``code-reference/`` and ``pdoc/`` trees.
* Templated paths containing ``{`` or ``}`` (we treat any ``{`` in the literal
  as a template marker and skip).

Run: ``python scripts/check_asset_refs.py`` (exit 1 on any broken reference).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]

EXCLUDE_PARTS = {
    ".venv",
    ".git",
    "node_modules",
    "__pycache__",
    "code-reference",
    "pdoc",
    "notes",
    "var",
}

HTML_ATTR_RE = re.compile(
    r"""(?:href|src|poster|data-src)\s*=\s*(?P<q>["'])(?P<val>[^"']+)(?P=q)""",
    re.IGNORECASE,
)
# Strip <code>...</code> blocks before scanning so that code examples
# containing href= or src= text are not treated as real asset references.
CODE_BLOCK_RE = re.compile(r"<code[^>]*>.*?</code>", re.IGNORECASE | re.DOTALL)
# Strip HTML comments so that commented-out img/link examples don't fire.
HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
CSS_URL_RE = re.compile(r"""url\(\s*(?P<q>['"]?)(?P<val>[^)'"]+)(?P=q)\s*\)""")

SKIP_PREFIXES = ("http://", "https://", "//", "data:", "mailto:", "tel:", "javascript:", "#", "%")


def _is_skippable(ref: str) -> bool:
    if not ref or ref.startswith(SKIP_PREFIXES):
        return True
    if "{" in ref or "}" in ref or "$" in ref:
        return True
    # Template / placeholder paths in `_template.html`, `_shared/`, `screens/` files:
    # `<resource>`, `&lt;slug&gt;`, `<screen-id>`, ellipsis `…`, literal `...`,
    # or a single `.` or `..`. These are not real assets — they're docs about
    # how to fill in a path, and resolving them is meaningless.
    if "<" in ref or ">" in ref or "&lt;" in ref or "&gt;" in ref:
        return True
    if "…" in ref or "..." in ref:
        return True
    return False


def _resolve(ref: str, source: Path) -> Path:
    ref = ref.split("#", 1)[0].split("?", 1)[0]
    ref = unquote(ref)
    if ref.startswith("/"):
        return (ROOT / ref.lstrip("/")).resolve()
    return (source.parent / ref).resolve()


def _iter_files(suffixes: tuple[str, ...]) -> list[Path]:
    out: list[Path] = []
    for suffix in suffixes:
        for path in ROOT.rglob(f"*{suffix}"):
            rel_parts = path.relative_to(ROOT).parts
            if any(part in EXCLUDE_PARTS for part in rel_parts):
                continue
            out.append(path)
    return sorted(out)


def _scan_html(path: Path) -> list[tuple[int, str]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    # Remove code examples and HTML comments before line-based scanning
    # so that href=/src= inside <code> or <!-- --> are not treated as real refs.
    cleaned = CODE_BLOCK_RE.sub("", HTML_COMMENT_RE.sub("", text))
    out: list[tuple[int, str]] = []
    for line_no, line in enumerate(cleaned.splitlines(), start=1):
        for match in HTML_ATTR_RE.finditer(line):
            out.append((line_no, match.group("val")))
    return out


def _scan_css(path: Path) -> list[tuple[int, str]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    out: list[tuple[int, str]] = []
    for line_no, line in enumerate(text.splitlines(), start=1):
        for match in CSS_URL_RE.finditer(line):
            out.append((line_no, match.group("val")))
    return out


def main() -> int:
    broken: list[tuple[Path, int, str, Path]] = []
    checked = 0

    for path in _iter_files((".html",)):
        for line_no, ref in _scan_html(path):
            if _is_skippable(ref):
                continue
            try:
                target = _resolve(ref, path)
            except (OSError, ValueError):
                continue
            checked += 1
            if not target.exists():
                broken.append((path, line_no, ref, target))

    for path in _iter_files((".css",)):
        for line_no, ref in _scan_css(path):
            if _is_skippable(ref):
                continue
            try:
                target = _resolve(ref, path)
            except (OSError, ValueError):
                continue
            checked += 1
            if not target.exists():
                broken.append((path, line_no, ref, target))

    if not broken:
        print(f"check_asset_refs: OK — {checked} references checked, all resolve.")
        return 0

    print(
        f"check_asset_refs: FAIL — {len(broken)} broken references (of {checked} checked):",
        file=sys.stderr,
    )
    for path, line_no, ref, target in broken:
        rel = path.relative_to(ROOT).as_posix()
        try:
            target_rel = target.relative_to(ROOT).as_posix()
        except ValueError:
            target_rel = str(target)
        print(f"  {rel}:{line_no}  {ref!r}  →  {target_rel}  (not found)", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
