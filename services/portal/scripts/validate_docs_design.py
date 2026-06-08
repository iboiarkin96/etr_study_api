"""Validate design-consistency baseline for docs HTML pages.

This check enforces the UI Kit v2 page skeleton (``assets_v2/runtime/<portal>/``)
for non-generated docs pages. Legacy ``docs.css``/``docs-nav.js`` references are
treated as failures — every page must be on the v2 runtime.

Generated Python API HTML under ``services/portal/internal/services/api/code-reference/``
and a small allowlist of governance templates that haven't been migrated yet are
exempted.
"""

from __future__ import annotations

import sys
from pathlib import Path

import html5lib

ROOT = Path(__file__).resolve().parents[3]
DOCS_ROOT = ROOT / "services" / "portal"

# Pages that intentionally bypass the v2 docs skeleton:
#   * Portal router landings (no portal-specific shell — they pick between
#     sub-portals before the page is laid out).
#   * Personal calendar / growth pages with custom layouts.
#   * Standalone radar pages — embedded charts with their own shell.
FROZEN_DOCS_REL_PATHS = {
    Path("index.html"),
    Path("internal/index.html"),
    Path("internal/team/people/ivan-boyarkin/sa-growth.html"),
    Path("internal/team/people/ivan-boyarkin/week-calendar-2026-05-07.html"),
    Path("internal/team/roles/sa/radar.html"),
    Path("internal/team/roles/architect/radar.html"),
    Path("internal/team/roles/swe/radar.html"),
    Path("internal/team/roles/manager/radar.html"),
    Path("internal/team/roles/sre/radar.html"),
    Path("internal/team/roles/qa/radar.html"),
}

# Pages that still load the legacy stack and are scheduled for separate
# migration. The validator skips them rather than failing CI.
# Remove an entry once that page has been migrated to the v2 runtime.
LEGACY_PENDING_MIGRATION = {
    Path("internal/handbook/sa/templates/component-spec.html"),
    Path("internal/governance/adr/0018-adr-lifecycle-ratification-and-badges.html"),
    Path("internal/governance/adr/0020-c4-plantuml-diagram-style-and-conventions.html"),
    Path("internal/governance/adr/0024-architecture-and-quality-assessment-documents.html"),
    Path("internal/governance/adr/0026-internal-service-documentation-as-source-of-truth.html"),
    Path("internal/governance/adr/0027-client-side-docs-search-index-and-ranking.html"),
    Path("internal/governance/rfc/0001-docs-search-implementation.html"),
    Path("internal/governance/rfc/0003-documentation-authoring-model.html"),
    Path("internal/governance/rfc/0004-public-vs-internal-documentation-portal-ia.html"),
}

# Legacy asset hrefs/srcs that must never appear on real <link>/<script> tags
# of a v2 page. Matched against the parsed tree, so prose mentions inside
# <code>/<pre> are unaffected.
LEGACY_LINK_FRAGMENTS = (
    "/assets/docs.css",
    "/assets/docs-theme.css",
    "/assets/docs-nav.js",
    "/assets/docs-syntax.js",
    "/assets/public-layout.css",
    "/assets/public-sidebar.js",
    "/assets/home.css",
    "/assets/home-landing.js",
    "/assets/home-webgl.js",
)

# Legacy class names that must not appear on real elements of a v2 page.
LEGACY_CLASS_NAMES = {
    "public-layout",
    "internal-layout",
    "public-layout__shell",
    "public-layout__sidebar",
    "public-layout__main",
    "internal-layout__shell",
    "internal-layout__main",
    "internal-h1--accent-tail",
    "container--swagger",
}

# Legacy element ids that must not appear in a v2 page.
LEGACY_IDS = {
    "public-sidebar-mount",
    "internal-sidebar-mount",
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
        # Generated pdoc tree under internal/services/api/code-reference/ is opaque.
        if len(rel.parts) >= 4 and rel.parts[0:4] == (
            "internal",
            "services",
            "api",
            "code-reference",
        ):
            continue
        # UI Kit showcase: own baseline, validated by its own showcase rules.
        if rel.parts and rel.parts[0] == "ui-kit":
            continue
        if rel in FROZEN_DOCS_REL_PATHS:
            continue
        if rel in LEGACY_PENDING_MIGRATION:
            continue
        # Scratch HTML under per-person `notes/` (gitignored locally; never shipped).
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


def _html_data_portal(root_el) -> str | None:
    for node in root_el.iter():
        if not isinstance(node.tag, str) or _local_name(node.tag) != "html":
            continue
        portal = (node.attrib.get("data-portal") or "").strip().lower()
        if portal in {"internal", "public"}:
            return portal
        return None
    return None


def _has_v2_entry_css(root_el, portal: str) -> bool:
    needle = f"assets_v2/runtime/{portal}/entry.css"
    for node in root_el.iter():
        if not isinstance(node.tag, str) or _local_name(node.tag) != "link":
            continue
        if (node.attrib.get("rel") or "").lower() != "stylesheet":
            continue
        href = node.attrib.get("href") or ""
        if needle in href:
            return True
    return False


def _has_v2_entry_js(root_el, portal: str) -> bool:
    needle = f"assets_v2/runtime/{portal}/entry.js"
    for node in root_el.iter():
        if not isinstance(node.tag, str) or _local_name(node.tag) != "script":
            continue
        src = node.attrib.get("src") or ""
        if needle in src:
            return True
    return False


def _body_has_class(root_el, class_name: str) -> bool:
    for node in root_el.iter():
        if not isinstance(node.tag, str) or _local_name(node.tag) != "body":
            continue
        classes = set((node.attrib.get("class") or "").split())
        return class_name in classes
    return False


def _find_main_container(root_el) -> bool:
    for node in root_el.iter():
        if not isinstance(node.tag, str) or _local_name(node.tag) != "main":
            continue
        classes = set((node.attrib.get("class") or "").split())
        if "container" in classes:
            return True
    return False


def _has_sidebar_mount(root_el) -> bool:
    for node in root_el.iter():
        if not isinstance(node.tag, str) or _local_name(node.tag) != "aside":
            continue
        if (node.attrib.get("data-component") or "").strip() == "sidebar":
            return True
    return False


def _has_topbar(root_el) -> bool:
    for node in root_el.iter():
        if not isinstance(node.tag, str) or _local_name(node.tag) != "header":
            continue
        classes = set((node.attrib.get("class") or "").split())
        if "topbar" in classes:
            return True
    return False


def _count_tag(root_el, tag_name: str) -> int:
    count = 0
    for node in root_el.iter():
        if isinstance(node.tag, str) and _local_name(node.tag) == tag_name:
            count += 1
    return count


def _legacy_violations(root_el) -> list[str]:
    """Return human-readable descriptions of legacy markup in the parsed tree.

    Only elements (and their attributes) are inspected — text content,
    ``<code>`` and ``<pre>`` blocks remain free to discuss legacy names in
    prose. Returns one string per distinct violation.
    """
    hits: list[str] = []
    seen_links: set[str] = set()
    seen_classes: set[str] = set()
    seen_ids: set[str] = set()
    for node in root_el.iter():
        if not isinstance(node.tag, str):
            continue
        tag = _local_name(node.tag)
        if tag == "link":
            href = node.attrib.get("href") or ""
            for needle in LEGACY_LINK_FRAGMENTS:
                if needle in href and needle not in seen_links:
                    hits.append(f"<link> href='{needle}'")
                    seen_links.add(needle)
        elif tag == "script":
            src = node.attrib.get("src") or ""
            for needle in LEGACY_LINK_FRAGMENTS:
                if needle in src and needle not in seen_links:
                    hits.append(f"<script> src='{needle}'")
                    seen_links.add(needle)
        classes = set((node.attrib.get("class") or "").split())
        for cls in LEGACY_CLASS_NAMES & classes:
            if cls in seen_classes:
                continue
            hits.append(f"class '{cls}' on <{tag}>")
            seen_classes.add(cls)
        el_id = node.attrib.get("id")
        if el_id and el_id in LEGACY_IDS and el_id not in seen_ids:
            hits.append(f"id '{el_id}' on <{tag}>")
            seen_ids.add(el_id)
    return hits


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

        # Legacy assets/classes/ids: check via the parsed tree so prose
        # mentions of legacy names inside <code>/<pre>/text content stay legal.
        legacy_hits = _legacy_violations(doc)
        for hit in legacy_hits:
            failures.append(f"{rel}: legacy {hit} (must be on UI Kit v2)")

        if redirect_stub:
            # Redirect stubs only need to be portal-correct; no shell required.
            portal = _html_data_portal(doc)
            if portal is None:
                failures.append(f'{rel}: missing <html data-portal="internal|public">')
            continue

        portal = _html_data_portal(doc)
        if portal is None:
            failures.append(f'{rel}: missing <html data-portal="internal|public">')
            continue

        if not _has_v2_entry_css(doc, portal):
            failures.append(
                f"{rel}: missing v2 runtime entry "
                f"(<link rel=stylesheet href=…/assets_v2/runtime/{portal}/entry.css>)"
            )
        if not _has_v2_entry_js(doc, portal):
            failures.append(
                f"{rel}: missing v2 runtime entry "
                f"(<script type=module src=…/assets_v2/runtime/{portal}/entry.js>)"
            )
        if not _body_has_class(doc, "docs-shell"):
            failures.append(f'{rel}: missing <body class="docs-shell"> (v2 shell)')
        if not _find_main_container(doc):
            failures.append(f'{rel}: missing <main class="container"> baseline')
        if not _has_sidebar_mount(doc):
            failures.append(f'{rel}: missing <aside data-component="sidebar"> (v2 sidebar mount)')
        if not _has_topbar(doc):
            failures.append(f'{rel}: missing <header class="topbar"> (v2 topbar)')
        if _count_tag(doc, "h1") != 1:
            failures.append(f"{rel}: expected exactly one <h1>")
        if not _has_body_maintainers(doc):
            failures.append(
                f'{rel}: missing <body data-maintainer-ids="…"> required for the Edited by block'
            )

    if failures:
        print("Docs design baseline check failed:")
        for item in failures:
            print(f" - {item}")
        raise SystemExit(1)

    print("Docs design baseline check passed")


if __name__ == "__main__":
    main()
