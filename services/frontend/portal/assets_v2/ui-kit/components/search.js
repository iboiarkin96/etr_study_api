/* ui-kit/components/search.js — topbar search.
   Loads /search-index-<portal>.json (falls back to mocks). Filters by title + breadcrumb. */

const MAX_RESULTS = 12;

async function loadIndex(portal) {
  const tries = [
    `/search-index-${portal}.json`,
    `/services/frontend/portal/assets_v2/ui-kit/mocks/search-index-${portal}.json`,
    `/services/frontend/portal/assets_v2/ui-kit/mocks/search-index.json`,
  ];
  for (const url of tries) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.docs)) return data.docs;
    } catch (_) {
      /* try next */
    }
  }
  return [];
}

function score(item, q) {
  const t = (item.title || "").toLowerCase();
  const b = (item.breadcrumb || "").toLowerCase();
  const s = (item.snippet || "").toLowerCase();
  if (t.includes(q)) return 3;
  if (b.includes(q)) return 2;
  if (s.includes(q)) return 1;
  return 0;
}

function filter(index, q) {
  const ql = q.toLowerCase().trim();
  if (!ql) return [];
  return index
    .map((item) => ({ item, s: score(item, ql) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, MAX_RESULTS)
    .map((x) => x.item);
}

function renderResults(panel, results, onPick) {
  panel.innerHTML = "";
  if (!results.length) {
    const e = document.createElement("div");
    e.className = "docs-search__empty";
    e.textContent = "No matches";
    panel.appendChild(e);
    return;
  }
  const ul = document.createElement("ul");
  ul.className = "docs-search__results";
  results.forEach((r, i) => {
    const li = document.createElement("li");
    li.className = "docs-search__result";
    li.setAttribute("role", "option");
    if (i === 0) li.setAttribute("aria-selected", "true");
    li.innerHTML =
      `<span class="docs-search__result-title">${r.title || ""}</span>` +
      (r.breadcrumb ? `<span class="docs-search__result-breadcrumb">${r.breadcrumb}</span>` : "") +
      (r.snippet ? `<span class="docs-search__result-snippet">${r.snippet}</span>` : "");
    li.addEventListener("click", () => onPick(r));
    ul.appendChild(li);
  });
  panel.appendChild(ul);
}

export async function mountSearch(root = document) {
  const wraps = root.querySelectorAll('[data-component="search"]');
  if (!wraps.length) return;
  const portal = document.documentElement.getAttribute("data-portal") || "internal";
  const index = await loadIndex(portal);

  wraps.forEach((wrap) => {
    wrap.classList.add("docs-search");
    if (!wrap.querySelector(".docs-search__input")) {
      wrap.innerHTML =
        "<svg class='docs-search__icon' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' aria-hidden='true'><circle cx='11' cy='11' r='7'/><path d='m21 21-4.3-4.3' stroke-linecap='round'/></svg>" +
        "<input class='docs-search__input' type='search' placeholder='Search docs…' aria-label='Search docs' autocomplete='off'>" +
        "<div class='docs-search__panel' role='listbox' aria-hidden='true'></div>";
    }
    const input = wrap.querySelector(".docs-search__input");
    const panel = wrap.querySelector(".docs-search__panel");
    let selected = 0;
    let current = [];
    const setSelected = (i) => {
      const items = panel.querySelectorAll(".docs-search__result");
      items.forEach((it, n) => it.toggleAttribute("aria-selected", n === i));
      selected = i;
    };
    const onPick = (r) => {
      if (r && r.href) window.location.href = r.href;
    };
    input.addEventListener("input", () => {
      current = filter(index, input.value);
      renderResults(panel, current, onPick);
      panel.setAttribute("aria-hidden", current.length || input.value ? "false" : "true");
      selected = 0;
    });
    input.addEventListener("focus", () => {
      if (current.length) panel.setAttribute("aria-hidden", "false");
    });
    input.addEventListener("blur", () => setTimeout(() => panel.setAttribute("aria-hidden", "true"), 120));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (current.length) setSelected(Math.min(selected + 1, current.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (current.length) setSelected(Math.max(selected - 1, 0));
      } else if (e.key === "Enter") {
        if (current[selected]) onPick(current[selected]);
      } else if (e.key === "Escape") {
        panel.setAttribute("aria-hidden", "true");
        input.blur();
      }
    });
  });
}
