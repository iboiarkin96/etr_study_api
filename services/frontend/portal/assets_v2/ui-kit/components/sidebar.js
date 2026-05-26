/* ui-kit/components/sidebar.js — fetch nav-tree JSON, render the tree
   with an optional brand block and a sidebar-wide collapse toggle.
   Persists group-collapse state, scroll, and full-sidebar collapse state. */

// Storage holds the set of explicitly-EXPANDED group IDs. Default (no entry
// in localStorage) means all groups start collapsed — the user opens what
// they need and that selection is what persists across navigation.
const STORAGE_KEY = "docs-sidebar-expanded-v2";
const SCROLL_KEY = "docs-sidebar-scroll-v2";
const SHELL_COLLAPSE_KEY = "docs-sidebar-shell-collapsed-v2";
const WIDTH_KEY = "docs-sidebar-width-v2";

const WIDTH_MIN = 220;
const WIDTH_MAX = 520;
const WIDTH_DEFAULT = 280;
const WIDTH_STEP = 16;

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

function loadExpanded() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (_) {
    return new Set();
  }
}

function saveExpanded(set) {
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

// `/services/X` hrefs → `<base>/X` so Pages (where services/ is the artifact root) doesn't 404.
function resolvePortalHref(href) {
  if (!href || !href.startsWith("/services/")) return href;
  const m = window.location.pathname.match(/^(.*?)\/portal\//);
  if (!m) return href;
  return m[1] + href.slice("/services".length);
}

function isActive(href) {
  if (!href) return false;
  const here = window.location.pathname.replace(/\/+$/, "");
  const target = resolvePortalHref(href).replace(/\/+$/, "");
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
    link.href = resolvePortalHref(brand.href) || "#";
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
  toggle.setAttribute("data-tooltip", "Collapse the sidebar to icons.");
  toggle.setAttribute("data-tooltip-placement", "right");
  toggle.innerHTML = CHEVRON_LEFT;
  header.appendChild(toggle);

  return header;
}

function buildNode(node, expanded) {
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
    caret.setAttribute("data-tooltip", "Expand or collapse this section.");
    caret.setAttribute("data-tooltip-placement", "right");
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
    a.href = resolvePortalHref(node.href);
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
    node.children.forEach((c) => sub.appendChild(buildNode(c, expanded)));
    item.appendChild(sub);
    const cid = node.id || node.href || node.label;
    // Default is collapsed — only nodes the user has explicitly opened (or
    // the section containing the active page) stay expanded.
    const forceOpen = hasActiveDescendant(node);
    if (!expanded.has(cid) && !forceOpen) item.setAttribute("data-collapsed", "true");
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
    toggle.setAttribute(
      "data-tooltip",
      collapsed ? "Expand the sidebar to full width." : "Collapse the sidebar to icons."
    );
  }
}

function readSidebarWidthVar(el) {
  const computed = getComputedStyle(el).getPropertyValue("--layout-sidebar").trim();
  const parsed = parseInt(computed, 10);
  return Number.isFinite(parsed) ? parsed : WIDTH_DEFAULT;
}

function clampSidebarWidth(px) {
  return Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Math.round(px)));
}

function loadSidebarWidth() {
  try {
    const v = parseInt(localStorage.getItem(WIDTH_KEY) || "", 10);
    return Number.isFinite(v) ? clampSidebarWidth(v) : null;
  } catch (_) {
    return null;
  }
}

function saveSidebarWidth(px) {
  try {
    localStorage.setItem(WIDTH_KEY, String(px));
  } catch (_) {
    /* ignore quota */
  }
}

function applySidebarWidth(shell, resizer, px) {
  shell.style.setProperty("--layout-sidebar", `${px}px`);
  if (resizer) resizer.setAttribute("aria-valuenow", String(px));
}

function wireResizer(container) {
  const shell = container.closest(".docs-shell");
  // Drawer copies and showcase examples don't own the shell width.
  if (!shell || container.closest(".docs-drawer") || container.closest(".docs-example")) {
    return;
  }

  const resizer = document.createElement("button");
  resizer.type = "button";
  resizer.className = "docs-sidebar__resizer";
  resizer.setAttribute("role", "separator");
  resizer.setAttribute("aria-orientation", "vertical");
  resizer.setAttribute("aria-label", "Resize sidebar");
  resizer.setAttribute("aria-valuemin", String(WIDTH_MIN));
  resizer.setAttribute("aria-valuemax", String(WIDTH_MAX));
  resizer.setAttribute("data-tooltip", "Drag to resize. Double-click to reset.");
  resizer.setAttribute("data-tooltip-placement", "right");
  container.appendChild(resizer);

  const persisted = loadSidebarWidth();
  if (persisted != null) {
    applySidebarWidth(shell, resizer, persisted);
  } else {
    resizer.setAttribute("aria-valuenow", String(readSidebarWidthVar(shell)));
  }

  let dragging = false;
  let startX = 0;
  let startW = 0;

  resizer.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    dragging = true;
    startX = e.clientX;
    startW = container.getBoundingClientRect().width;
    try { resizer.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    shell.classList.add("is-sidebar-resizing");
    e.preventDefault();
  });

  resizer.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    applySidebarWidth(shell, resizer, clampSidebarWidth(startW + (e.clientX - startX)));
  });

  const finishDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    try { resizer.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    shell.classList.remove("is-sidebar-resizing");
    saveSidebarWidth(clampSidebarWidth(container.getBoundingClientRect().width));
  };
  resizer.addEventListener("pointerup", finishDrag);
  resizer.addEventListener("pointercancel", finishDrag);

  resizer.addEventListener("keydown", (e) => {
    const cur = readSidebarWidthVar(shell);
    let next = null;
    if (e.key === "ArrowLeft") next = cur - WIDTH_STEP;
    else if (e.key === "ArrowRight") next = cur + WIDTH_STEP;
    else if (e.key === "Home") next = WIDTH_MIN;
    else if (e.key === "End") next = WIDTH_MAX;
    else if (e.key === "Enter" || e.key === " ") next = WIDTH_DEFAULT;
    if (next == null) return;
    e.preventDefault();
    next = clampSidebarWidth(next);
    applySidebarWidth(shell, resizer, next);
    saveSidebarWidth(next);
  });

  resizer.addEventListener("dblclick", () => {
    applySidebarWidth(shell, resizer, WIDTH_DEFAULT);
    saveSidebarWidth(WIDTH_DEFAULT);
  });
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
  const expanded = loadExpanded();
  container.classList.add("docs-sidebar");
  container.innerHTML = "";

  // Inner scroll wrapper: owns overflow + scrollbar so the resizer (a
  // direct child of the outer container) sits in its own gutter and can
  // catch pointer events without the scrollbar stealing them first.
  const scroller = document.createElement("div");
  scroller.className = "docs-sidebar__scroll";

  // Brand + collapse toggle header (brand is optional via `tree.brand`).
  const header = buildBrand(tree.brand);
  scroller.appendChild(header);

  const list = document.createElement("ul");
  list.className = "docs-sidebar__list";
  tree.sections.forEach((s) => list.appendChild(buildNode(s, expanded)));
  scroller.appendChild(list);

  container.appendChild(scroller);

  // Restore scroll AFTER the DOM is populated so the offset is meaningful.
  restoreScroll(scroller);

  // Wire the sidebar-wide collapse toggle (button is always present).
  const toggle = header.querySelector(".docs-sidebar__collapse-toggle");
  wireCollapseToggle(container, toggle);

  // Right-edge drag handle for free-form width resize.
  wireResizer(container);

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
    const current = loadExpanded();
    if (item.getAttribute("data-collapsed") === "true") {
      item.removeAttribute("data-collapsed");
      current.add(cid);
    } else {
      item.setAttribute("data-collapsed", "true");
      current.delete(cid);
    }
    saveExpanded(current);
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
