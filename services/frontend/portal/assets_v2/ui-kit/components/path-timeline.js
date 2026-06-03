/* ui-kit/components/path-timeline.js — picker-tile → modal wiring.

   The cold-start page renders each curated reading path inside a
   `.docs-modal.docs-modal--path` so the inline flow stays clean. This
   mount wires three triggers:

     1. Initial paint — if the URL has a hash that resolves to a
        `.docs-modal--path`, open that modal so deep links land you
        inside the right path.
     2. hashchange — same logic, covers back/forward navigation.
     3. Click on any `a[href^="#"]` whose target is a `.docs-modal--path`
        — intercept the default jump, open the modal, sync the hash via
        replaceState (so the address bar still works as a deep link).

   Idempotent and safe on pages that have no path modals. */

import { openModal } from "./modal.js";

export function mountPathTimeline(root = document) {
  const modals = root.querySelectorAll(".docs-modal--path");
  if (modals.length === 0) return;

  const resolveModal = (hash) => {
    if (!hash || hash === "#" || hash.length < 2) return null;
    let el;
    try {
      el = root.querySelector(hash);
    } catch {
      return null;
    }
    if (!el || !el.classList || !el.classList.contains("docs-modal--path")) return null;
    return el;
  };

  const tryOpen = (hash) => {
    const modal = resolveModal(hash);
    if (modal) openModal(modal);
  };

  tryOpen(window.location.hash);

  window.addEventListener("hashchange", () => tryOpen(window.location.hash));

  root.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const hash = link.getAttribute("href");
    const modal = resolveModal(hash);
    if (!modal) return;
    e.preventDefault();
    openModal(modal);
    if (window.location.hash !== hash) {
      history.replaceState(null, "", hash);
    }
  });
}
