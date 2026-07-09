import { resolvePortalHref } from "./portal-href.js";

/* ui-kit/components/site-footer.js — auto-mounted portal footer.

   Mount API
   ─────────
     mountSiteFooter(root = document)
       • If <html data-footer="off">: returns silently.
       • If a slot exists ([data-component="site-footer"]): renders into it.
       • Otherwise: appends a fresh <footer data-component="site-footer"> to
         the page (inside .docs-shell if present so it joins the grid; else
         after <main>; else at end of <body>).
     Idempotent: never re-renders a slot that already booted.

   Configuration (highest → lowest priority)
   ─────────────────────────────────────────
     1. Inline JSON:
          <script type="application/json" data-footer-config>
            { "columns": [...], "brand": {...}, "legal": {...} }
          </script>
     2. window.__PORTAL_FOOTER__ (set before entry.js loads)
     3. data-footer-src="…/footer.json" on the slot (async fetch)
     4. Built-in DEFAULT_CONFIG below.

   Per-page tweaks via slot attributes
   ───────────────────────────────────
     data-variant="compact|minimal"   – preset variant
     data-cols="2|3|4|5"              – force column count
     data-portal="internal|public"    – pick portal-flavoured defaults
*/

const DEFAULT_CONFIG = {
  brand: {
    title: "Study App",
    subtitle: "Internal portal",
    glyph: "🚀",
    href: "/services/portal/internal/index.html",
    tagline:
      "Documentation, governance, and engineering practices — one place to ship Study App with confidence.",
    social: [
      { label: "GitHub", href: "https://github.com/iboiarkin96/study_bot", icon: "github" },
    ],
  },
  columns: [
    {
      title: "Docs",
      links: [
        { label: "Services catalog", href: "/services/portal/internal/services/index.html" },
        { label: "API reference", href: "/services/portal/internal/services/api/reference/index.html" },
        { label: "Runbooks", href: "/services/portal/internal/how-to/incidents/runbooks/index.html" },
        { label: "UI Kit", href: "/services/portal/ui-kit/index.html", badge: "v3" },
      ],
    },
    {
      title: "Governance",
      links: [
        { label: "RFCs", href: "/services/portal/internal/governance/rfc/index.html" },
        { label: "ADRs", href: "/services/portal/internal/governance/adr/index.html" },
        { label: "Backlog", href: "/services/portal/internal/governance/backlog/plans.html" },
        { label: "Audits", href: "/services/portal/internal/governance/audits/index.html" },
      ],
    },
    {
      title: "Team",
      links: [
        { label: "Team", href: "/services/portal/internal/team/index.html" },
        { label: "Contributors", href: "/services/portal/internal/team/people/index.html" },
        { label: "Roles", href: "/services/portal/internal/team/roles/index.html" },
        { label: "Handbook", href: "/services/portal/internal/foundations/reference/sa/index.html" },
      ],
    },
    {
      title: "Build",
      links: [
        { label: "GitHub", href: "https://github.com/iboiarkin96/study_bot", external: true },
        { label: "Changelog", href: "/services/portal/CHANGELOG.md", external: true },
      ],
    },
  ],
  legal: {
    copyright: `© ${new Date().getFullYear()} Study App`,
    note: "Internal documentation — not for external distribution.",
    meta: [],
    build: null,
  },
};

const SOCIAL_ICONS = {
  github: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1.3a10.7 10.7 0 0 0-3.4 20.86c.54.1.74-.23.74-.52v-1.85c-3 .65-3.63-1.43-3.63-1.43-.5-1.25-1.2-1.58-1.2-1.58-.97-.66.07-.65.07-.65 1.08.08 1.65 1.11 1.65 1.11.97 1.65 2.53 1.17 3.15.9.1-.7.38-1.18.69-1.45-2.4-.27-4.92-1.2-4.92-5.34 0-1.18.42-2.14 1.1-2.9-.1-.27-.48-1.36.1-2.84 0 0 .9-.29 2.95 1.1.86-.24 1.77-.36 2.68-.36s1.83.12 2.69.36c2.04-1.39 2.95-1.1 2.95-1.1.58 1.48.2 2.57.1 2.84.68.76 1.1 1.72 1.1 2.9 0 4.16-2.53 5.07-4.94 5.33.39.34.74 1 .74 2.02v3c0 .29.2.63.74.52A10.7 10.7 0 0 0 12 1.3z"/></svg>`,
  slack: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5.5 14.5a2 2 0 1 1-2-2h2v2zm1 0a2 2 0 1 1 4 0v5a2 2 0 0 1-4 0v-5zm2-9.5a2 2 0 1 1 2-2v2h-2zm0 1a2 2 0 1 1 0 4h-5a2 2 0 0 1 0-4h5zm9.5 2a2 2 0 1 1 2 2h-2v-2zm-1 0a2 2 0 1 1-4 0v-5a2 2 0 0 1 4 0v5zm-2 9.5a2 2 0 1 1-2 2v-2h2zm0-1a2 2 0 1 1 0-4h5a2 2 0 0 1 0 4h-5z"/></svg>`,
  linear: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.5 13.2A8.8 8.8 0 0 0 10.8 20.5l-7.3-7.3zM3.1 9.6a8.8 8.8 0 0 0 11.3 11.3L3.1 9.6zm.7-3a8.8 8.8 0 0 0 13.6 13.6L3.8 6.6zm2.4-2.4 13.6 13.6A8.8 8.8 0 0 0 6.2 4.2zm3.8-2A8.8 8.8 0 0 1 20.5 13.2l-7.3-7.3z"/></svg>`,
  twitter: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.5 11.24h-6.658l-5.214-6.817-5.965 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="m3 7 9 6 9-6"/></svg>`,
};

// ─── Config resolution ────────────────────────────────────────────────

function deepMerge(base, override) {
  if (!override) return base;
  const out = { ...base };
  for (const key of Object.keys(override)) {
    const value = override[key];
    if (Array.isArray(value)) {
      out[key] = value.slice();
    } else if (value && typeof value === "object") {
      out[key] = deepMerge(base[key] || {}, value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

function parseConfigNode(node) {
  if (!node) return null;
  try {
    return JSON.parse(node.textContent);
  } catch (err) {
    console.warn("[site-footer] invalid inline JSON config:", err);
    return null;
  }
}

// Inline config lookup, scoped from most-local to global so multiple footers
// on the same page (showcase) can each carry their own JSON:
//   1) <script ... data-footer-config> as a child of the slot itself
//   2) preceding sibling chain (any script[data-footer-config] before the slot)
//   3) if allowDocument: anywhere within root (document fallback for auto-mount)
function readInlineConfig(root, slot, allowDocument) {
  if (slot) {
    const child = slot.querySelector(
      'script[type="application/json"][data-footer-config]'
    );
    if (child) return parseConfigNode(child);
    let prev = slot.previousElementSibling;
    while (prev) {
      if (
        prev.tagName === "SCRIPT" &&
        prev.getAttribute("type") === "application/json" &&
        prev.hasAttribute("data-footer-config")
      ) {
        return parseConfigNode(prev);
      }
      if (prev.tagName !== "SCRIPT") break;
      prev = prev.previousElementSibling;
    }
  }
  if (allowDocument && root && root.querySelector) {
    return parseConfigNode(
      root.querySelector('script[type="application/json"][data-footer-config]')
    );
  }
  return null;
}

function readWindowConfig() {
  if (typeof window === "undefined") return null;
  return window.__PORTAL_FOOTER__ || null;
}

async function readRemoteConfig(slot) {
  const src = slot.getAttribute("data-footer-src");
  if (!src) return null;
  try {
    const res = await fetch(src, { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (err) {
    console.warn("[site-footer] data-footer-src failed:", err);
    return null;
  }
}

function resolveConfig(root, slot, opts = {}) {
  const inline = readInlineConfig(root, slot, !!opts.allowDocumentInline);
  const win = readWindowConfig();
  const merged = deepMerge(deepMerge(DEFAULT_CONFIG, win), inline);
  if (!opts.async) return merged;
  return readRemoteConfig(slot).then((remote) => deepMerge(merged, remote));
}

// ─── Rendering ────────────────────────────────────────────────────────

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else node.setAttribute(k, v === true ? "" : v);
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) child.forEach((c) => c && node.appendChild(c));
    else if (child instanceof Node) node.appendChild(child);
    else node.appendChild(document.createTextNode(String(child)));
  }
  return node;
}

function renderLink(link) {
  const attrs = { class: "site-footer__link", href: resolvePortalHref(link.href) || "#" };
  if (link.external) {
    attrs.target = "_blank";
    attrs.rel = "noopener noreferrer";
    attrs.class += " site-footer__link-external";
  }
  if (link.attrs) {
    for (const [k, v] of Object.entries(link.attrs)) attrs[k] = v;
  }
  const children = [link.label];
  if (link.badge) {
    children.push(el("span", { class: "site-footer__link-badge" }, link.badge));
  }
  return el("a", attrs, ...children);
}

function renderColumn(col) {
  return el(
    "section",
    { class: "site-footer__col" },
    el("h3", { class: "site-footer__col-title" }, col.title),
    el(
      "ul",
      { class: "site-footer__col-list" },
      ...col.links.map((link) => el("li", {}, renderLink(link)))
    )
  );
}

function renderBrand(brand) {
  if (!brand) return null;
  const markChildren = [];
  if (brand.glyph) {
    markChildren.push(
      el(
        "span",
        { class: "site-footer__brand-glyph", "aria-hidden": "true" },
        brand.glyph
      )
    );
  }
  markChildren.push(
    el(
      "span",
      {},
      brand.title || "",
      brand.subtitle
        ? el(
            "span",
            { style: "color:var(--muted);font-weight:var(--fw-regular);margin-left:6px" },
            "· " + brand.subtitle
          )
        : null
    )
  );

  const children = [
    el(
      "a",
      { class: "site-footer__brand-mark", href: resolvePortalHref(brand.href) || "/" },
      ...markChildren
    ),
  ];
  if (brand.tagline) {
    children.push(el("p", { class: "site-footer__tagline" }, brand.tagline));
  }
  if (Array.isArray(brand.social) && brand.social.length) {
    const links = brand.social.map((s) => {
      const icon = SOCIAL_ICONS[s.icon] || "";
      return el("a", {
        class: "site-footer__social-link",
        href: s.href || "#",
        target: s.href && /^https?:/i.test(s.href) ? "_blank" : null,
        rel: s.href && /^https?:/i.test(s.href) ? "noopener noreferrer" : null,
        "aria-label": s.label,
        title: s.label,
        html: icon || `<span aria-hidden="true">${(s.label || "?")[0]}</span>`,
      });
    });
    children.push(el("div", { class: "site-footer__social" }, ...links));
  }
  return el("div", { class: "site-footer__brand" }, ...children);
}

function renderLegal(legal) {
  if (!legal) return null;
  const left = el("p", { class: "site-footer__legal-copy" }, legal.note
    ? el(
        "span",
        {},
        legal.copyright || "",
        legal.note ? " · " : "",
        legal.note ? el("span", { style: "color:var(--muted-soft)" }, legal.note) : null
      )
    : legal.copyright || ""
  );

  const metaItems = [];
  if (Array.isArray(legal.meta)) {
    legal.meta.forEach((m) =>
      metaItems.push(el("li", {}, el("a", { href: resolvePortalHref(m.href) || "#" }, m.label)))
    );
  }
  if (legal.build) {
    metaItems.push(
      el(
        "li",
        {},
        el(
          "span",
          { class: "site-footer__build" },
          el("span", { class: "site-footer__build-dot", "aria-hidden": "true" }),
          legal.build
        )
      )
    );
  }
  const right = el("ul", { class: "site-footer__legal-meta" }, ...metaItems);

  return el("div", { class: "site-footer__legal" }, left, right);
}

function render(slot, cfg) {
  const variant = slot.getAttribute("data-variant");
  const cols = slot.getAttribute("data-cols");

  slot.classList.add("site-footer");
  if (variant) slot.classList.add("site-footer--" + variant);
  slot.setAttribute("role", "contentinfo");
  if (!slot.hasAttribute("aria-label")) slot.setAttribute("aria-label", "Site footer");
  if (cols) slot.setAttribute("data-cols", cols);

  const columns = Array.isArray(cfg.columns) ? cfg.columns : [];
  const inner = el(
    "div",
    { class: "site-footer__inner" },
    renderBrand(cfg.brand),
    el(
      "div",
      { class: "site-footer__cols" },
      ...columns.map(renderColumn)
    )
  );

  slot.innerHTML = "";
  slot.appendChild(inner);
  const legalNode = renderLegal(cfg.legal);
  if (legalNode) slot.appendChild(legalNode);
}

// ─── Slot discovery ───────────────────────────────────────────────────

function isSlot(node) {
  return (
    node &&
    node.nodeType === 1 &&
    node.getAttribute &&
    node.getAttribute("data-component") === "site-footer"
  );
}

function findOrCreateSlot(root) {
  let slot = (root && root.querySelector
    ? root
    : document
  ).querySelector('[data-component="site-footer"]:not([data-site-footer-mounted])');
  if (slot) return slot;

  slot = document.createElement("footer");
  slot.setAttribute("data-component", "site-footer");

  const shell = document.querySelector(".docs-shell");
  if (shell) {
    // Place inside the shell so it joins the grid (CSS spans it across cols).
    shell.appendChild(slot);
    return slot;
  }
  const main = document.querySelector("main");
  if (main && main.parentNode) {
    main.parentNode.insertBefore(slot, main.nextSibling);
    return slot;
  }
  document.body.appendChild(slot);
  return slot;
}

// ─── Public mount ────────────────────────────────────────────────────
//
// mountSiteFooter() — auto-find or create the slot inside document.
// mountSiteFooter(slot) — explicit slot (multi-instance showcase pages).
// mountSiteFooter(rootEl) — search within a sub-tree, then fall back to body.
export function mountSiteFooter(arg = document) {
  const html = document.documentElement;
  const isAuto = arg === document;
  if (html && html.dataset.footer === "off" && isAuto) return;

  const root = isAuto ? document : arg.ownerDocument || document;
  const slot = isSlot(arg) ? arg : findOrCreateSlot(arg);
  if (!slot || slot.dataset.siteFooterMounted === "true") return;
  slot.dataset.siteFooterMounted = "true";

  // Auto-mount may inject the slot after a page-level inline config script,
  // so allow document-wide lookup. Explicit mounts (showcase/multi-footer)
  // must scope to slot-adjacent JSON only.
  const opts = { allowDocumentInline: isAuto };

  const hasRemote = slot.hasAttribute("data-footer-src");
  if (hasRemote) {
    render(slot, resolveConfig(root, slot, opts)); // paint defaults first
    resolveConfig(root, slot, { ...opts, async: true }).then((cfg) =>
      render(slot, cfg)
    );
  } else {
    render(slot, resolveConfig(root, slot, opts));
  }
}
