/* ui-kit/components/modal.js — generic modal controller.

   Canonical API:
     import { openModal, closeModal } from "./modal.js";
     openModal(elOrId);    // accepts HTMLElement or id string
     closeModal(elOrId);

   Showcase / non-module HTML consumers may also use the documented
   `window.docsModal = { open, close }` facade (deliberate exception to the
   no-globals rule; kept narrow and read-only). Focus trap, Esc, backdrop,
   scroll lock all handled internally. */

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

function resolve(idOrEl) {
  return typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;
}

export function openModal(idOrEl) {
  open(resolve(idOrEl));
}

export function closeModal(idOrEl) {
  close(resolve(idOrEl));
}

export function mountModal(root = document) {
  const modals = root.querySelectorAll(".docs-modal");
  modals.forEach((modal) => {
    const backdrop = modal.querySelector(".docs-modal__backdrop");
    if (backdrop) backdrop.addEventListener("click", () => close(modal));
    // `querySelectorAll` (not `querySelector`) — a modal may carry multiple
    // close affordances (header ×, footer "Cancel", body anchors). Using
    // the singular form binds only the first match in source order, which
    // — if the backdrop also has `[data-modal-close]` — silently drops the
    // header × button. Bind every match.
    modal
      .querySelectorAll(".docs-modal__close, .docs-close-btn[data-modal-close], [data-modal-close]")
      .forEach((btn) => {
        if (btn === backdrop) return;
        btn.addEventListener("click", () => close(modal));
      });
  });
  // Showcase / non-module HTML facade. Documented public API.
  window.docsModal = { open: openModal, close: closeModal };
}
