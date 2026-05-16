/* ui-kit/components/search.js — topbar search with BM25-style ranking.

   Ported from the legacy services/frontend/portal/assets/docs-search.js, with
   two simplifications:
     - The component auto-injects the input into every .topbar__actions, so
       authors don't need to add the markup to each page.
     - Telemetry / suggestions are out of scope for v2 — we keep BM25 ranking,
       prefix expansion, and result highlighting.

   The index file is the same JSON shape as the legacy one, located at:
     /search-index.json
     /search-index-<portal>.json
     /services/frontend/portal/assets_v2/ui-kit/mocks/search-index-<portal>.json

   Index shape:
     { docs: [{id, title, url, section, preview, content_len}],
       postings: { token: [[docId, tfTitle, tfUrl, tfSection, tfContent], …] },
       doc_freq: { token: docFreq },
       meta: { avg_content_len } }
*/

const MAX_RESULTS = 12;
const MAX_PREFIX_EXPANSIONS = 6;
const DEBOUNCE_MS = 120;

const SEARCH_SVG =
  "<svg class='docs-search__icon' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true' focusable='false'><circle cx='11' cy='11' r='7'/><path d='m21 21-4.3-4.3'/></svg>";

let indexPromise = null;

async function loadIndex(portal) {
  if (indexPromise) return indexPromise;
  const tries = [
    `/search-index-${portal}.json`,
    `/search-index.json`,
    `/services/frontend/portal/assets_v2/ui-kit/mocks/search-index-${portal}.json`,
    `/services/frontend/portal/assets_v2/ui-kit/mocks/search-index.json`,
  ];
  indexPromise = (async () => {
    for (const url of tries) {
      try {
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) continue;
        const data = await res.json();
        if (data && Array.isArray(data.docs) && typeof data.postings === "object") {
          return prepareIndex(data);
        }
        if (Array.isArray(data)) {
          // Legacy flat-array mock — wrap in a minimal envelope.
          return prepareIndex({
            docs: data.map((d, i) => ({
              id: i,
              title: d.title || "",
              url: d.href || d.url || "",
              section: d.section || d.breadcrumb || "",
              preview: d.snippet || d.preview || "",
              content_len: (d.snippet || "").length || 1,
            })),
            postings: {},
            doc_freq: {},
            meta: { avg_content_len: 1 },
          });
        }
      } catch (_) {
        /* try next */
      }
    }
    return null;
  })();
  return indexPromise;
}

function prepareIndex(raw) {
  const docs = raw.docs.map((doc) => ({
    id: Number(doc.id),
    title: String(doc.title || ""),
    url: String(doc.url || ""),
    section: String(doc.section || ""),
    preview: String(doc.preview || ""),
    contentLen: Number(doc.content_len || 1),
    titleNorm: normalize(doc.title || ""),
    urlNorm: normalize(doc.url || ""),
    sectionNorm: normalize(doc.section || ""),
  }));
  const vocabulary = Object.keys(raw.postings || {});
  const avgContentLen =
    Number(raw.meta && raw.meta.avg_content_len) > 0
      ? Number(raw.meta.avg_content_len)
      : 1;
  return {
    docs,
    postings: raw.postings || {},
    docFreq: raw.doc_freq || {},
    docCount: docs.length,
    avgContentLen,
    vocabulary,
  };
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9а-яё\s]/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  const n = normalize(value);
  if (!n) return [];
  return n.match(/[a-z0-9а-яё]+/giu) || [];
}

function expandToken(token, vocabulary, isLast) {
  if (!isLast || token.length < 3) return [token];
  const expanded = [token];
  for (const candidate of vocabulary) {
    if (candidate !== token && candidate.startsWith(token)) {
      expanded.push(candidate);
      if (expanded.length >= MAX_PREFIX_EXPANSIONS) break;
    }
  }
  return expanded;
}

function idf(docCount, docFreq) {
  return Math.log(1 + (docCount + 1) / (docFreq + 0.5));
}

function tfWeight(tfValue) {
  return Math.log(1 + tfValue);
}

function rank(index, query) {
  if (!index || !index.docs.length) return [];
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];
  const queryTokens = tokenize(normalizedQuery);
  if (!queryTokens.length) return [];

  const candidates = new Map();
  queryTokens.forEach((token, ti) => {
    const variants = expandToken(token, index.vocabulary, ti === queryTokens.length - 1);
    variants.forEach((variant) => {
      const postings = index.postings[variant];
      if (!Array.isArray(postings)) return;
      const tokenIdf = idf(index.docCount, Number(index.docFreq[variant] || 0));
      postings.forEach((posting) => {
        const [docId, tfT, tfU, tfS, tfC] = posting;
        const fieldScore =
          8.0 * tfWeight(tfT || 0) +
          4.0 * tfWeight(tfU || 0) +
          2.0 * tfWeight(tfS || 0) +
          1.4 * tfWeight(tfC || 0);
        if (fieldScore <= 0) return;
        candidates.set(docId, (candidates.get(docId) || 0) + tokenIdf * fieldScore);
      });
    });
  });

  const scored = [];
  candidates.forEach((base, docId) => {
    const entry = index.docs[docId];
    if (!entry) return;
    let score = base;
    const allInTitle = queryTokens.every((t) => entry.titleNorm.includes(t));
    const allInUrl = queryTokens.every((t) => entry.urlNorm.includes(t));
    if (allInTitle) score += 9;
    if (allInUrl) score += 4;
    if (entry.titleNorm.includes(normalizedQuery)) score += 12;
    if (entry.urlNorm.includes(normalizedQuery)) score += 6;
    if (entry.titleNorm.startsWith(normalizedQuery)) score += 5;
    if (entry.sectionNorm === normalizedQuery) score += 3;

    const lenRatio = entry.contentLen / Math.max(index.avgContentLen, 1);
    const lengthNorm = 1 / (1 + 0.08 * Math.max(0, lenRatio - 1));
    score *= lengthNorm;

    if (score > 0) scored.push({ entry, score, docId });
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.docId !== b.docId) return a.docId - b.docId;
    return a.entry.title.localeCompare(b.entry.title);
  });
  return scored.slice(0, MAX_RESULTS).map((x) => x.entry);
}

function highlight(text, queryTokens) {
  if (!text) return "";
  let out = escapeHtml(text);
  if (!queryTokens.length) return out;
  const pattern = new RegExp(
    "(" +
      queryTokens
        .filter((t) => t.length >= 2)
        .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|") +
      ")",
    "gi"
  );
  return out.replace(pattern, '<mark class="docs-search__match">$1</mark>');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resultKind(url) {
  const u = String(url || "").toLowerCase();
  if (!u) return "Docs";
  if (u.includes("/adr/") || /adr-\d+/.test(u)) return "ADR";
  if (u.includes("/runbooks/") || u.includes("/runbook/")) return "Runbook";
  if (u.includes("/openapi") || u.includes("/api/")) return "API";
  if (u.includes("/practices/")) return "Practice";
  if (u.includes("/templates/")) return "Template";
  if (u.includes("/components/")) return "Component";
  if (u.includes("/ui-kit/")) return "UI Kit";
  if (u.includes("/rfc/")) return "RFC";
  if (u.includes("/explanation/")) return "Explanation";
  if (u.includes("/how-to/")) return "How-to";
  if (u.includes("/tutorials/")) return "Tutorial";
  if (u.includes("/reference/")) return "Reference";
  return "Docs";
}

function buildHref(url) {
  // Index URLs are stored relative to the docs root (services/portal/).
  // Shapes: "index.html" (root), "internal/foo/bar.html", "public/foo.html",
  // sometimes "ui-kit/pages/...". Absolute or external URLs pass through.
  if (!url) return "#";
  if (/^https?:/i.test(url)) return url;
  if (url.startsWith("/")) return url;
  return "/services/portal/" + url.replace(/^\.\//, "");
}

function renderResults(panel, results, queryTokens, onPick) {
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
      `<span class="docs-search__result-title">${highlight(r.title, queryTokens)}</span>` +
      `<span class="docs-search__result-kind">${escapeHtml(resultKind(r.url))}</span>` +
      `</span>` +
      (r.section
        ? `<span class="docs-search__result-meta">${escapeHtml(r.section)} · ${escapeHtml(r.url)}</span>`
        : `<span class="docs-search__result-meta">${escapeHtml(r.url)}</span>`) +
      (r.preview
        ? `<span class="docs-search__result-preview">${highlight(r.preview.slice(0, 220), queryTokens)}…</span>`
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
    `<div class="docs-search__panel" id="${id}" role="listbox" aria-hidden="true"></div>`;
}

function wireSearch(host, getIndex) {
  ensureSearchMarkup(host);
  const input = host.querySelector(".docs-search__input");
  const panel = host.querySelector(".docs-search__panel");
  let selected = 0;
  let current = [];
  let queryTokens = [];
  let debounceTimer = null;

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
    panel.setAttribute("aria-hidden", show ? "false" : "true");
    input.setAttribute("aria-expanded", show ? "true" : "false");
  };

  const runQuery = async () => {
    const q = input.value;
    if (!q.trim()) {
      current = [];
      queryTokens = [];
      panel.innerHTML = "";
      showPanel(false);
      return;
    }
    const index = await getIndex();
    if (!index) {
      panel.innerHTML = `<div class="docs-search__empty">Index unavailable.</div>`;
      showPanel(true);
      return;
    }
    queryTokens = tokenize(q);
    current = rank(index, q);
    renderResults(panel, current, queryTokens, onPick);
    selected = 0;
    showPanel(true);
  };

  input.addEventListener("input", () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runQuery, DEBOUNCE_MS);
  });

  input.addEventListener("focus", () => {
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
    // Global `/` focus is handled in hotkeys.js — bind once across the page,
    // not per-input.
  });
}

function autoInjectIntoTopbars(root) {
  const bars = root.querySelectorAll(".topbar__actions");
  bars.forEach((bar) => {
    // Skip topbars that already host a search component anywhere in the topbar.
    const topbar = bar.closest(".topbar") || bar;
    if (topbar.querySelector(".docs-search, [data-component=\"search\"]")) return;
    const wrap = document.createElement("div");
    wrap.setAttribute("data-component", "search");
    wrap.dataset.searchAutoInjected = "true";
    // Place search at the start of actions (before bug-report + theme-toggle).
    if (bar.firstChild) bar.insertBefore(wrap, bar.firstChild);
    else bar.appendChild(wrap);
  });
}

export async function mountSearch(root = document) {
  autoInjectIntoTopbars(root);
  // Wire both author-placed (.docs-search) and auto-injected
  // ([data-component="search"]) hosts. Dedup with a Set in case a host
  // matches both selectors.
  const hosts = new Set([
    ...root.querySelectorAll('[data-component="search"]'),
    ...root.querySelectorAll(".docs-search"),
  ]);
  if (!hosts.size) return;
  const portal = document.documentElement.getAttribute("data-portal") || "internal";
  const getIndex = () => loadIndex(portal);
  hosts.forEach((host) => {
    if (host.dataset.searchBound === "true") return;
    host.dataset.searchBound = "true";
    wireSearch(host, getIndex);
  });
}
