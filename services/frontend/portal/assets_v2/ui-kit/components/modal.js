/* ui-kit/components/modal.js — generic modal controller.
   Exposes window.docsModal = { open, close }. Focus trap, Esc, backdrop, scroll lock. */

let activeTrap = null;
let lastFocused = null;

function lockScroll() {
  document.body.style.overflow = "hidden";
}
function unlockScroll() {
  document.body.style.overflow = "";
}

function focusable(panel) {
  return panel.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
}

function open(modal) {
  if (!modal) return;
  lastFocused = document.activeElement;
  modal.setAttribute("aria-hidden", "false");
  lockScroll();
  const panel = modal.querySelector(".docs-modal__panel");
  const first = panel ? focusable(panel)[0] : null;
  if (first) first.focus();
  activeTrap = (e) => {
    if (e.key === "Escape") {
      close(modal);
      return;
    }
    if (e.key !== "Tab" || !panel) return;
    const items = focusable(panel);
    if (!items.length) return;
    const f = items[0];
    const l = items[items.length - 1];
    if (e.shiftKey && document.activeElement === f) {
      l.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === l) {
      f.focus();
      e.preventDefault();
    }
  };
  document.addEventListener("keydown", activeTrap);
}

function close(modal) {
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
  unlockScroll();
  if (activeTrap) {
    document.removeEventListener("keydown", activeTrap);
    activeTrap = null;
  }
  if (lastFocused && typeof lastFocused.focus === "function") {
    lastFocused.focus();
  }
}

export function mountModal(root = document) {
  const modals = root.querySelectorAll(".docs-modal");
  modals.forEach((modal) => {
    const backdrop = modal.querySelector(".docs-modal__backdrop");
    if (backdrop) backdrop.addEventListener("click", () => close(modal));
    const closeBtn = modal.querySelector(".docs-modal__close, [data-modal-close]");
    if (closeBtn) closeBtn.addEventListener("click", () => close(modal));
  });
  window.docsModal = {
    open: (idOrEl) => {
      const m = typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;
      open(m);
    },
    close: (idOrEl) => {
      const m = typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;
      close(m);
    },
  };
}
