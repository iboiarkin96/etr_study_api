"""Normalize documentation HTML files to a shared visual template."""

from __future__ import annotations

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS_ROOT = ROOT / "services" / "portal"
ASSETS_ROOT = ROOT / "services" / "frontend" / "portal"
FROZEN_DOCS_REL_PATHS = {
    Path("internal/team/people/ivan-boyarkin/sa-growth.html"),
    Path("internal/team/people/ivan-boyarkin/week-calendar-2026-05-07.html"),
}

STYLE_BLOCK_RE = re.compile(r"(?is)\s*<style>.*?</style>\s*")
STYLESHEET_TAG_RE = re.compile(r'(?ims)^[ \t]*<link\s+rel="stylesheet"[^>]*>\s*')
TOP_NAV_RE = re.compile(r'(?ims)^[ \t]*<nav class="top-nav"[^>]*>.*?</nav>\s*')
TOP_NAV_HOST_RE = re.compile(r'(?ims)^[ \t]*<div id="docs-top-nav"></div>\s*')
NAV_SCRIPT_TAG_RE = re.compile(
    r'(?ims)^[ \t]*<script\s+defer\s+src="[^"]*docs-nav\.js"[^>]*></script>\s*'
)
DOCS_CSS_LINK_RE = re.compile(
    r'(?ims)^[ \t]*<link\s+rel="stylesheet"\s+href="[^"]*assets/docs\.css"[^>]*>\s*'
)
ENTRY_JS_RE = re.compile(
    r'(?ims)<script\s+type="module"\s+src="[^"]*assets_v2/runtime/internal/entry\.js"'
)
INTERNAL_ROOT_REL = Path("internal")
MAIN_WITHOUT_CLASS_RE = re.compile(r"(?is)<main(?![^>]*class=)([^>]*)>")
H1_RE = re.compile(r"(?is)<h1[^>]*>.*?</h1>")
TAG_NAME_RE = re.compile(r"^</?\s*([a-zA-Z0-9:_-]+)")
VOID_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}


def _rel_href(current_file: Path, target_file: Path) -> str:
    """Relative URL from ``current_file``'s directory to ``target_file``.

    Args:
        current_file: HTML file being edited.
        target_file: Asset or link target under the repo.

    Returns:
        POSIX-style relative path, prefixed with ``./`` when it does not start with ``.``.
    """
    rel = os.path.relpath(target_file, start=current_file.parent).replace("\\", "/")
    return rel if rel.startswith(".") else f"./{rel}"


def _is_internal_v3_page(text: str, current_file: Path) -> bool:
    """Return True if ``current_file`` is a v3 UI-Kit page.

    A page is considered "v3" when it loads ``assets_v2/runtime/internal/entry.js``.
    Such pages own their stylesheet/JS stack through ``entry.css``/``entry.js`` and
    must NOT be force-fed the legacy ``docs.css`` + ``docs-nav.js`` pair, which
    injects a second sidebar/drawer/bug-report layer on top of the v3 mounts.

    Covers both the internal portal (``internal/**``) and the UI Kit showcase
    pages (``ui-kit/**``) — both live under ``services/portal/`` and both share
    the v3 runtime.

    Args:
        text: HTML source.
        current_file: Path of the file under :data:`DOCS_ROOT`.

    Returns:
        Whether the page is a v3 UI-Kit page.
    """
    try:
        rel = current_file.relative_to(DOCS_ROOT)
    except ValueError:
        return False
    if not rel.parts:
        return False
    if rel.parts[0] not in {INTERNAL_ROOT_REL.name, "ui-kit"}:
        return False
    return bool(ENTRY_JS_RE.search(text))


def _normalize_stylesheet(text: str, current_file: Path) -> str:
    """Enforce the right stylesheet link in ``<head>``.

    For v3 internal-portal pages (see :func:`_is_internal_v3_page`) the canonical
    stylesheet is ``assets_v2/runtime/internal/entry.css`` and the legacy
    ``assets/docs.css`` link is dropped. For everything else the legacy single
    ``docs.css`` link is enforced.

    Page-local ``<style>`` overlays are intentionally preserved — many v3 pages
    carry small per-page declarations (page-hero gradients, quad-card grids,
    radar lane backgrounds) that complement the shared kit and aren't worth
    promoting into the kit itself. Stripping them silently was the original
    cause of the docs-fix non-idempotency drift (each run removed the styles,
    the user re-added them, the cycle never converged).

    Args:
        text: Full HTML document text.
        current_file: Path to the file (for relative href to :data:`ASSETS_ROOT`).

    Returns:
        Updated HTML string.
    """
    normalized = text

    if _is_internal_v3_page(normalized, current_file):
        target = ASSETS_ROOT / "assets_v2" / "runtime" / "internal" / "entry.css"
        href = _rel_href(current_file, target)
        link_line = f'  <link rel="stylesheet" href="{href}" />'
        # Drop legacy docs.css link if present.
        normalized = DOCS_CSS_LINK_RE.sub("", normalized)
        if f'href="{href}"' in normalized:
            return normalized
        if STYLESHEET_TAG_RE.search(normalized):
            normalized = STYLESHEET_TAG_RE.sub(f"{link_line}\n", normalized, count=1)
        elif "</head>" in normalized:
            normalized = normalized.replace("</head>", f"{link_line}\n</head>", 1)
        return normalized

    href = _rel_href(current_file, ASSETS_ROOT / "assets" / "docs.css")
    link_line = f'  <link rel="stylesheet" href="{href}" />'
    if STYLESHEET_TAG_RE.search(normalized):
        normalized = STYLESHEET_TAG_RE.sub(f"{link_line}\n", normalized, count=1)
    elif "</head>" in normalized:
        normalized = normalized.replace("</head>", f"{link_line}\n</head>", 1)
    return normalized


def _normalize_main(text: str) -> str:
    """Ensure ``<main>`` has ``class="container"`` when missing.

    Args:
        text: HTML source.

    Returns:
        Text with main tag normalized.
    """
    return MAIN_WITHOUT_CLASS_RE.sub(r'<main class="container"\1>', text)


def _normalize_nav_script(text: str, current_file: Path) -> str:
    """Ensure ``docs-nav.js`` is loaded once from the correct relative path.

    On v3 internal-portal pages the legacy script is removed instead — those
    pages mount their UI entirely through ``entry.js``; running ``docs-nav.js``
    on top duplicates the sidebar/drawer/bug-report layer.

    Args:
        text: HTML source.
        current_file: File path for relative script URL resolution.

    Returns:
        Updated HTML.
    """
    if _is_internal_v3_page(text, current_file):
        return NAV_SCRIPT_TAG_RE.sub("", text)

    script_src = _rel_href(current_file, ASSETS_ROOT / "assets" / "docs-nav.js")
    script_line = f'  <script defer src="{script_src}"></script>'
    if NAV_SCRIPT_TAG_RE.search(text):
        return NAV_SCRIPT_TAG_RE.sub(f"{script_line}\n", text, count=1)
    if "</head>" in text:
        return text.replace("</head>", f"{script_line}\n</head>", 1)
    return text


def _normalize_nav(text: str) -> str:
    """Replace legacy top nav markup with the ``docs-top-nav`` host div.

    Args:
        text: HTML after stylesheet/script normalization.

    Returns:
        HTML suitable for client-side nav injection.
    """
    nav_host = '    <div id="docs-top-nav"></div>'
    without_nav = TOP_NAV_RE.sub("", text, count=1)

    if TOP_NAV_HOST_RE.search(without_nav):
        return TOP_NAV_HOST_RE.sub(f"{nav_host}\n", without_nav, count=1)

    h1 = H1_RE.search(without_nav)
    if h1:
        return without_nav[: h1.end()] + "\n" + nav_host + "\n" + without_nav[h1.end() :]

    return without_nav


def _normalize_newlines(text: str) -> str:
    """Normalize line endings and collapse excessive blank lines; ensure trailing newline.

    Args:
        text: Raw HTML.

    Returns:
        Normalized text.
    """
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.rstrip() + "\n"


def _line_tag_name(stripped_line: str) -> str | None:
    """Return lowercased HTML tag name for an opening or closing line, if any.

    Args:
        stripped_line: Single line without surrounding whitespace.

    Returns:
        Tag name, or ``None`` if the line does not start like a tag.
    """
    match = TAG_NAME_RE.match(stripped_line)
    if not match:
        return None
    return match.group(1).lower()


def _is_inline_closed_tag(stripped_line: str) -> bool:
    """Return True if ``stripped_line`` contains both open and close of the same tag.

    Args:
        stripped_line: One line of HTML.

    Returns:
        Whether the line is a self-contained inline element (e.g. ``<p>...</p>``).
    """
    tag_name = _line_tag_name(stripped_line)
    if not tag_name:
        return False
    return (
        stripped_line.startswith(f"<{tag_name}")
        and f"</{tag_name}>" in stripped_line
        and not stripped_line.startswith("</")
    )


def _dedent_pre_block(buffer: list[str], anchor_zero: bool = False) -> list[str]:
    """Strip the longest common leading whitespace from a ``<pre>`` interior.

    Mirrors :func:`textwrap.dedent` but operates on a list of raw lines that
    have already been collected between an opening ``<pre>`` and its closing
    ``</pre>``. Empty lines are ignored when computing the common prefix so a
    blank line in the middle of a code sample doesn't anchor the dedent at 0.

    When ``anchor_zero`` is true the dedent treats the buffer as if there
    were an implicit "indent 0" line — this models the case where the
    opening ``<pre><code>`` had inlined source on the same line (that line
    is not in the buffer but renders at column 0, so the body's whitespace
    must be preserved verbatim).
    """
    non_empty = [line for line in buffer if line.strip()]
    if not non_empty:
        return buffer
    indents = []
    for line in non_empty:
        leading = len(line) - len(line.lstrip(" "))
        indents.append(leading)
    if anchor_zero:
        indents.append(0)
    common = min(indents)
    if common == 0:
        return buffer
    return [line[common:] if len(line) >= common else line for line in buffer]


def _normalize_indentation(text: str) -> str:
    """Re-indent HTML with two spaces per nesting level (skip void and inline-closed tags).

    Lines inside a ``<pre>`` element are preserved verbatim — code blocks are
    whitespace-significant and historically the indenter walked into them and
    pushed everything right, breaking flush-left rendering and Markdown inside
    ``language-markdown`` blocks. After collecting the interior we run a
    ``textwrap``-style dedent on it so legacy files that have drifted right
    come back to the left edge.

    Args:
        text: HTML with arbitrary indentation.

    Returns:
        Pretty-printed HTML lines.
    """
    lines = text.split("\n")
    indent = 0
    normalized_lines: list[str] = []
    pre_depth = 0  # how many <pre> elements we are currently inside
    pre_base_indent = ""  # leading whitespace of the opening <pre> line
    pre_buffer: list[str] = []  # interior lines collected verbatim
    pre_has_inline_first = False  # <pre><code>FIRSTLINE… (first line at col 0)

    for raw_line in lines:
        stripped = raw_line.strip()

        # Inside <pre>: collect verbatim until matching </pre>.
        if pre_depth > 0:
            opens_in_line = raw_line.count("<pre")
            closes_in_line = raw_line.count("</pre>")
            new_depth = pre_depth + opens_in_line - closes_in_line
            if new_depth <= 0:
                # Flush the interior with a one-shot dedent, then close </pre>.
                # If the opening <pre> line had inlined content, that first
                # line sits at column 0 and acts as an indent anchor; pass it
                # so the dedent can't strip the body's leading whitespace.
                normalized_lines.extend(
                    _dedent_pre_block(pre_buffer, anchor_zero=pre_has_inline_first)
                )
                normalized_lines.append(pre_base_indent + stripped)
                pre_depth = 0
                pre_base_indent = ""
                pre_buffer = []
                pre_has_inline_first = False
                continue
            pre_buffer.append(raw_line)
            pre_depth = new_depth
            continue

        if not stripped:
            normalized_lines.append("")
            continue

        is_closing = stripped.startswith("</")
        if is_closing:
            indent = max(indent - 1, 0)

        line_indent = "  " * indent
        normalized_lines.append(line_indent + stripped)

        if stripped.startswith("<!"):
            continue

        tag_name = _line_tag_name(stripped)
        if not tag_name:
            continue

        is_opening = stripped.startswith("<") and not stripped.startswith("</")
        if not is_opening:
            continue
        if stripped.endswith("/>"):
            continue
        if tag_name in VOID_TAGS:
            continue
        if _is_inline_closed_tag(stripped):
            continue

        # Enter <pre>: switch to verbatim collection until </pre>.
        if tag_name == "pre" and "</pre>" not in stripped:
            pre_depth = 1
            pre_base_indent = line_indent
            pre_buffer = []
            # Detect inlined first line of code on the same line as <pre><code>:
            # the rightmost '>' that closes the opening <pre…> or <code…> tag
            # has content after it. That content is at column 0 in the rendered
            # block and must anchor the buffer's dedent.
            last_gt = stripped.rfind(">")
            pre_has_inline_first = last_gt >= 0 and last_gt < len(stripped) - 1
            continue

        indent += 1

    return "\n".join(normalized_lines)


def format_html_file(path: Path) -> bool:
    """Apply all normalizations to one HTML file; write only if content changed.

    Args:
        path: HTML file under :data:`DOCS_ROOT`.

    Returns:
        ``True`` if the file was modified, else ``False``.
    """
    original = path.read_text(encoding="utf-8")
    updated = _normalize_stylesheet(original, path)
    updated = _normalize_nav_script(updated, path)
    updated = _normalize_main(updated)
    updated = _normalize_nav(updated)
    updated = _normalize_indentation(updated)
    updated = _normalize_newlines(updated)
    if updated == original:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def main() -> None:
    """Walk all ``services/portal/**/*.html`` (except ``services/portal/internal/governance/backlog/**`` and ``services/portal/internal/services/api/code-reference/**``) and normalize in place.

    Prints the count of updated files.
    """
    updated_count = 0
    for html_path in sorted(DOCS_ROOT.glob("**/*.html")):
        try:
            rel = html_path.relative_to(DOCS_ROOT)
        except ValueError:
            continue
        # pdoc output for `make api-docs`; keep generator-owned HTML untouched.
        if rel.parts and rel.parts[0] == "pdoc":
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
        if format_html_file(html_path):
            updated_count += 1
    print(f"Formatted docs HTML files: {updated_count} updated")


if __name__ == "__main__":
    main()
