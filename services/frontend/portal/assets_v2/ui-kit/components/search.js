import { resolvePortalHref } from "./portal-href.js";
import { resultKind } from "./search-badges.js";

/* ui-kit/components/search.js — topbar search powered by Pagefind.

   ADR-0033 (Accepted) — the in-house BM25 indexer/ranker (ADR-0027, Superseded)
   was replaced by Pagefind. This module preserves the original UX shell:
     - Auto-injection into every `.topbar__actions` (no per-page markup).
     - Hotkeys `/`, `⌘K`, `Esc` keep working — they target `.docs-search__input`
       via hotkeys.js, which is unchanged.
     - Top-12 results, 120 ms debounce, `<mark>`-highlighted excerpts.
   Internal vs public split is enforced server-side by Pagefind facets — the
   public portal narrows by `visibility:public`, the internal portal sees all.
*/

const MAX_RESULTS = 12;
const DEBOUNCE_MS = 120;
const BUNDLE_HREF = "/services/frontend/portal/pagefind/pagefind.js";

const SEARCH_SVG =
  "<svg class='docs-search__icon' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true' focusable='false'><circle cx='11' cy='11' r='7'/><path d='m21 21-4.3-4.3'/></svg>";

let pagefindPromise = null;

async function loadPagefind() {
  if (pagefindPromise) return pagefindPromise;
  pagefindPromise = (async () => {
    const href = resolvePortalHref(BUNDLE_HREF);
    try {
      const pf = await import(/* @vite-ignore */ href);
      // `basePath` controls where the bundle assets (entry/meta/index/fragment)
      // are fetched from — leave it as Pagefind's auto-derived value
      // (/services/frontend/portal/pagefind/).
      // `baseUrl` is what gets prepended to result URLs at search time. Without
      // it Pagefind reuses basePath, which would point clicks back into
      // assets/ — but our actual pages live at /services/portal/ (or
      // /<repo>/portal/ on GH Pages). Derive the portal root from the current
      // pathname.
      const m = window.location.pathname.match(/^(.*?\/portal\/)/);
      const baseUrl = m ? m[1] : "/";
      if (pf && typeof pf.options === "function") {
        await pf.options({ excerptLength: 30, baseUrl });
      }
      return pf;
    } catch (_) {
      return null;
    }
  })();
  return pagefindPromise;
}

function visibilityFilter() {
  const portal = document.documentElement.getAttribute("data-portal") || "internal";
  if (portal === "public") return { visibility: "public" };
  return null;
}

async function runSearch(query) {
  const pf = await loadPagefind();
  if (!pf || typeof pf.search !== "function") return null;
  const filter = visibilityFilter();
  const options = filter ? { filters: filter } : undefined;
  let result;
  try {
    result = await pf.search(query, options);
  } catch (_) {
    return null;
  }
  if (!result || !Array.isArray(result.results)) return [];
  const top = result.results.slice(0, MAX_RESULTS);
  const data = await Promise.all(top.map((r) => r.data()));
  return data.map((d) => normalizeHit(d));
}

function normalizeHit(d) {
  const meta = d.meta || {};
  const filters = d.filters || {};
  return {
    url: d.url || "",
    title: meta.title || stripTitleFromContent(d.content) || d.url || "",
    excerpt: d.excerpt || "",
    section: meta.breadcrumb || meta.section || "",
    kind: resolveKind(meta.kind, filters.kind, d.url),
  };
}

function resolveKind(metaKind, filterKind, url) {
  const raw = metaKind || (Array.isArray(filterKind) ? filterKind[0] : filterKind) || null;
  return resultKind(raw, url);
}

function stripTitleFromContent(content) {
  if (!content) return "";
  const first = String(content).split(/[.·•|]/)[0];
  return first.trim().slice(0, 80);
}

function buildHref(url) {
  if (!url) return "#";
  if (/^https?:/i.test(url)) return url;
  // Pagefind already prepended the correct basePath (see loadPagefind), so
  // result URLs are absolute and portal-rooted. Nothing else to do here.
  return url;
}

function rewritePagefindMarks(excerpt) {
  return String(excerpt || "").replace(
    /<mark>/g,
    '<mark class="docs-search__match">'
  );
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderResults(panel, results, onPick) {
  panel.innerHTML = "";
  if (!results.length) {
    const e = document.createElement("div");
    e.className = "docs-search__empty";
    e.textContent = "No matches.";
    panel.appendChild(e);
    return;
  }
  const ul = document.createElement("ul");
  ul.className = "docs-search__results-list";
  ul.setAttribute("role", "presentation");
  results.forEach((r, i) => {
    const li = document.createElement("li");
    li.setAttribute("role", "presentation");
    const a = document.createElement("a");
    a.className = "docs-search__result-link";
    a.setAttribute("role", "option");
    a.setAttribute("aria-selected", i === 0 ? "true" : "false");
    a.href = buildHref(r.url);
    a.innerHTML =
      `<span class="docs-search__result-top">` +
      `<span class="docs-search__result-title">${escapeHtml(r.title)}</span>` +
      `<span class="docs-search__result-kind">${escapeHtml(r.kind)}</span>` +
      `</span>` +
      (r.section
        ? `<span class="docs-search__result-meta">${escapeHtml(r.section)} · ${escapeHtml(r.url)}</span>`
        : `<span class="docs-search__result-meta">${escapeHtml(r.url)}</span>`) +
      (r.excerpt
        ? `<span class="docs-search__result-preview">${rewritePagefindMarks(r.excerpt)}</span>`
        : "");
    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      onPick(r);
    });
    li.appendChild(a);
    ul.appendChild(li);
  });
  panel.appendChild(ul);
}

function ensureSearchMarkup(host) {
  host.classList.add("docs-search");
  if (host.querySelector(".docs-search__input")) return;
  const id = "docs-search-results-" + Math.random().toString(36).slice(2, 8);
  host.innerHTML =
    SEARCH_SVG +
    `<input class="docs-search__input" type="search" placeholder="Search docs…"` +
    ` aria-label="Search docs" autocomplete="off" spellcheck="false"` +
    ` data-tooltip="Search all docs. Press / or ⌘K to focus." data-tooltip-placement="bottom"` +
    ` role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}">` +
    `<div class="docs-search__panel" id="${id}" role="listbox" inert></div>`;
}

function wireSearch(host) {
  ensureSearchMarkup(host);
  const input = host.querySelector(".docs-search__input");
  const panel = host.querySelector(".docs-search__panel");
  let selected = 0;
  let current = [];
  let debounceTimer = null;
  let activeRunId = 0;

  const setSelected = (i) => {
    const items = panel.querySelectorAll(".docs-search__result-link");
    if (!items.length) return;
    selected = Math.max(0, Math.min(i, items.length - 1));
    items.forEach((el, n) => el.setAttribute("aria-selected", n === selected ? "true" : "false"));
    items[selected].scrollIntoView({ block: "nearest" });
  };

  const onPick = (r) => {
    if (r && r.url) window.location.href = buildHref(r.url);
  };

  const showPanel = (show) => {
    // `inert` both gates visibility (via CSS `:not([inert])`) and prevents
    // focus inside the panel — avoids the aria-hidden + retained-focus warning.
    if (show) panel.removeAttribute("inert");
    else panel.setAttribute("inert", "");
    input.setAttribute("aria-expanded", show ? "true" : "false");
  };

  const runQuery = async () => {
    const q = input.value.trim();
    if (!q) {
      current = [];
      panel.innerHTML = "";
      showPanel(false);
      return;
    }
    const runId = ++activeRunId;
    const results = await runSearch(q);
    if (runId !== activeRunId) return;
    if (results === null) {
      panel.innerHTML = `<div class="docs-search__empty">Index unavailable.</div>`;
      showPanel(true);
      return;
    }
    current = results;
    renderResults(panel, current, onPick);
    selected = 0;
    showPanel(true);
  };

  input.addEventListener("input", () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runQuery, DEBOUNCE_MS);
  });

  input.addEventListener("focus", () => {
    loadPagefind();
    if (current.length) showPanel(true);
  });

  input.addEventListener("blur", () => {
    setTimeout(() => showPanel(false), 140);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (current.length) setSelected(selected + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (current.length) setSelected(selected - 1);
    } else if (e.key === "Enter") {
      if (current[selected]) {
        e.preventDefault();
        onPick(current[selected]);
      }
    } else if (e.key === "Escape") {
      input.value = "";
      current = [];
      panel.innerHTML = "";
      showPanel(false);
      input.blur();
    }
  });
}

function autoInjectIntoTopbars(root) {
  const bars = root.querySelectorAll(".topbar__actions");
  bars.forEach((bar) => {
    const topbar = bar.closest(".topbar") || bar;
    if (topbar.querySelector('.docs-search, [data-component="search"]')) return;
    const wrap = document.createElement("div");
    wrap.setAttribute("data-component", "search");
    wrap.dataset.searchAutoInjected = "true";
    if (bar.firstChild) bar.insertBefore(wrap, bar.firstChild);
    else bar.appendChild(wrap);
  });
}

export async function mountSearch(root = document) {
  autoInjectIntoTopbars(root);
  const hosts = new Set([
    ...root.querySelectorAll('[data-component="search"]'),
    ...root.querySelectorAll(".docs-search"),
  ]);
  if (!hosts.size) return;
  hosts.forEach((host) => {
    if (host.dataset.searchBound === "true") return;
    host.dataset.searchBound = "true";
    wireSearch(host);
  });
}
