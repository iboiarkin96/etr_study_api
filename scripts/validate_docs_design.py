"""Validate design-consistency baseline for docs HTML pages.

This check enforces the shared page skeleton from
``services/portal/internal/front/_shared/style-guide.html`` for non-generated docs pages.
Generated Python API HTML under ``services/portal/internal/services/api/code-reference/`` is skipped (same as legacy ``services/portal/api/`` output).
It is intentionally lightweight: fail only on clear structural regressions.
"""

from __future__ import annotations

import sys
from pathlib import Path

import html5lib

ROOT = Path(__file__).resolve().parent.parent
DOCS_ROOT = ROOT / "services" / "portal"
FROZEN_DOCS_REL_PATHS = {
    Path("internal/team/people/ivan-boyarkin/sa-growth.html"),
    # Standalone week backlog calendar (custom layout, not portal doc skeleton).
    Path("internal/team/people/ivan-boyarkin/week-calendar-2026-05-07.html"),
    # Portal router landings — intentional selector layouts. They pick between
    # sub-portals and aren't docs pages themselves; no docs-nav, no top-nav
    # mount, no section.card, no page-history.
    Path("index.html"),
    Path("internal/index.html"),
    # Standalone 25-practices radar grids with their own embedded chart tokens;
    # not part of the docs skeleton. Each role has its radar at
    # team/roles/<role>/radar.html and a curated landing at
    # team/roles/<role>/index.html.
    Path("internal/team/roles/sa/radar.html"),
    Path("internal/team/roles/architect/radar.html"),
    Path("internal/team/roles/dev/radar.html"),
    Path("internal/team/roles/manager/radar.html"),
    Path("internal/team/roles/sre/radar.html"),
    Path("internal/team/roles/qa/radar.html"),
}


def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[1]
    return tag


def _iter_docs_pages(candidates: list[str] | None = None) -> list[Path]:
    pages: list[Path] = []
    if candidates:
        raw_paths = [Path(item).resolve() for item in candidates]
    else:
        raw_paths = sorted(DOCS_ROOT.glob("**/*.html"))

    for path in raw_paths:
        if not path.is_file() or path.suffix.lower() != ".html":
            continue
        if DOCS_ROOT not in path.parents:
            continue
        rel = path.relative_to(DOCS_ROOT)
        if rel.parts and rel.parts[0] in {"api", "assets", "pdoc"}:
            continue
        # UI Kit v2 showcase uses a different baseline:
        # assets_v2/runtime/internal/entry.{css,js} instead of legacy
        # docs.css + docs-nav.js. Exempt from the legacy design baseline.
        if rel.parts and rel.parts[0] == "ui-kit":
            continue
        # Generated pdoc tree under internal/services/api/code-reference/ is opaque.
        if len(rel.parts) >= 4 and rel.parts[0:4] == (
            "internal",
            "services",
            "api",
            "code-reference",
        ):
            continue
        if rel in FROZEN_DOCS_REL_PATHS:
            continue
        # Scratch HTML under per-person `notes/` (gitignored locally; never shipped).
        # Path shape: internal/team/people/<person>/notes/*.html
        if (
            len(rel.parts) >= 5
            and rel.parts[0:3] == ("internal", "team", "people")
            and rel.parts[4] == "notes"
        ):
            continue
        pages.append(path)
    return pages


def _is_redirect_stub(root_el, text: str) -> bool:
    for node in root_el.iter():
        if not isinstance(node.tag, str):
            continue
        if _local_name(node.tag) != "meta":
            continue
        equiv = (node.attrib.get("http-equiv") or "").lower()
        if equiv == "refresh":
            return True
    lowered = text.lower()
    if "window.location.replace(" in lowered and 'rel="canonical"' in lowered:
        return True
    if "<title>moved" in lowered:
        return True
    return False


def _has_docs_css(root_el) -> bool:
    """Accept either the legacy ``docs.css`` link or the UI Kit v2 bundle
    (``assets_v2/runtime/internal/entry.css``) — both load the docs design
    tokens + component CSS the rest of this hook validates against."""
    for node in root_el.iter():
        if not isinstance(node.tag, str) or _local_name(node.tag) != "link":
            continue
        if (node.attrib.get("rel") or "").lower() != "stylesheet":
            continue
        href = (node.attrib.get("href") or "").lower()
        if "docs.css" in href or "assets_v2/runtime/internal/entry.css" in href:
            return True
    return False


def _has_docs_nav_script(root_el) -> bool:
    """Accept either the legacy ``docs-nav.js`` script or the UI Kit v2
    runtime entry (``assets_v2/runtime/internal/entry.js``)."""
    for node in root_el.iter():
        if not isinstance(node.tag, str) or _local_name(node.tag) != "script":
            continue
        src = (node.attrib.get("src") or "").lower()
        if "docs-nav.js" in src or "assets_v2/runtime/internal/entry.js" in src:
            return True
    return False


def _find_main_container(root_el) -> bool:
    for node in root_el.iter():
        if not isinstance(node.tag, str) or _local_name(node.tag) != "main":
            continue
        classes = set((node.attrib.get("class") or "").split())
        if "container" in classes:
            return True
    return False


def _is_swagger_layout(root_el) -> bool:
    for node in root_el.iter():
        if not isinstance(node.tag, str) or _local_name(node.tag) != "main":
            continue
        classes = set((node.attrib.get("class") or "").split())
        if "container--swagger" in classes:
            return True
    return False


def _has_top_nav_mount(root_el) -> bool:
    for node in root_el.iter():
        if not isinstance(node.tag, str) or _local_name(node.tag) != "div":
            continue
        if node.attrib.get("id") == "docs-top-nav":
            return True
    return False


def _count_tag(root_el, tag_name: str) -> int:
    count = 0
    for node in root_el.iter():
        if isinstance(node.tag, str) and _local_name(node.tag) == tag_name:
            count += 1
    return count


def _is_new_kit_page(root_el) -> bool:
    """UI Kit v2 pages declare ``<body class="docs-shell">`` to opt into the
    kit's grid layout (sidebar + main + TOC). The kit's content container is
    ``<main class="container">``, not ``<section class="card">`` — so the
    legacy card-section requirement doesn't apply to these pages."""
    for node in root_el.iter():
        if not isinstance(node.tag, str) or _local_name(node.tag) != "body":
            continue
        classes = set((node.attrib.get("class") or "").split())
        return "docs-shell" in classes
    return False


def _has_section_card(root_el) -> bool:
    """Legacy pages wrap content in ``<section class="card">``; UI Kit v2
    pages use ``<article class="docs-prose">`` containing kit primitives
    (``.sa-section``, ``.docs-card``, ``.pa-section``). Accept either."""
    for node in root_el.iter():
        if not isinstance(node.tag, str):
            continue
        tag = _local_name(node.tag)
        classes = set((node.attrib.get("class") or "").split())
        if tag == "section" and "card" in classes:
            return True
        if tag == "article" and "docs-prose" in classes:
            return True
        if tag == "section" and (
            "sa-section" in classes or "docs-card" in classes or "pa-section" in classes
        ):
            return True
    return False


def _has_page_history_section(root_el) -> bool:
    """Legacy hub pages use ``<section id="page-history">``; assessment
    reports use ``id="5-page-history"``; UI Kit v2 pages use
    ``<footer class="docs-history">`` (kit component ``footer-history``)."""
    for node in root_el.iter():
        if not isinstance(node.tag, str):
            continue
        tag = _local_name(node.tag)
        if tag == "section":
            sid = (node.attrib.get("id") or "").strip()
            if sid in ("page-history", "5-page-history"):
                return True
        if tag == "footer":
            classes = set((node.attrib.get("class") or "").split())
            if "docs-history" in classes:
                return True
    return False


def _has_body_maintainers(root_el) -> bool:
    for node in root_el.iter():
        if not isinstance(node.tag, str) or _local_name(node.tag) != "body":
            continue
        maintainer_ids = (node.attrib.get("data-maintainer-ids") or "").strip()
        return bool(maintainer_ids)
    return False


def main() -> None:
    parser = html5lib.HTMLParser(tree=html5lib.getTreeBuilder("etree"))
    failures: list[str] = []

    for path in _iter_docs_pages(sys.argv[1:]):
        rel = path.relative_to(ROOT)
        text = path.read_text(encoding="utf-8")
        doc = parser.parse(text)
        if parser.errors:
            failures.append(f"{rel}: HTML5 parse errors ({len(parser.errors)})")
            parser.errors.clear()
            continue

        redirect_stub = _is_redirect_stub(doc, text)

        # Redirect stubs (meta http-equiv="refresh") are by definition tiny
        # forwarding pages — they don't carry the docs skeleton.
        if not redirect_stub:
            if not _has_docs_css(doc):
                failures.append(f"{rel}: missing docs.css stylesheet link")
            if not _has_docs_nav_script(doc):
                failures.append(f"{rel}: missing docs-nav.js script link")

        if not redirect_stub:
            swagger_layout = _is_swagger_layout(doc)
            new_kit_page = _is_new_kit_page(doc)
            # The public developer portal is intentionally isolated from the
            # internal docs skeleton — it does not carry the Page history block
            # because external consumers don't need internal change provenance.
            is_public_portal = path.relative_to(DOCS_ROOT).parts[:1] == ("public",)
            if not _find_main_container(doc):
                failures.append(f'{rel}: missing <main class="container"> baseline')
            if _count_tag(doc, "h1") != 1:
                failures.append(f"{rel}: expected exactly one <h1>")
            if not _has_top_nav_mount(doc):
                failures.append(f'{rel}: missing <div id="docs-top-nav"></div>')
            # UI Kit v2 pages (body.docs-shell) use <main class="container">
            # with kit primitives instead of section.card — the card check
            # is a legacy concept that doesn't apply to them.
            if (
                not swagger_layout
                and not is_public_portal
                and not new_kit_page
                and not _has_section_card(doc)
            ):
                failures.append(f'{rel}: expected at least one <section class="card">')
            if not swagger_layout and not is_public_portal and not _has_page_history_section(doc):
                failures.append(
                    f"{rel}: missing Page history section "
                    f'(<section id="page-history"> or assessment <section> with id="5-page-history"); '
                    f"see services/portal/internal/front/_shared/style-guide.html#page-history"
                )
            if not _has_body_maintainers(doc):
                failures.append(
                    f'{rel}: missing <body data-maintainer-ids="..."> required for the Edited by block'
                )

        if '<div class="card"' in text:
            failures.append(
                f'{rel}: legacy \'<div class="card">\' found; use <section class="card">'
            )

    if failures:
        print("Docs design baseline check failed:")
        for item in failures:
            print(f" - {item}")
        raise SystemExit(1)

    print("Docs design baseline check passed")


if __name__ == "__main__":
    main()
