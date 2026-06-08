"""Build catalog/ lens-pages with role pills, view switcher, and group filter.

Implements ADR 0032 · W7 and the 2026-06-06 enhancements:
  - data-role pills on every card
  - by-quadrant + by-service + by-topic lenses
  - View switcher (By group / Table) on every lens page
  - Group filter chips on every lens page

Outputs under services/portal/internal/catalog/:
  index.html
  by-quadrant/{tutorial,how-to,reference,explanation}.html
  by-service/{api,portal,datastore,monitoring,ui-kit}.html
  by-topic/{runbooks,postmortems,tests,on-call}.html
  recent.html
"""

from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path
from typing import NamedTuple

ROOT = Path(__file__).resolve().parent.parent
INT = ROOT / "services" / "portal" / "internal"
CATALOG = INT / "catalog"

SKIP_DIR_PREFIXES = [
    "services/api/code-reference",
    "services/api/reference",
    "catalog",
]

_RE_BODY = re.compile(r"<body\b([^>]*)>", re.IGNORECASE)
_RE_TITLE = re.compile(r"<title>([^<]+)</title>", re.IGNORECASE)
_RE_H1 = re.compile(r"<h1\b[^>]*>(.*?)</h1>", re.IGNORECASE | re.DOTALL)
# Try multiple lede class names — pages use different patterns:
#   .lede                — most internal pages
#   .home-hero__tagline  — landing pages with the home-hero block
#   .entity-card__lede   — service catalog cards (services/<svc>/index.html)
#   .page-hero__lede     — blog posts / notes
_RE_LEDE_PATTERNS = [
    re.compile(r'<p class="lede"[^>]*>(.*?)</p>', re.IGNORECASE | re.DOTALL),
    re.compile(r'<p class="home-hero__tagline"[^>]*>(.*?)</p>', re.IGNORECASE | re.DOTALL),
    re.compile(r'<p class="entity-card__lede"[^>]*>(.*?)</p>', re.IGNORECASE | re.DOTALL),
    re.compile(r'<p class="page-hero__lede"[^>]*>(.*?)</p>', re.IGNORECASE | re.DOTALL),
]
_RE_TAGS = re.compile(r"<[^>]+>")


class Page(NamedTuple):
    rel_path: str
    title: str
    lede: str
    page_type: str
    service: str
    roles: tuple[str, ...]
    updated: str


def _strip_html(s: str) -> str:
    return _RE_TAGS.sub("", s).strip()


def _attr(attrs: str, name: str) -> str:
    m = re.search(rf'{name}="([^"]*)"', attrs)
    return m.group(1) if m else ""


def _is_redirect_stub(content: str) -> bool:
    return 'http-equiv="refresh"' in content or "<title>Moved" in content


def scan_pages() -> list[Page]:
    pages: list[Page] = []
    for p in sorted(INT.rglob("*.html")):
        rel = p.relative_to(INT)
        rel_str = str(rel)
        if any(rel_str.startswith(prefix) for prefix in SKIP_DIR_PREFIXES):
            continue
        try:
            content = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if _is_redirect_stub(content):
            continue

        body_match = _RE_BODY.search(content)
        if not body_match:
            continue
        attrs = body_match.group(1)

        page_type = _attr(attrs, "data-page-type")
        if not page_type:
            continue
        service = _attr(attrs, "data-service") or "none"
        updated = _attr(attrs, "data-updated") or ""
        roles_raw = _attr(attrs, "data-role")
        roles = tuple(r for r in roles_raw.split() if r) if roles_raw else ()

        h1 = _RE_H1.search(content)
        if h1:
            title = _strip_html(h1.group(1))
        else:
            t = _RE_TITLE.search(content)
            title = t.group(1).split("·")[0].strip() if t else rel_str

        lede = ""
        for pat in _RE_LEDE_PATTERNS:
            m = pat.search(content)
            if m:
                lede = _strip_html(m.group(1))[:240]
                if lede:
                    break

        pages.append(
            Page(
                rel_path=rel_str,
                title=title,
                lede=lede,
                page_type=page_type,
                service=service,
                roles=roles,
                updated=updated,
            )
        )
    return pages


# ── Topic classifiers ───────────────────────────────────────────────
def is_runbook(p: Page) -> bool:
    return "/runbooks/" in f"/{p.rel_path}"


def is_postmortem(p: Page) -> bool:
    return "/postmortems/" in f"/{p.rel_path}"


def is_test(p: Page) -> bool:
    name = Path(p.rel_path).name.lower()
    if "test" in name or "qa-process" in name or "defect-lifecycle" in name:
        return True
    if "/handbook/qa/" in f"/{p.rel_path}":
        return True
    return False


def is_oncall(p: Page) -> bool:
    return p.rel_path.endswith("on-call.html") or "/handbook/sre/" in f"/{p.rel_path}"


# ── Rendering helpers ───────────────────────────────────────────────
TONE_BY_TYPE = {
    "tutorial": "info",
    "how-to": "accent",
    "reference": "neutral",
    "explanation": "warn",
    "landing": "info",
    "landing-section": "info",
    "blog": "rose",
}


def _role_pills(roles: tuple[str, ...]) -> str:
    """Render space-separated role chips for a card."""
    if not roles:
        return '<span class="docs-pill docs-pill--neutral">cross-role</span>'
    return "".join(f'<span class="docs-pill docs-pill--accent">{r}</span>' for r in roles)


def _role_attr(page: Page) -> str:
    """Render data-roles attribute (space-separated, includes 'cross-role' for empty)."""
    if not page.roles:
        return ' data-roles="cross-role"'
    return f' data-roles="{" ".join(page.roles)}"'


def _card(page: Page, depth: int, group_attr_value: str | None = None) -> str:
    """Render one page as a spine-tile.

    Layout:
      [ head: index-text (page-type · svc · roles)         ]
      [ h3 title                                           ]
      [ body lede                                          ]
      [ foot: "Open" + arrow                               ]
    """
    prefix = "../" * depth
    group_attr = f' data-group="{group_attr_value}"' if group_attr_value else ""
    role_attr = _role_attr(page)
    bits = [page.page_type]
    if page.service != "none":
        bits.append(f"svc:{page.service}")
    if page.roles:
        bits.extend(page.roles)
    index_text = " · ".join(bits)
    return (
        f"<li{group_attr}{role_attr}>"
        f'<a class="spine-tile" data-tone="info" href="{prefix}{page.rel_path}">'
        f'<div class="spine-tile__head">'
        f'<span class="spine-tile__index">{index_text}</span>'
        f"</div>"
        f'<h3 class="spine-tile__title">{page.title}</h3>'
        f'<p class="spine-tile__body">{page.lede or "—"}</p>'
        f'<div class="spine-tile__foot">'
        f'<span class="spine-tile__cta">Open</span>'
        f'<span class="spine-tile__arrow" aria-hidden="true">→</span>'
        f"</div>"
        f"</a></li>"
    )


def _table_row(page: Page, depth: int, group_attr_value: str | None = None) -> str:
    prefix = "../" * depth
    role_str = " · ".join(page.roles) if page.roles else "—"
    group_attr = f' data-group="{group_attr_value}"' if group_attr_value else ""
    role_attr = _role_attr(page)
    return (
        f"<tr{group_attr}{role_attr}>"
        f'<td><a href="{prefix}{page.rel_path}">{page.title}</a></td>'
        f'<td><span class="docs-pill docs-pill--{TONE_BY_TYPE.get(page.page_type, "neutral")}">{page.page_type}</span></td>'
        f"<td>{page.service if page.service != 'none' else '—'}</td>"
        f"<td>{role_str}</td>"
        f'<td><code class="small">{page.rel_path}</code></td>'
        f"</tr>"
    )


PAGE_SHELL = """<!doctype html>
<html lang="en" data-portal="internal" data-theme="light"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{page_title} · Catalog · Study App Internal</title>
  <script>(function(){{try{{var v=localStorage.getItem("docs-theme-preference");if(v==="dark"||v==="light")document.documentElement.setAttribute("data-theme",v);}}catch(e){{}}}})();</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..900&amp;family=JetBrains+Mono:wght@400;500;700&amp;display=swap" rel="stylesheet">
  <link rel="icon" type="image/svg+xml" href="{assets_prefix}frontend/portal/assets/favicon.svg">
  <link rel="stylesheet" href="{assets_prefix}frontend/portal/assets_v2/runtime/internal/entry.css">
  <style>
    /* Catalog lens — view switcher overlay (copies adr-toolbar pattern) */
    .cat-toolbar {{ display: flex; flex-direction: column; align-items: stretch; gap: var(--space-3); margin: 0 0 var(--space-4); }}
    .cat-toolbar__group {{ display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }}
    .cat-toolbar__label {{ font-family: var(--font-mono); font-size: var(--fs-100); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); min-width: 56px; }}
    #cat-views[data-view="by-group"] .cat-table-view {{ display: none; }}
    #cat-views[data-view="table"] .cat-by-group {{ display: none; }}
    .cat-empty {{ padding: var(--space-5); text-align: center; color: var(--muted); border: 1px dashed var(--line); border-radius: var(--radius-lg); display: none; }}
    #cat-views[data-empty="true"] .cat-empty {{ display: block; }}
    .cat-table-view table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
    .cat-table-view th, .cat-table-view td {{ border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }}
    .cat-table-view th {{ font: 600 11px/1 var(--font-mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }}
    .small {{ font-size: 11.5px; color: var(--muted); }}
  </style>
</head>
<body data-page-type="landing-section" class="docs-shell" data-maintainer-ids="16fc8b78537109162984a2fdbef6e142" data-service="none" data-lifecycle="published" data-updated="2026-06-06" data-role="">

  <header class="topbar" role="banner">
    <a class="topbar__brand" href="{internal_prefix}index.html"><span aria-hidden="true">🛠</span><span>Study App · Internal</span></a>
    <nav class="topbar__breadcrumbs" aria-label="Breadcrumb">
      <ol class="docs-breadcrumbs__list">
        {breadcrumb}
      </ol>
    </nav>
    <div class="topbar__spacer"></div>
    <div class="topbar__actions">
      <button class="docs-theme-toggle" type="button" aria-label="Toggle theme"></button>
    </div>
  </header>

  <aside data-component="sidebar" data-nav-src="{assets_prefix}frontend/portal/assets_v2/ui-kit/mocks/nav-tree-internal.json" aria-label="Section navigation"></aside>

  <main class="container">
    <article class="docs-prose">
      <header class="page-head">
        <p class="home-hero__eyebrow">
          <span class="docs-pill docs-pill--info">Catalog</span>
          <span class="docs-pill docs-pill--accent">{lens_label}</span>
          <span class="docs-pill docs-pill--neutral">autogen · do not hand-edit</span>
        </p>
        <h1>{title_h1}</h1>
        <div id="docs-top-nav"></div>
        <p class="lede">{lede}</p>
        <p class="small" style="margin-top:6px">Generated by <code>scripts/build_catalog.py</code> · {total} entries.</p>
      </header>

      {toolbar}

      <div id="cat-views" data-view="by-group">
        <div class="cat-by-group">
          {body_groups}
        </div>
        <div class="cat-table-view">
          <table>
            <thead><tr><th>Title</th><th>Quadrant</th><th>Service</th><th>Roles</th><th>Path</th></tr></thead>
            <tbody>
              {body_rows}
            </tbody>
          </table>
        </div>
        <div class="cat-empty">No pages match this filter.</div>
      </div>
    </article>
  </main>

  <script>
    /* Combined filter glue — group + role. Each filter applies only to elements
       that carry the corresponding attribute. Sections (which only have data-group)
       are not hidden by the role filter; cards/rows (which have both) are filtered
       by both. */
    (function () {{
      var state = {{ group: "all", role: "all" }};
      function matchesRole(el) {{
        if (state.role === "all") return true;
        if (!el.hasAttribute("data-roles")) return true; // role filter not applicable
        var attr = el.getAttribute("data-roles") || "";
        var roles = attr.split(/\\s+/).filter(Boolean);
        return roles.indexOf(state.role) !== -1;
      }}
      function matchesGroup(el) {{
        if (state.group === "all") return true;
        if (!el.hasAttribute("data-group")) return true; // group filter not applicable
        return el.getAttribute("data-group") === state.group;
      }}
      function apply() {{
        var els = document.querySelectorAll("#cat-views [data-group], #cat-views [data-roles]");
        var visibleCards = 0;
        var visibleSections = new Set();
        els.forEach(function (el) {{
          var ok = matchesGroup(el) && matchesRole(el);
          el.hidden = !ok;
          if (ok && (el.tagName === "A" || el.tagName === "TR")) {{
            visibleCards++;
            // Mark parent section as having at least one visible card
            var section = el.closest("section[data-group]");
            if (section) visibleSections.add(section);
          }}
        }});
        // Auto-hide empty sections (no visible cards inside, even if section matches the group filter)
        document.querySelectorAll("#cat-views section[data-group]").forEach(function (sec) {{
          if (sec.hidden) return; // already hidden by group filter
          // If role filter is active and no children of this section survived, hide the section
          if (state.role !== "all" && !visibleSections.has(sec)) {{
            sec.hidden = true;
          }}
        }});
        var views = document.getElementById("cat-views");
        if (views) views.setAttribute("data-empty", visibleCards === 0 ? "true" : "false");
      }}
      window.addEventListener("multifilterchange", function (e) {{
        if (!e.detail) return;
        if (e.detail.key === "group") state.group = e.detail.value || "all";
        if (e.detail.key === "role")  state.role  = e.detail.value || "all";
        apply();
      }});
      try {{
        var params = new URLSearchParams((location.hash || "").replace(/^#/, ""));
        state.group = params.get("group") || "all";
        state.role  = params.get("role")  || "all";
      }} catch (_) {{}}
      apply();
    }})();
  </script>

  <script type="module" src="{assets_prefix}frontend/portal/assets_v2/runtime/internal/entry.js"></script>
</body></html>
"""


ROLE_CHIPS = [
    ("all", "All"),
    ("sa", "SA"),
    ("swe", "SWE"),
    ("qa", "QA"),
    ("sre", "SRE"),
    ("architect", "Architect"),
    ("manager", "Manager"),
    ("cross-role", "Cross-role"),
]


def _toolbar(group_label: str, group_chips: list[tuple[str, str]]) -> str:
    """group_chips = list of (value, display_label). Role chips fixed."""

    def chip_row(chips, pressed_idx=0):
        return "".join(
            f'<button class="docs-chip docs-chip--filter" type="button" data-value="{v}" aria-pressed="{"true" if i == pressed_idx else "false"}">{lbl}</button>'
            for i, (v, lbl) in enumerate(chips)
        )

    return f'''
      <div class="cat-toolbar">
        <div class="cat-toolbar__group">
          <span class="cat-toolbar__label">{group_label}</span>
          <div data-component="multi-filter-chips" data-state-key="group" data-default="all" aria-label="{group_label}">
            {chip_row(group_chips)}
          </div>
        </div>
        <div class="cat-toolbar__group">
          <span class="cat-toolbar__label">Role</span>
          <div data-component="multi-filter-chips" data-state-key="role" data-default="all" aria-label="Role">
            {chip_row(ROLE_CHIPS)}
          </div>
        </div>
        <div class="cat-toolbar__group">
          <span class="cat-toolbar__label">View</span>
          <div data-component="view-switcher" data-target="#cat-views" data-storage-key="cat-view" data-default="by-group" class="docs-view-switcher" aria-label="View">
            <button class="docs-view-switcher__btn" type="button" data-view="by-group">By group</button>
            <button class="docs-view-switcher__btn" type="button" data-view="table">Table</button>
          </div>
        </div>
      </div>
    '''


def write_lens(
    rel_path: str,
    page_title: str,
    lens_label: str,
    title_h1: str,
    lede: str,
    group_label: str,
    group_chips: list[tuple[str, str]],
    body_groups: str,
    body_rows: str,
    total: int,
):
    target = CATALOG / rel_path
    depth_under_catalog = len(target.relative_to(CATALOG).parts) - 1
    internal_prefix = "../" * (depth_under_catalog + 1)
    assets_prefix = "../" * (depth_under_catalog + 1 + 2)

    bc_items = [
        f'<li class="docs-breadcrumbs__item"><a class="docs-breadcrumbs__link" href="{internal_prefix}index.html">Internal</a></li>',
    ]
    if depth_under_catalog == 0:
        bc_items.append('<li class="docs-breadcrumbs__item" aria-current="page">Catalog</li>')
    else:
        bc_items.append(
            f'<li class="docs-breadcrumbs__item"><a class="docs-breadcrumbs__link" href="{"../" * depth_under_catalog}index.html">Catalog</a></li>'
        )
        bc_items.append(f'<li class="docs-breadcrumbs__item" aria-current="page">{lens_label}</li>')

    html = PAGE_SHELL.format(
        page_title=page_title,
        lens_label=lens_label,
        title_h1=title_h1,
        lede=lede,
        total=total,
        breadcrumb="\n        ".join(bc_items),
        assets_prefix=assets_prefix,
        internal_prefix=internal_prefix,
        toolbar=_toolbar(group_label, group_chips),
        body_groups=body_groups,
        body_rows=body_rows,
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    html = "\n".join(line.rstrip() for line in html.splitlines()) + "\n"
    target.write_text(html, encoding="utf-8")


def _by_group_section(group_id: str, group_title: str, pages: list[Page], depth: int) -> str:
    cards = "\n          ".join(_card(p, depth, group_attr_value=group_id) for p in pages)
    return (
        f'<section data-group="{group_id}" aria-labelledby="g-{group_id}-h">\n'
        f'  <h2 id="g-{group_id}-h">{group_title} <span class="docs-pill docs-pill--neutral">{len(pages)}</span></h2>\n'
        f'  <ol class="spine-grid" aria-label="{group_title}">\n          {cards}\n  </ol>\n'
        f"</section>"
    )


# ── Lens generators ─────────────────────────────────────────────────
QUADRANTS = {
    "tutorial": (
        "Tutorials",
        "Audience-keyed onboarding paths. Read top-to-bottom; the role hub picks for you.",
    ),
    "how-to": ("How-to", "Procedural recipes — do this when you want to perform this task."),
    "reference": (
        "Reference",
        "Canonical facts: tables, schemas, contracts. Look up; do not read top-to-bottom.",
    ),
    "explanation": (
        "Explanation",
        "Cross-cutting essays — why we do it this way, what to trade off.",
    ),
}

SERVICES_META = {
    "api": (
        "API",
        "FastAPI runtime — the only artefact an external integrator interacts with at runtime.",
    ),
    "portal": ("portal", "The internal & public documentation portal itself."),
    "datastore": ("datastore", "SQLite / Postgres persistence + Alembic migrations."),
    "monitoring": ("monitoring", "Observability stack — Prometheus, Grafana, structured logging."),
    "ui-kit": ("UI Kit", "Shared frontend component library (UI Kit v2)."),
}

TOPICS_META = {
    "runbooks": (
        "Runbooks",
        "Operational triage playbooks — read first when something is on fire.",
        is_runbook,
    ),
    "postmortems": (
        "Postmortems",
        "Post-incident learnings — what actually happened, root cause, action items.",
        is_postmortem,
    ),
    "tests": (
        "Tests & QA",
        "Testing strategy, checklists, defect lifecycle — the QA craft.",
        is_test,
    ),
    "on-call": (
        "On-call & reliability",
        "On-call rotation, SLOs, error budgets, observability essays.",
        is_oncall,
    ),
}


def build_by_quadrant(pages: list[Page]):
    for ptype, (label, lede) in QUADRANTS.items():
        matches = [p for p in pages if p.page_type == ptype]
        by_svc: dict[str, list[Page]] = defaultdict(list)
        for p in matches:
            by_svc[p.service].append(p)

        # Group chips: All + service list
        services_present = sorted(by_svc.keys(), key=lambda s: (s == "none", s))
        chips = [("all", "All")] + [
            (s if s != "none" else "cross-cutting", s if s != "none" else "Cross-cutting")
            for s in services_present
        ]

        # By-group sections by service
        groups_html = ""
        rows_html = ""
        for svc in services_present:
            svc_id = svc if svc != "none" else "cross-cutting"
            svc_label = "Cross-cutting" if svc == "none" else f"Service · {svc}"
            svc_pages = sorted(by_svc[svc], key=lambda p: p.title)
            groups_html += "\n      " + _by_group_section(svc_id, svc_label, svc_pages, depth=2)
            rows_html += "\n      " + "\n      ".join(
                _table_row(p, depth=2, group_attr_value=svc_id) for p in svc_pages
            )

        write_lens(
            f"by-quadrant/{ptype}.html",
            page_title=label,
            lens_label=label,
            title_h1=f"{label} · catalog",
            lede=lede,
            group_label="Service",
            group_chips=chips,
            body_groups=groups_html,
            body_rows=rows_html,
            total=len(matches),
        )


def build_by_service(pages: list[Page]):
    for svc, (label, lede) in SERVICES_META.items():
        matches = [p for p in pages if p.service == svc]
        by_quad: dict[str, list[Page]] = defaultdict(list)
        for p in matches:
            by_quad[p.page_type].append(p)

        quad_order = [
            "landing",
            "landing-section",
            "tutorial",
            "how-to",
            "reference",
            "explanation",
        ]
        present = [q for q in quad_order if q in by_quad] + [
            q for q in by_quad if q not in quad_order
        ]
        chips = [("all", "All")] + [(q, q.title()) for q in present]

        groups_html = ""
        rows_html = ""
        for q in present:
            qpages = sorted(by_quad[q], key=lambda p: p.title)
            label_q = (
                q.title() if q not in {"how-to", "landing-section"} else q.replace("-", " ").title()
            )
            groups_html += "\n      " + _by_group_section(q, label_q, qpages, depth=2)
            rows_html += "\n      " + "\n      ".join(
                _table_row(p, depth=2, group_attr_value=q) for p in qpages
            )

        write_lens(
            f"by-service/{svc}.html",
            page_title=label,
            lens_label=f"Service · {label}",
            title_h1=f"{label} · all pages",
            lede=lede,
            group_label="Quadrant",
            group_chips=chips,
            body_groups=groups_html,
            body_rows=rows_html,
            total=len(matches),
        )


def build_by_topic(pages: list[Page]):
    for topic_id, (label, lede, predicate) in TOPICS_META.items():
        matches = [p for p in pages if predicate(p)]
        # Group by service
        by_svc: dict[str, list[Page]] = defaultdict(list)
        for p in matches:
            by_svc[p.service].append(p)
        services_present = sorted(by_svc.keys(), key=lambda s: (s == "none", s))
        chips = [("all", "All")] + [
            (s if s != "none" else "cross-cutting", s if s != "none" else "Cross-cutting")
            for s in services_present
        ]

        groups_html = ""
        rows_html = ""
        for svc in services_present:
            svc_id = svc if svc != "none" else "cross-cutting"
            svc_label = "Cross-cutting" if svc == "none" else f"Service · {svc}"
            svc_pages = sorted(by_svc[svc], key=lambda p: p.title)
            groups_html += "\n      " + _by_group_section(svc_id, svc_label, svc_pages, depth=2)
            rows_html += "\n      " + "\n      ".join(
                _table_row(p, depth=2, group_attr_value=svc_id) for p in svc_pages
            )

        write_lens(
            f"by-topic/{topic_id}.html",
            page_title=label,
            lens_label=f"Topic · {label}",
            title_h1=f"{label} · catalog",
            lede=lede,
            group_label="Service",
            group_chips=chips,
            body_groups=groups_html,
            body_rows=rows_html,
            total=len(matches),
        )


def build_recent(pages: list[Page]):
    sorted_pages = sorted(pages, key=lambda p: p.updated or "", reverse=True)[:50]
    by_quad: dict[str, list[Page]] = defaultdict(list)
    for p in sorted_pages:
        by_quad[p.page_type].append(p)

    quad_order = [
        "tutorial",
        "how-to",
        "reference",
        "explanation",
        "landing",
        "landing-section",
        "blog",
    ]
    present = [q for q in quad_order if q in by_quad] + [q for q in by_quad if q not in quad_order]
    chips = [("all", "All")] + [(q, q.title()) for q in present]

    groups_html = ""
    rows_html = ""
    for q in present:
        groups_html += "\n      " + _by_group_section(q, q.title(), by_quad[q], depth=1)
        rows_html += "\n      " + "\n      ".join(
            _table_row(p, depth=1, group_attr_value=q) for p in by_quad[q]
        )

    write_lens(
        "recent.html",
        page_title="Recent",
        lens_label="Recent",
        title_h1="Recently updated pages",
        lede="The 50 most recently changed pages on this portal — by <code>data-updated</code> ISO date.",
        group_label="Quadrant",
        group_chips=chips,
        body_groups=groups_html,
        body_rows=rows_html,
        total=len(sorted_pages),
    )


CATALOG_INDEX_SHELL = """<!doctype html>
<html lang="en" data-portal="internal" data-theme="light"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Catalog · Study App Internal</title>
  <script>(function(){{try{{var v=localStorage.getItem("docs-theme-preference");if(v==="dark"||v==="light")document.documentElement.setAttribute("data-theme",v);}}catch(e){{}}}})();</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..900&amp;family=JetBrains+Mono:wght@400;500;700&amp;display=swap" rel="stylesheet">
  <link rel="icon" type="image/svg+xml" href="../../../frontend/portal/assets/favicon.svg">
  <link rel="stylesheet" href="../../../frontend/portal/assets_v2/runtime/internal/entry.css">
</head>
<body data-page-type="landing-section" class="docs-shell" data-maintainer-ids="16fc8b78537109162984a2fdbef6e142" data-service="none" data-lifecycle="published" data-updated="2026-06-06" data-role="">

  <header class="topbar" role="banner">
    <a class="topbar__brand" href="../index.html"><span aria-hidden="true">🛠</span><span>Study App · Internal</span></a>
    <nav class="topbar__breadcrumbs" aria-label="Breadcrumb">
      <ol class="docs-breadcrumbs__list">
        <li class="docs-breadcrumbs__item"><a class="docs-breadcrumbs__link" href="../index.html">Internal</a></li>
        <li class="docs-breadcrumbs__item" aria-current="page">Catalog</li>
      </ol>
    </nav>
    <div class="topbar__spacer"></div>
    <div class="topbar__actions">
      <button class="docs-theme-toggle" type="button" aria-label="Toggle theme"></button>
    </div>
  </header>

  <aside data-component="sidebar" data-nav-src="../../../frontend/portal/assets_v2/ui-kit/mocks/nav-tree-internal.json" aria-label="Section navigation"></aside>

  <main class="container">

    <section class="home-hero home-hero--section">
      <div class="home-hero__layout">
        <div class="home-hero__copy">
          <p class="home-hero__eyebrow">Internal · Catalog</p>
          <h1 class="home-hero__title">
            Find <span class="home-hero__title-accent">anything</span>
          </h1>
          <div id="docs-top-nav"></div>
          <p class="home-hero__tagline">
            Generated views over every page on this portal — organized by Diátaxis quadrant,
            by service, by topic, and by edit date. Use these lenses when you can't remember
            where a page lives.
          </p>
          <div class="home-hero__stats">
            <a class="docs-pill docs-pill--accent" href="#quadrant-h">By quadrant</a>
            <a class="docs-pill docs-pill--info" href="#service-h">By service</a>
            <a class="docs-pill docs-pill--warn" href="#topic-h">By topic</a>
            <a class="docs-pill docs-pill--success" href="recent.html">Recent ↗</a>
          </div>
        </div>
        <dl class="home-hero__tickers" aria-label="Catalog snapshot">
          <div class="home-hero__ticker" data-tone="accent"><dt>Total pages</dt><dd>{total}</dd></div>
          <div class="home-hero__ticker" data-tone="done"><dt>Quadrants</dt><dd>4</dd></div>
          <div class="home-hero__ticker" data-tone="progress"><dt>Services</dt><dd>5</dd></div>
          <div class="home-hero__ticker" data-tone="todo"><dt>Topic lenses</dt><dd>4</dd></div>
        </dl>
      </div>
    </section>

    <article class="docs-prose">

      <section aria-labelledby="quadrant-h">
        <h2 id="quadrant-h">By Diátaxis quadrant</h2>
        <ol class="spine-grid" aria-label="Catalog by quadrant">
          {quad_tiles}
        </ol>
      </section>

      <section aria-labelledby="service-h">
        <h2 id="service-h">By service</h2>
        <ol class="spine-grid" aria-label="Catalog by service">
          {svc_tiles}
        </ol>
      </section>

      <section aria-labelledby="topic-h">
        <h2 id="topic-h">By topic — operations</h2>
        <p>Cross-cutting operational categories pulled from filename + path patterns.</p>
        <ol class="spine-grid" aria-label="Catalog by topic">
          {topic_tiles}
        </ol>
      </section>

      <section aria-labelledby="recent-h">
        <h2 id="recent-h">Recent changes</h2>
        <ol class="spine-grid" aria-label="Catalog by recency">
          <li><a class="spine-tile" href="recent.html" data-tone="info">
            <div class="spine-tile__head">
              <span class="spine-tile__index">Recently updated · last 50</span>
            </div>
            <h3 class="spine-tile__title">Recently updated</h3>
            <p class="spine-tile__body">The 50 most recently edited pages across the portal, sorted by edit date.</p>
            <div class="spine-tile__foot">
              <span class="spine-tile__cta">Open recent</span>
              <span class="spine-tile__arrow" aria-hidden="true">→</span>
            </div>
          </a></li>
        </ol>
      </section>

    </article>
  </main>

  <script type="module" src="../../../frontend/portal/assets_v2/runtime/internal/entry.js"></script>
</body></html>
"""


def build_index(pages: list[Page]):

    quad_counts: dict[str, int] = defaultdict(int)
    svc_counts: dict[str, int] = defaultdict(int)
    topic_counts = {
        tid: sum(1 for p in pages if pred(p)) for tid, (_, _, pred) in TOPICS_META.items()
    }
    for p in pages:
        quad_counts[p.page_type] += 1
        svc_counts[p.service] += 1

    def tile(href, title, count_label, body):
        return (
            f'<li><a class="spine-tile" href="{href}" data-tone="info">'
            f'<div class="spine-tile__head">'
            f'<span class="spine-tile__index">{title} · {count_label}</span>'
            f"</div>"
            f'<h3 class="spine-tile__title">{title}</h3>'
            f'<p class="spine-tile__body">{body}</p>'
            f'<div class="spine-tile__foot">'
            f'<span class="spine-tile__cta">Open {title}</span>'
            f'<span class="spine-tile__arrow" aria-hidden="true">→</span>'
            f"</div>"
            f"</a></li>"
        )

    QUAD_BODIES = {
        "tutorial": "Step-by-step guides that take a reader from zero to a working result. Organized by service.",
        "how-to": "Practical recipes for accomplishing a specific task. Organized by service.",
        "reference": "Look-up material — APIs, schemas, definitions, configuration. Organized by service.",
        "explanation": "Background narratives that explain why things are the way they are. Organized by service.",
    }
    SVC_BODIES = {
        "api": "Endpoint specs, runbooks, tutorials, and architecture for the public HTTP API.",
        "portal": "Layout, IA, design tokens, and authoring rules for the documentation portal itself.",
        "datastore": "Database schemas, migrations, query patterns, and connection guides.",
        "monitoring": "Metrics, dashboards, log pipelines, and alerts for the platform.",
        "ui-kit": "Reusable components, tokens, and patterns shared across the design system.",
    }

    quad_tiles = "\n          ".join(
        [
            tile(
                f"by-quadrant/{q}.html",
                lbl,
                f"{quad_counts.get(q, 0)} pages",
                QUAD_BODIES.get(q, ""),
            )
            for q, lbl in [
                ("tutorial", "Tutorials"),
                ("how-to", "How-to"),
                ("reference", "Reference"),
                ("explanation", "Explanation"),
            ]
        ]
    )

    svc_tiles = "\n          ".join(
        [
            tile(
                f"by-service/{sid}.html",
                lbl,
                f"{svc_counts.get(sid, 0)} pages",
                SVC_BODIES.get(sid, ""),
            )
            for sid, (lbl, _) in SERVICES_META.items()
        ]
    )

    topic_tiles = "\n          ".join(
        [
            tile(f"by-topic/{tid}.html", lbl, f"{topic_counts[tid]} pages", body)
            for tid, (lbl, body, _) in TOPICS_META.items()
        ]
    )

    target = CATALOG / "index.html"
    target.write_text(
        CATALOG_INDEX_SHELL.format(
            total=len(pages),
            quad_tiles=quad_tiles,
            svc_tiles=svc_tiles,
            topic_tiles=topic_tiles,
        ),
        encoding="utf-8",
    )


def main():
    pages = scan_pages()
    print(f"Scanned {len(pages)} tagged pages")

    build_by_quadrant(pages)
    print("  Built catalog/by-quadrant/{tutorial,how-to,reference,explanation}.html")
    build_by_service(pages)
    print("  Built catalog/by-service/{api,portal,datastore,monitoring,ui-kit}.html")
    build_by_topic(pages)
    print("  Built catalog/by-topic/{runbooks,postmortems,tests,on-call}.html")
    build_recent(pages)
    print("  Built catalog/recent.html")
    build_index(pages)
    print("  Built catalog/index.html")


if __name__ == "__main__":
    main()
