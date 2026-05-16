/* ui-kit/components/drawer.js — mobile sidebar drawer.
   Open via [data-drawer-trigger], focus trap, Esc/backdrop close, scroll lock. */

let trapHandler = null;
let lastFocused = null;

function lockScroll() {
  document.body.style.overflow = "hidden";
}
function unlockScroll() {
  document.body.style.overflow = "";
}

function getFocusable(panel) {
  return panel.querySelectorAll(
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
}

export function openDrawer(drawer) {
  if (!drawer) return;
  lastFocused = document.activeElement;
  drawer.setAttribute("aria-hidden", "false");
  lockScroll();
  const panel = drawer.querySelector(".docs-drawer__panel");
  const focusable = panel ? getFocusable(panel) : [];
  if (focusable.length) focusable[0].focus();
  trapHandler = (e) => {
    if (e.key === "Escape") {
      closeDrawer(drawer);
      return;
    }
    if (e.key !== "Tab" || !panel) return;
    const items = getFocusable(panel);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  };
  document.addEventListener("keydown", trapHandler);
}

export function closeDrawer(drawer) {
  if (!drawer) return;
  drawer.setAttribute("aria-hidden", "true");
  unlockScroll();
  if (trapHandler) {
    document.removeEventListener("keydown", trapHandler);
    trapHandler = null;
  }
  if (lastFocused && typeof lastFocused.focus === "function") {
    lastFocused.focus();
  }
}

function autoCreate(root) {
  if (!document.body.classList.contains("docs-shell")) return null;
  const sidebar = root.querySelector('[data-component="sidebar"][data-nav-src]');
  if (!sidebar) return null;
  const navSrc = sidebar.getAttribute("data-nav-src");

  const drawer = document.createElement("div");
  drawer.setAttribute("data-component", "drawer");
  drawer.className = "docs-drawer";
  drawer.setAttribute("aria-hidden", "true");
  drawer.innerHTML =
    '<div class="docs-drawer__backdrop"></div>' +
    '<div class="docs-drawer__panel">' +
    '<div class="docs-drawer__head">' +
    '<span class="docs-drawer__title">Navigation</span>' +
    '<button type="button" data-drawer-close class="docs-drawer__close" aria-label="Close navigation">' +
    "<svg viewBox='0 0 24 24' width='20' height='20' fill='none' stroke='currentColor' stroke-width='2' aria-hidden='true'>" +
    "<path d='M6 6l12 12M18 6L6 18' stroke-linecap='round'/></svg>" +
    "</button>" +
    "</div>" +
    `<aside data-component="sidebar" data-nav-src="${navSrc}" aria-label="Mobile navigation"></aside>` +
    "</div>";
  document.body.appendChild(drawer);

  const topbar = document.querySelector(".topbar");
  if (topbar && !topbar.querySelector(".topbar__menu")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "topbar__menu";
    btn.setAttribute("data-drawer-trigger", "");
    btn.setAttribute("aria-label", "Open navigation");
    btn.setAttribute("data-tooltip", "Open the navigation drawer.");
    btn.setAttribute("data-tooltip-placement", "bottom");
    btn.innerHTML =
      "<svg viewBox='0 0 24 24' width='22' height='22' fill='none' stroke='currentColor' stroke-width='2' aria-hidden='true'>" +
      "<path d='M4 6h16M4 12h16M4 18h16' stroke-linecap='round'/></svg>";
    topbar.insertBefore(btn, topbar.firstChild);
  }

  return drawer;
}

export function mountDrawer(root = document) {
  let drawer = root.querySelector('[data-component="drawer"]');
  if (!drawer) drawer = autoCreate(root);
  if (!drawer) return;

  const triggers = document.querySelectorAll(
    '[data-component="drawer-trigger"], [data-drawer-trigger]'
  );
  triggers.forEach((btn) => {
    if (btn.dataset.drawerBound === "true") return;
    btn.dataset.drawerBound = "true";
    btn.addEventListener("click", () => openDrawer(drawer));
  });
  const backdrop = drawer.querySelector(".docs-drawer__backdrop");
  if (backdrop) backdrop.addEventListener("click", () => closeDrawer(drawer));
  const closeBtn = drawer.querySelector("[data-drawer-close]");
  if (closeBtn) closeBtn.addEventListener("click", () => closeDrawer(drawer));
}
