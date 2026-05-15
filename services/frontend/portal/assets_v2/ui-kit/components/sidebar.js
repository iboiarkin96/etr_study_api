/* ui-kit/components/sidebar.js — fetch nav-tree JSON, render the tree
   with an optional brand block and a sidebar-wide collapse toggle.
   Persists group-collapse state, scroll, and full-sidebar collapse state. */

const STORAGE_KEY = "docs-sidebar-collapsed-v2";
const SCROLL_KEY = "docs-sidebar-scroll-v2";
const SHELL_COLLAPSE_KEY = "docs-sidebar-shell-collapsed-v2";

const CHEVRON_LEFT = "<svg viewBox='0 0 16 16' aria-hidden='true' width='14' height='14'><path d='M10 4l-4 4 4 4' fill='none' stroke='currentColor' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'/></svg>";

function loadScroll() {
  try {
    const v = sessionStorage.getItem(SCROLL_KEY);
    return v ? Math.max(0, parseInt(v, 10) || 0) : 0;
  } catch (_) {
    return 0;
  }
}

function saveScroll(top) {
  try {
    sessionStorage.setItem(SCROLL_KEY, String(top));
  } catch (_) {
    /* ignore quota */
  }
}

function loadCollapsed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (_) {
    return new Set();
  }
}

function saveCollapsed(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch (_) {
    /* ignore quota */
  }
}

function loadShellCollapsed() {
  try {
    return localStorage.getItem(SHELL_COLLAPSE_KEY) === "1";
  } catch (_) {
    return false;
  }
}

function saveShellCollapsed(flag) {
  try {
    localStorage.setItem(SHELL_COLLAPSE_KEY, flag ? "1" : "0");
  } catch (_) {
    /* ignore quota */
  }
}

function isActive(href) {
  if (!href) return false;
  const here = window.location.pathname.replace(/\/+$/, "");
  const target = href.replace(/\/+$/, "");
  return here === target || here.startsWith(target + "/");
}

// Walk the tree; return true if any descendant of `node` (or `node` itself)
// has an href matching the current pathname. Used to force-expand the active
// section so the user can always see where they are after navigation.
function hasActiveDescendant(node) {
  if (node.href && isActive(node.href)) return true;
  if (node.children) {
    for (const c of node.children) {
      if (hasActiveDescendant(c)) return true;
    }
  }
  return false;
}

function buildBrand(brand) {
  // Brand block = optional wordmark + always-present collapse toggle.
  const header = document.createElement("header");
  header.className = "docs-sidebar__brand";

  if (brand) {
    const link = document.createElement("a");
    link.className = "docs-sidebar__wordmark";
    link.href = brand.href || "#";
    if (brand.ariaLabel) link.setAttribute("aria-label", brand.ariaLabel);

    if (brand.mark) {
      const mark = document.createElement("span");
      mark.className = "docs-sidebar__brand-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = brand.mark;
      link.appendChild(mark);
    }

    const text = document.createElement("span");
    text.className = "docs-sidebar__brand-text";

    const product = document.createElement("span");
    product.className = "docs-sidebar__brand-product";
    if (brand.productHtml) {
      product.innerHTML = brand.productHtml;
    } else {
      product.textContent = brand.product || "";
    }
    text.appendChild(product);

    if (brand.tagline) {
      const tagline = document.createElement("span");
      tagline.className = "docs-sidebar__brand-tagline";
      tagline.textContent = brand.tagline;
      text.appendChild(tagline);
    }

    link.appendChild(text);
    header.appendChild(link);
  }

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "docs-sidebar__collapse-toggle";
  toggle.setAttribute("aria-label", "Collapse navigation");
  toggle.setAttribute("aria-expanded", "true");
  toggle.innerHTML = CHEVRON_LEFT;
  header.appendChild(toggle);

  return header;
}

function buildNode(node, collapsed) {
  const item = document.createElement("li");
  item.className = "docs-sidebar__item";
  if (node.kind) item.classList.add(`docs-sidebar__item--${node.kind}`);
  item.dataset.nodeId = node.id || "";
  if (node.kind) item.dataset.kind = node.kind;

  const row = document.createElement("div");
  row.className = "docs-sidebar__row";
  if (node.kind) row.classList.add(`docs-sidebar__row--${node.kind}`);

  if (node.children && node.children.length) {
    const caret = document.createElement("button");
    caret.type = "button";
    caret.className = "docs-sidebar__caret";
    caret.setAttribute("aria-label", "Toggle section");
    caret.innerHTML = "<svg viewBox='0 0 12 12' aria-hidden='true' width='10' height='10'><path d='M3 4l3 4 3-4' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>";
    row.appendChild(caret);
  }

  if (node.icon) {
    const ic = document.createElement("span");
    ic.className = "docs-sidebar__icon";
    ic.setAttribute("aria-hidden", "true");
    ic.textContent = node.icon;
    row.appendChild(ic);
  }

  if (node.href) {
    const a = document.createElement("a");
    a.className = "docs-sidebar__link";
    if (node.kind) a.classList.add(`docs-sidebar__link--${node.kind}`);
    a.href = node.href;
    a.textContent = node.label;
    if (isActive(node.href)) a.setAttribute("aria-current", "page");
    row.appendChild(a);
  } else {
    const span = document.createElement("span");
    span.className = "docs-sidebar__group";
    span.textContent = node.label;
    row.appendChild(span);
  }
  item.appendChild(row);

  if (node.children && node.children.length) {
    const sub = document.createElement("ul");
    sub.className = "docs-sidebar__children";
    node.children.forEach((c) => sub.appendChild(buildNode(c, collapsed)));
    item.appendChild(sub);
    const cid = node.id || node.href || node.label;
    // Force-expand any section whose subtree contains the current page —
    // user must always be able to see where they are after navigating.
    const forceOpen = hasActiveDescendant(node);
    if (collapsed.has(cid) && !forceOpen) item.setAttribute("data-collapsed", "true");
  }
  return item;
}

function restoreScroll(container) {
  // Drawer copy: never persist its scroll — open-state restarts fresh on every open.
  if (container.closest(".docs-drawer")) return;

  const saved = loadScroll();
  container.scrollTop = saved;

  // If the active link is not visible in the viewport after restore,
  // gently bring it into view. This handles first visits + deep links.
  const active = container.querySelector('.docs-sidebar__link[aria-current="page"]');
  if (active) {
    const cRect = container.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    const above = aRect.top < cRect.top;
    const below = aRect.bottom > cRect.bottom;
    if (above || below) {
      active.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }

  // Throttle scroll-save to keep sessionStorage updated as user scrolls.
  let saveTimer = null;
  container.addEventListener(
    "scroll",
    () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveScroll(container.scrollTop), 120);
    },
    { passive: true }
  );

  // Also flush before unload so the very last position is captured.
  window.addEventListener("beforeunload", () => saveScroll(container.scrollTop), {
    once: true,
  });
}

function applyShellCollapsed(shell, toggle, collapsed) {
  if (!shell) return;
  shell.classList.toggle("is-sidebar-collapsed", collapsed);
  if (toggle) {
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    toggle.setAttribute("aria-label", collapsed ? "Expand navigation" : "Collapse navigation");
  }
}

function wireCollapseToggle(container, toggle) {
  const shell = container.closest(".docs-shell");
  // Skip the global shell-collapse wiring for drawer copies and showcase
  // examples that aren't the actual page-level sidebar.
  if (!shell || container.closest(".docs-drawer") || container.closest(".docs-example")) {
    // Inside an example: still let the toggle visually demo (no shell binding).
    return;
  }

  // Apply persisted state on mount.
  applyShellCollapsed(shell, toggle, loadShellCollapsed());

  toggle.addEventListener("click", () => {
    const next = !shell.classList.contains("is-sidebar-collapsed");
    applyShellCollapsed(shell, toggle, next);
    saveShellCollapsed(next);
  });
}

function render(container, tree) {
  const collapsed = loadCollapsed();
  container.classList.add("docs-sidebar");
  container.innerHTML = "";

  // Brand + collapse toggle header (brand is optional via `tree.brand`).
  const header = buildBrand(tree.brand);
  container.appendChild(header);

  const list = document.createElement("ul");
  list.className = "docs-sidebar__list";
  tree.sections.forEach((s) => list.appendChild(buildNode(s, collapsed)));
  container.appendChild(list);

  // Restore scroll AFTER the DOM is populated so the offset is meaningful.
  restoreScroll(container);

  // Wire the sidebar-wide collapse toggle (button is always present).
  const toggle = header.querySelector(".docs-sidebar__collapse-toggle");
  wireCollapseToggle(container, toggle);

  container.addEventListener("click", (e) => {
    // Sidebar-wide collapse button has its own handler — skip group logic.
    if (e.target.closest(".docs-sidebar__collapse-toggle")) return;
    // Let real links navigate unmodified.
    if (e.target.closest(".docs-sidebar__link")) return;
    const row = e.target.closest(".docs-sidebar__row");
    if (!row) return;
    const item = row.parentElement; // item is the direct parent <li>
    if (!item || !item.classList.contains("docs-sidebar__item")) return;
    if (!item.querySelector(":scope > .docs-sidebar__children")) return;
    const cid = item.dataset.nodeId || "";
    const current = loadCollapsed();
    if (item.getAttribute("data-collapsed") === "true") {
      item.removeAttribute("data-collapsed");
      current.delete(cid);
    } else {
      item.setAttribute("data-collapsed", "true");
      current.add(cid);
    }
    saveCollapsed(current);
  });
}

export async function mountSidebar(root = document) {
  const nodes = root.querySelectorAll('[data-component="sidebar"]');
  for (const node of nodes) {
    const src = node.getAttribute("data-nav-src");
    if (!src) continue;
    if (node.querySelector(".docs-sidebar__list")) continue;
    try {
      const res = await fetch(src, { cache: "no-cache" });
      if (!res.ok) {
        console.error(`[sidebar] failed to load ${src}: HTTP ${res.status}`);
        continue;
      }
      const tree = await res.json();
      render(node, tree);
    } catch (err) {
      console.error(`[sidebar] error loading ${src}:`, err);
    }
  }
}
