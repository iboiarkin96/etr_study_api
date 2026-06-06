"""Render service catalog HTML from per-service catalog-info.yaml.

YAML lives at services/portal/internal/services/<name>/catalog-info.yaml.
The script regenerates three regions, each bracketed by
``<!-- catalog:start id="…" --> ... <!-- catalog:end -->`` markers:

* Per-service entity card in ``<name>/index.html``         (region "entity-card")
* Catalog tile grid in ``services/index.html``             (region "catalog-grid")
* Hero lifecycle tickers in ``services/index.html``        (region "catalog-tickers")
* ``services`` subtree of ``nav-tree-internal.json``

YAML is the single source of truth. ``--check`` exits non-zero if the on-disk
HTML/JSON does not match what the YAML would produce — used by pre-commit.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections.abc import Iterable
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
SERVICES_DIR = ROOT / "services/portal/internal/services"
HUB_HTML = SERVICES_DIR / "index.html"
NAV_TREE = ROOT / "services/frontend/portal/assets_v2/ui-kit/mocks/nav-tree-internal.json"

START = "<!-- catalog:start"
END = "<!-- catalog:end -->"

# Dep-lane icon registry. Single-line SVGs so per-chip diffs stay readable.
ICONS: dict[str, str] = {
    "bolt": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z"/></svg>',
    "database": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="2.5"/><path d="M4 5v6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V5"/><path d="M4 11v6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-6"/></svg>',
    "cylinder": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/></svg>',
    "cylinder-planned": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/><circle cx="17" cy="6" r="2" fill="currentColor" stroke="none"/></svg>',
    "refresh": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><polyline points="20 4 20 9 15 9"/></svg>',
    "shield": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z"/><polyline points="9 12 11 14 15 10"/></svg>',
    "logs": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
    "cache": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 3 21 8 21 16 12 21 3 16 3 8 12 3"/><path d="M12 8v8M8 10v4M16 10v4"/></svg>',
    "python": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 8 5 12 9 16"/><polyline points="15 8 19 12 15 16"/><line x1="13" y1="6" x2="11" y2="18"/></svg>',
    "plantuml": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="16" width="7" height="5" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/><path d="M6.5 8v8M17.5 8h-7v3M17.5 8v8"/></svg>',
    "pdoc": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16M4 4h11a4 4 0 0 1 4 4v12H8a4 4 0 0 0-4 0"/><path d="M8 8h7M8 12h7M8 16h5"/></svg>',
    "nginx": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2"/><path d="M9 17V8l6 9V8"/></svg>',
    "palette": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 11l-9 9-3-3 9-9"/><path d="M14 6l4 4"/><circle cx="6" cy="18" r="2"/></svg>',
    "braces": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4c-3 0-3 3-3 4s0 4-2 4c2 0 2 3 2 4s0 4 3 4"/><path d="M16 4c3 0 3 3 3 4s0 4 2 4c-2 0-2 3-2 4s0 4-3 4"/></svg>',
    "font": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5h16v2"/><path d="M9 5v14M15 5v14M6 19h12"/></svg>',
    "scrape": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 12h10"/><path d="M14 9l3 3-3 3"/></svg>',
    "grid": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
    "file": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><polyline points="14 3 14 8 19 8"/><path d="M9 14h6"/><path d="M12 11v6"/></svg>',
    "containers": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="13" width="5" height="5"/><rect x="9" y="13" width="5" height="5"/><rect x="15" y="13" width="5" height="5"/><rect x="6" y="8" width="5" height="5"/><rect x="12" y="8" width="5" height="5"/><rect x="9" y="3" width="5" height="5"/></svg>',
}

# `spec.owner` lookups: "user:<id>" → display + portal-relative href fragments.
# The two href variants cover (1) entity card pages two levels below the hub
# and (2) the hub page itself which is one level below internal/.
PEOPLE: dict[str, dict[str, str]] = {
    "ivan-boyarkin": {
        "name": "Ivan Boyarkin",
        "href_from_entity": "../../team/people/ivan-boyarkin/index.html",
        "href_from_hub": "../team/people/ivan-boyarkin/index.html",
    },
}

# Hub tile leading icon. Lives here (not in YAML) because it is a hub-only
# concern outside the Backstage descriptor surface.
HUB_TILE_ICONS: dict[str, str] = {
    "api": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
    "portal": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h4"/></svg>',
    "monitoring": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-6 4 4 5-7 4 5"/><path d="M3 21h18"/></svg>',
    "ui-kit": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
}

# Six-page spine. Missing files render as a `svc-spine__missing` placeholder.
SPINE_PAGES: tuple[tuple[str, str], ...] = (
    ("index.html", "Entity"),
    ("architecture.html", "Architecture"),
    ("api-reference.html", "API reference"),
    ("runbooks.html", "Runbooks"),
    ("dependencies.html", "Dependencies"),
    ("on-call.html", "On-call"),
)

# Diataxis subdirectories that may sit alongside the spine in a service tree.
# When present, the generator walks the subtree and emits sidebar entries.
DIATAXIS_SUBDIRS: tuple[tuple[str, str, str], ...] = (
    ("how-to", "How-to", "🛠"),
    ("reference", "Reference", "📖"),
    ("explanation", "Explanation", "💡"),
    ("runbooks", "Runbooks", "🚨"),
    ("postmortems", "Postmortems", "📋"),
)

# Sidebar-nav service labels. Defaults to title-case of the directory name;
# add an entry here when that default would be wrong (acronyms etc.).
NAV_LABELS: dict[str, str] = {
    "api": "API",
    "ui-kit": "UI Kit",
}


def _nav_label(name: str) -> str:
    if name in NAV_LABELS:
        return NAV_LABELS[name]
    return name.replace("-", " ").title()


LIFECYCLE_PILL_TONE: dict[str, str] = {
    "stable": "success",
    "experimental": "warn",
    "deprecated": "neutral",
}

# Hub tile uses `--warning`, not `--warn` (the hub never migrated to the
# entity-card palette). Kept separate to preserve the existing CSS contract.
HUB_LIFECYCLE_TILE_TONE: dict[str, str] = {
    "stable": "success",
    "experimental": "warn",
    "deprecated": "neutral",
}


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def load_services() -> list[dict]:
    """Return descriptors sorted by ``x-study-app.display-order``."""
    services = []
    for ci in SERVICES_DIR.glob("*/catalog-info.yaml"):
        data = yaml.safe_load(ci.read_text())
        data["_path"] = ci
        data["_name"] = ci.parent.name
        services.append(data)
    services.sort(key=lambda s: (s.get("x-study-app", {}).get("display-order", 9999), s["_name"]))
    return services


# ---------------------------------------------------------------------------
# Rendering helpers
# ---------------------------------------------------------------------------


def _indent(text: str, n: int) -> str:
    """Prefix every non-empty line with n spaces."""
    pad = " " * n
    return "\n".join((pad + line) if line else line for line in text.splitlines())


def _owner_link(spec_owner: str, *, from_entity: bool) -> str:
    if not spec_owner.startswith("user:"):
        return spec_owner
    person = PEOPLE.get(spec_owner.removeprefix("user:"))
    if person is None:
        return spec_owner
    href = person["href_from_entity"] if from_entity else person["href_from_hub"]
    return f'<a href="{href}">{person["name"]}</a>'


def _pill(text: str, tone: str, *, with_dot: bool = False) -> str:
    dot = '<span class="docs-pill__dot"></span>' if with_dot else ""
    return f'<span class="docs-pill docs-pill--{tone}">{dot}{text}</span>'


def _dep_chip(chip: dict) -> str:
    icon_key = chip.get("icon", "")
    icon_svg = ICONS.get(icon_key)
    if icon_svg is None:
        raise SystemExit(
            f"render_service_descriptors: unknown icon '{icon_key}' "
            f"in chip {chip!r} — add it to ICONS in {Path(__file__).name}"
        )
    parts = [
        f'<span class="dep-lanes__chip" data-status="{chip.get("status", "current")}">',
        f'  <span class="dep-lanes__icon" aria-hidden="true">{icon_svg}</span>',
        f'  <span class="dep-lanes__name">{chip["name"]}</span>',
    ]
    if chip.get("hint"):
        parts.append(f'  <span class="dep-lanes__hint">{chip["hint"]}</span>')
    parts.append("</span>")
    return "\n".join(parts)


def _dep_lanes(tone: str, lanes: Iterable[dict]) -> str:
    rows = []
    for lane in lanes:
        chips = "\n".join(_indent(_dep_chip(c), 4) for c in lane["chips"])
        rows.append(
            f'<div class="dep-lanes__row">\n'
            f'  <span class="dep-lanes__label">{lane["label"]}</span>\n'
            f'  <div class="dep-lanes__chips">\n'
            f"{chips}\n"
            f"  </div>\n"
            f"</div>"
        )
    body = "\n".join(_indent(r, 2) for r in rows)
    return f'<div class="dep-lanes" data-tone="{tone}">\n{body}\n</div>'


def _typed_link_rows(svc: dict) -> list[str]:
    """Build optional ``<dt>/<dd>`` rows from metadata.links + source-display.

    Returns a list of dt/dd HTML blocks (each block is a 2-line string with
    no leading indentation). Order: Repo/Source first, then code, data,
    public, links.
    """
    meta = svc.get("metadata", {})
    ext = svc.get("x-study-app", {})
    links = meta.get("links", [])

    rows: list[str] = []

    # Repo / Source row (annotation or x-study-app.source-display).
    src_loc = meta.get("annotations", {}).get("backstage.io/source-location")
    if ext.get("source-display"):
        rows.append(f"<dt>Source</dt>\n<dd><code>{ext['source-display']}</code></dd>")
    elif src_loc:
        label = ext.get("repo-label", "Repo")
        rows.append(f"<dt>{label}</dt>\n<dd><code>{src_loc}</code></dd>")

    by_type: dict[str, list[dict]] = {}
    for entry in links:
        by_type.setdefault(entry.get("type", "other"), []).append(entry)

    if "code" in by_type:
        e = by_type["code"][0]
        rows.append(f'<dt>Code reference</dt>\n<dd><a href="{e["url"]}">{e["title"]}</a></dd>')

    if "data" in by_type:
        e = by_type["data"][0]
        note = f'\n  <small class="dep-lanes__more">{e["note"]}</small>' if e.get("note") else ""
        rows.append(
            f'<dt>Database tables</dt>\n<dd>\n  <a href="{e["url"]}">{e["title"]}</a>{note}\n</dd>'
        )

    if "public" in by_type:
        e = by_type["public"][0]
        body = (
            e["title"] if e.get("display") == "text" else f'<a href="{e["url"]}">{e["title"]}</a>'
        )
        rows.append(f"<dt>Public</dt>\n<dd>{body}</dd>")

    if "links" in by_type:
        anchors = [f'<a href="{e["url"]}">{e["title"]}</a>' for e in by_type["links"]]
        sep = '\n  <span class="entity-card__sep" aria-hidden="true">·</span>\n  '
        joined = sep.join(anchors)
        rows.append(
            "<dt>Links</dt>\n"
            "<dd>\n"
            f"  {joined}\n"
            '  <span class="entity-card__sep" aria-hidden="true">·</span>\n'
            "</dd>"
        )

    return rows


# ---------------------------------------------------------------------------
# Entity card (per-service index.html)
# ---------------------------------------------------------------------------


def render_entity_card(svc: dict) -> str:
    ext = svc["x-study-app"]
    meta = svc["metadata"]
    spec_ = svc["spec"]

    lifecycle = spec_["lifecycle"]
    pills = [_pill(lifecycle, LIFECYCLE_PILL_TONE[lifecycle], with_dot=True)]
    for p in ext.get("header-pills", []):
        pills.append(_pill(p["text"], p["tone"]))
    pills.append(_pill("Backstage descriptor", "neutral"))
    pills_block = "\n".join(_indent(p, 6) for p in pills)

    dep_block = _dep_lanes(ext["tone"], ext["dependencies"])
    dep_block_indented = _indent(dep_block, 6)

    extra_rows = _typed_link_rows(svc)
    extras_block = "\n\n" + "\n\n".join(_indent(r, 4) for r in extra_rows) if extra_rows else ""

    reviewed = meta["annotations"]["backstage.io/last-reviewed"]
    lede = " ".join(ext["lede"].split())

    return (
        f'<section class="entity-card" data-tone="{ext["tone"]}" id="entity" aria-labelledby="entity-name">\n'
        f'  <header class="entity-card__head">\n'
        f'    <div class="entity-card__pills">\n'
        f"{pills_block}\n"
        f"    </div>\n"
        f'    <h1 class="entity-card__title" id="entity-name">{meta["name"]}</h1>\n'
        f'    <div id="docs-top-nav"></div>\n'
        f'    <p class="entity-card__lede">{lede}</p>\n'
        f"  </header>\n"
        f"\n"
        f'  <dl class="entity-card__fields">\n'
        f"    <dt>Owner</dt>\n"
        f"    <dd>{_owner_link(spec_['owner'], from_entity=True)}</dd>\n"
        f"\n"
        f"    <dt>Lifecycle</dt>\n"
        f"    <dd>{lifecycle}</dd>\n"
        f"\n"
        f"    <dt>Provides</dt>\n"
        f"    <dd>{meta['description']}</dd>\n"
        f"\n"
        f"    <dt>Depends on</dt>\n"
        f"    <dd>\n"
        f"{dep_block_indented}\n"
        f'      <small class="dep-lanes__more">Full graph in <a href="dependencies.html">dependencies</a>.</small>\n'
        f"    </dd>"
        f"{extras_block}\n"
        f"  </dl>\n"
        f"\n"
        f'  <footer class="entity-card__foot">\n'
        f'    <span><strong>Reviewed</strong> <time datetime="{reviewed}">{reviewed}</time></span>\n'
        f"  </footer>\n"
        f"</section>"
    )


# ---------------------------------------------------------------------------
# Hub tile (services/index.html catalog grid)
# ---------------------------------------------------------------------------


def _spine_nav(svc_name: str) -> str:
    svc_dir = SERVICES_DIR / svc_name
    items = []
    present = 0
    for filename, label in SPINE_PAGES:
        if (svc_dir / filename).exists():
            items.append(f'<a href="{svc_name}/{filename}">{label}</a>')
            present += 1
        else:
            items.append(
                f'<span class="svc-spine__missing" tabindex="0"\n'
                f'      data-tooltip="Not yet added. If you think it should exist, file a bug report.">{label}</span>'
            )
    body = "\n".join(_indent(item, 2) for item in items)
    return (
        f'<nav class="svc-spine" aria-label="{svc_name} spine pages">\n'
        f'  <span class="svc-spine__title">Spine · {present} pages</span>\n'
        f"{body}\n"
        f"</nav>"
    )


def render_hub_tile(svc: dict) -> str:
    name = svc["_name"]
    ext = svc["x-study-app"]
    spec_ = svc["spec"]
    lifecycle = spec_["lifecycle"]
    tile_lede = " ".join(ext.get("tile-lede", ext["lede"]).split())
    stack = ext.get("tile-stack", " · ".join(p["text"] for p in ext.get("header-pills", [])))
    owner_href = _owner_link(spec_["owner"], from_entity=False)
    icon = HUB_TILE_ICONS.get(name, "")
    tone = HUB_LIFECYCLE_TILE_TONE[lifecycle]
    tile_class = f"svc-tile svc-tile--{name.replace('-', '')}"
    spine = _indent(_spine_nav(name), 2)

    icon_line = f"      {icon}\n" if icon else ""
    return (
        f'<article class="{tile_class}" data-tags="{lifecycle}" data-service="{name}">\n'
        f'  <div class="svc-tile__head">\n'
        f'    <span class="lp-pillar__icon" aria-hidden="true">\n'
        f"{icon_line}"
        f"    </span>\n"
        f'    <span class="docs-pill docs-pill--{tone}"><span class="docs-pill__dot"></span>{lifecycle}</span>\n'
        f"  </div>\n"
        f'  <h3 class="svc-tile__name"><a href="{name}/index.html">{name}</a></h3>\n'
        f'  <p class="svc-tile__lede">{tile_lede}</p>\n'
        f'  <dl class="svc-meta">\n'
        f"    <dt>Owner</dt>\n"
        f"    <dd>{owner_href}</dd>\n"
        f"    <dt>Stack</dt>\n"
        f"    <dd>{stack}</dd>\n"
        f"  </dl>\n"
        f"{spine}\n"
        f"</article>"
    )


def render_hub_grid(services: list[dict]) -> str:
    return "\n\n".join(render_hub_tile(svc) for svc in services)


def render_hub_tickers(services: list[dict]) -> str:
    total = len(services)
    stable = sum(1 for s in services if s["spec"]["lifecycle"] == "stable")
    experimental = sum(1 for s in services if s["spec"]["lifecycle"] == "experimental")
    return (
        '<div class="home-hero__ticker" data-tone="accent">\n'
        f"  <dt>Total</dt>\n"
        f"  <dd>{total}</dd>\n"
        "</div>\n"
        '<div class="home-hero__ticker" data-tone="done">\n'
        f"  <dt>Stable</dt>\n"
        f"  <dd>{stable}</dd>\n"
        "</div>\n"
        '<div class="home-hero__ticker" data-tone="progress">\n'
        f"  <dt>Experimental</dt>\n"
        f"  <dd>{experimental}</dd>\n"
        "</div>"
    )


# ---------------------------------------------------------------------------
# Region replacement
# ---------------------------------------------------------------------------


_MARKER_OPEN_RE = re.compile(re.escape(START) + r' id="(?P<id>[^"]+)" -->')


def _replace_region(src: str, region_id: str, new_body: str, *, indent: int) -> str:
    open_marker = f'{START} id="{region_id}" -->'
    pattern = re.compile(
        re.escape(open_marker) + r"(.*?)" + re.escape(END),
        re.DOTALL,
    )
    if not pattern.search(src):
        raise SystemExit(
            f"render_service_descriptors: marker region '{region_id}' not found in source — "
            f"add a `{open_marker}` … `{END}` wrapper at the correct location."
        )
    indented_body = _indent(new_body, indent)
    end_pad = " " * indent
    replacement = f"{open_marker}\n{indented_body}\n{end_pad}{END}"
    return pattern.sub(lambda _m: replacement, src, count=1)


# ---------------------------------------------------------------------------
# Sidebar nav tree
# ---------------------------------------------------------------------------


def _find_node(tree, node_id: str):
    """Recursively walk a nav tree. Descends into `children` and `sections`."""
    if isinstance(tree, dict):
        if tree.get("id") == node_id:
            return tree
        for key in ("children", "sections"):
            for child in tree.get(key, []):
                found = _find_node(child, node_id)
                if found is not None:
                    return found
    elif isinstance(tree, list):
        for item in tree:
            found = _find_node(item, node_id)
            if found is not None:
                return found
    return None


_H1_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.DOTALL | re.IGNORECASE)
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.DOTALL | re.IGNORECASE)
_TAG_RE = re.compile(r"<[^>]+>")


def _extract_label(html_path: Path) -> str | None:
    """Return the page's h1 text (or <title>'s leading segment). Strips tags."""
    try:
        text = html_path.read_text(encoding="utf-8")
    except OSError:
        return None
    match = _H1_RE.search(text)
    if match is None:
        match = _TITLE_RE.search(text)
        if match is None:
            return None
        # Titles are typically "Foo · Bar · Internal"; take leading segment.
        raw = match.group(1).split("·")[0]
    else:
        raw = match.group(1)
    label = _TAG_RE.sub("", raw)
    label = re.sub(r"\s+", " ", label).strip()
    return label or None


def _id_safe(name: str) -> str:
    """Strip leading underscore and lowercase for nav-tree ids."""
    return name.lstrip("_").lower()


def _humanize(name: str) -> str:
    """Fallback label from a filename/dir stem when no h1 is available."""
    cleaned = name.lstrip("_").replace("_", "-")
    parts = cleaned.split("-")
    if not parts:
        return name
    return " ".join(parts[:1]).capitalize() + (
        (" " + " ".join(parts[1:])) if len(parts) > 1 else ""
    )


def _sort_key(path: Path) -> tuple:
    """Sort: _shared first (for shared conventions), then dirs, then files; alpha."""
    name = path.name
    shared_bucket = 0 if name == "_shared" else 1
    dir_bucket = 0 if path.is_dir() else 1
    return (shared_bucket, dir_bucket, name.lower())


def _build_diataxis_node(
    path: Path,
    id_prefix: str,
    label: str,
) -> dict | None:
    """Walk a directory under a service's diataxis subdir; return a nav node.

    Returns None when the directory has no html content.
    """
    if not path.is_dir():
        return None

    index_file = path / "index.html"
    children: list[dict] = []
    for entry in sorted(path.iterdir(), key=_sort_key):
        if entry.name.startswith("."):
            continue
        if entry == index_file:
            continue
        if entry.is_dir():
            sub_id = f"{id_prefix}-{_id_safe(entry.name)}"
            sub_label = (
                _extract_label(entry / "index.html") if (entry / "index.html").exists() else None
            )
            sub_label = sub_label or _humanize(entry.name)
            sub_node = _build_diataxis_node(entry, sub_id, sub_label)
            if sub_node is not None:
                children.append(sub_node)
        elif entry.is_file() and entry.suffix == ".html":
            leaf_label = _extract_label(entry) or _humanize(entry.stem)
            children.append(
                {
                    "id": f"{id_prefix}-{_id_safe(entry.stem)}",
                    "label": leaf_label,
                    "href": "/" + str(entry.relative_to(ROOT)),
                }
            )

    node: dict = {
        "id": id_prefix,
        "label": label,
    }
    if index_file.exists():
        node["href"] = "/" + str(index_file.relative_to(ROOT))
    if children:
        node["children"] = children
    # Drop empty nodes (no index, no children).
    if not children and "href" not in node:
        return None
    return node


def _build_diataxis_children(svc_name: str, svc_dir: Path) -> list[dict]:
    """Return how-to/reference/explanation nav nodes that exist under svc_dir."""
    extras: list[dict] = []
    for subdir, sub_label, sub_icon in DIATAXIS_SUBDIRS:
        sub_path = svc_dir / subdir
        if not sub_path.is_dir():
            continue
        prefix = f"services-{svc_name}-{subdir}"
        node = _build_diataxis_node(sub_path, prefix, sub_label)
        if node is None:
            continue
        node["icon"] = sub_icon
        extras.append(node)
    return extras


def _build_services_subtree(services: list[dict]) -> list[dict]:
    children = []
    for svc in services:
        name = svc["_name"]
        svc_dir = SERVICES_DIR / name
        kids = []
        for filename, label in SPINE_PAGES:
            if filename == "index.html":
                continue
            if (svc_dir / filename).exists():
                kids.append(
                    {
                        "id": f"services-{name}-{Path(filename).stem}",
                        "label": label,
                        "href": f"/services/portal/internal/services/{name}/{filename}",
                    }
                )
        kids.extend(_build_diataxis_children(name, svc_dir))
        node: dict[str, object] = {
            "id": f"services-{name}",
            "label": _nav_label(name),
            "href": f"/services/portal/internal/services/{name}/index.html",
        }
        if kids:
            node["children"] = kids
        children.append(node)
    return children


# ---------------------------------------------------------------------------
# Main entry
# ---------------------------------------------------------------------------


def render_all(*, check: bool) -> int:
    services = load_services()
    if not services:
        print("render_service_descriptors: no catalog-info.yaml files found", file=sys.stderr)
        return 1

    diffs: list[str] = []

    # Per-service entity cards — indent 6 (inside <article class="docs-prose"> at 4).
    for svc in services:
        path = SERVICES_DIR / svc["_name"] / "index.html"
        src = path.read_text()
        new = _replace_region(src, "entity-card", render_entity_card(svc), indent=6)
        if new != src:
            diffs.append(str(path.relative_to(ROOT)))
            if not check:
                path.write_text(new)

    # Hub: grid (8-col indent) + tickers (10-col indent).
    hub_src = HUB_HTML.read_text()
    new_hub = _replace_region(hub_src, "catalog-grid", render_hub_grid(services), indent=8)
    new_hub = _replace_region(new_hub, "catalog-tickers", render_hub_tickers(services), indent=10)
    if new_hub != hub_src:
        diffs.append(str(HUB_HTML.relative_to(ROOT)))
        if not check:
            HUB_HTML.write_text(new_hub)

    # Sidebar nav: rewrite the `services` subtree only, preserve all siblings.
    nav = json.loads(NAV_TREE.read_text())
    services_node = _find_node(nav, "services")
    if services_node is None:
        raise SystemExit(
            "render_service_descriptors: 'services' subtree not found in nav-tree-internal.json"
        )
    new_children = _build_services_subtree(services)
    if services_node.get("children") != new_children:
        services_node["children"] = new_children
        serialized = json.dumps(nav, indent=2, ensure_ascii=False) + "\n"
        if check:
            diffs.append(str(NAV_TREE.relative_to(ROOT)))
        else:
            NAV_TREE.write_text(serialized)
            diffs.append(str(NAV_TREE.relative_to(ROOT)))

    if check and diffs:
        print(
            "render_service_descriptors: out of sync with catalog-info.yaml — run `make catalog-render`:",
            file=sys.stderr,
        )
        for d in diffs:
            print(f"  {d}", file=sys.stderr)
        return 1

    if diffs:
        print(f"render_service_descriptors: updated {len(diffs)} file(s):")
        for d in diffs:
            print(f"  {d}")
    else:
        print("render_service_descriptors: all files already up to date")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit non-zero if HTML/JSON is out of sync with YAML; do not write.",
    )
    args = parser.parse_args(argv)
    return render_all(check=args.check)


if __name__ == "__main__":
    raise SystemExit(main())
