/* ui-kit/components/hotkeys.js — global keyboard shortcuts for docs.
   Implements the contract documented in
     services/portal/ui-kit/pages/foundations/hotkeys.html

   Three groups, no surprises:
     /, ⌘+K              focus search
     ?, ⌘+/              open cheat-sheet
     Esc                 close overlay / leave reading mode
     g h / g s / g t     chord nav (home, sidebar, toc)
     t                   toggle theme
     [ / ]               toggle sidebar / toc collapse
     z                   toggle reading mode

   Single-key shortcuts never fire while an input is focused. The chord
   leader (`g`) buffers for 1200 ms. Bindings are idempotent — calling
   mountHotkeys() twice is a no-op. */

const CHORD_TIMEOUT_MS = 1200;
const READING_MODE_ATTR = "data-reading-mode";

let mounted = false;
let chordArmed = false;
let chordTimer = null;

function isEditableTarget(t) {
  if (!t) return false;
  if (t.isContentEditable) return true;
  const tag = (t.tagName || "").toLowerCase();
  if (tag === "input") {
    const type = (t.getAttribute("type") || "text").toLowerCase();
    // Allow shortcuts past non-text inputs (checkbox, radio, button-like).
    return ["text", "search", "email", "url", "tel", "password", "number"].includes(type);
  }
  return tag === "textarea" || tag === "select";
}

function isPlainKey(e) {
  return !e.metaKey && !e.ctrlKey && !e.altKey;
}

function armChord() {
  chordArmed = true;
  if (chordTimer) clearTimeout(chordTimer);
  chordTimer = setTimeout(() => {
    chordArmed = false;
    chordTimer = null;
  }, CHORD_TIMEOUT_MS);
}

function disarmChord() {
  chordArmed = false;
  if (chordTimer) {
    clearTimeout(chordTimer);
    chordTimer = null;
  }
}

function focusSearch() {
  const input = document.querySelector(".docs-search__input");
  if (input) {
    input.focus();
    input.select?.();
    return true;
  }
  return false;
}

function toggleTheme() {
  const btn = document.querySelector(".docs-theme-toggle");
  if (btn) {
    btn.click();
    return true;
  }
  return false;
}

function toggleSidebar() {
  const btn = document.querySelector(".docs-sidebar:not(.docs-drawer .docs-sidebar) .docs-sidebar__collapse-toggle")
    || document.querySelector(".docs-sidebar__collapse-toggle");
  if (btn) {
    btn.click();
    return true;
  }
  return false;
}

function toggleToc() {
  const btn = document.querySelector("aside.docs-toc .docs-toc__toggle");
  if (btn) {
    btn.click();
    return true;
  }
  return false;
}

function toggleReadingMode() {
  const body = document.body;
  const next = body.getAttribute(READING_MODE_ATTR) === "true" ? null : "true";
  if (next) body.setAttribute(READING_MODE_ATTR, next);
  else body.removeAttribute(READING_MODE_ATTR);
  return true;
}

function goHome() {
  const brand = document.querySelector(".topbar__brand")
    || document.querySelector(".docs-sidebar__wordmark");
  if (brand && brand.getAttribute("href")) {
    window.location.href = brand.getAttribute("href");
    return true;
  }
  window.location.href = "/";
  return true;
}

function focusSidebar() {
  // On mobile, the shell has a drawer trigger — open the drawer instead.
  const drawerTrigger = document.querySelector("[data-drawer-trigger]");
  if (drawerTrigger && drawerTrigger.offsetParent !== null) {
    drawerTrigger.click();
    // After the drawer opens, drawer.js focuses the first focusable item.
    return true;
  }
  const link = document.querySelector(".docs-shell > .docs-sidebar .docs-sidebar__link")
    || document.querySelector(".docs-sidebar__link");
  if (link) {
    link.focus();
    return true;
  }
  return false;
}

function focusToc() {
  const link = document.querySelector("aside.docs-toc .docs-toc__link");
  if (link) {
    link.focus();
    return true;
  }
  // Fallback: open the FAB on small screens.
  const fab = document.querySelector("[data-component='toc-fab']");
  if (fab) {
    fab.click();
    return true;
  }
  return false;
}

function closeOpenOverlays() {
  let acted = false;
  // Drawers: aria-hidden=false means open.
  const drawer = document.querySelector(".docs-drawer[aria-hidden='false']");
  if (drawer) {
    const closeBtn = drawer.querySelector("[data-drawer-close]");
    if (closeBtn) closeBtn.click();
    else drawer.setAttribute("aria-hidden", "true");
    acted = true;
  }
  // Modals.
  const modal = document.querySelector(".docs-modal[aria-hidden='false']");
  if (modal && window.docsModal && typeof window.docsModal.close === "function") {
    window.docsModal.close(modal);
    acted = true;
  }
  // TOC FAB panel.
  const fabPanel = document.querySelector(".docs-toc-fab__panel[aria-hidden='false']");
  if (fabPanel) {
    const fab = document.querySelector("[data-component='toc-fab']");
    if (fab) fab.click();
    acted = true;
  }
  // Search panel.
  const searchPanel = document.querySelector(".docs-search__panel[aria-hidden='false']");
  if (searchPanel) {
    const input = document.querySelector(".docs-search__input");
    if (input) {
      input.value = "";
      input.blur();
    }
    acted = true;
  }
  // Reading mode acts as a "soft" overlay — Esc exits it too if nothing else.
  if (!acted && document.body.getAttribute(READING_MODE_ATTR) === "true") {
    document.body.removeAttribute(READING_MODE_ATTR);
    acted = true;
  }
  return acted;
}

function ensureCheatModal() {
  let modal = document.getElementById("docs-hotkeys-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "docs-hotkeys-modal";
  modal.className = "docs-modal docs-hotkeys-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "docs-hotkeys-modal-title");

  modal.innerHTML = `
    <div class="docs-modal__backdrop"></div>
    <div class="docs-modal__panel docs-hotkeys-modal__panel" role="document">
      <header class="docs-hotkeys-modal__head">
        <h2 id="docs-hotkeys-modal-title" class="docs-hotkeys-modal__title">Keyboard shortcuts</h2>
        <button type="button" class="docs-modal__close docs-hotkeys-modal__close" aria-label="Close shortcuts">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/>
          </svg>
        </button>
      </header>
      <div class="docs-hotkeys-modal__body">
        <section class="docs-hotkeys-modal__group">
          <h3 class="docs-hotkeys-modal__group-title">Navigation</h3>
          <ul class="docs-hotkeys-modal__list">
            <li><span class="docs-hotkeys-modal__keys"><kbd>/</kbd></span><span class="docs-hotkeys-modal__action">Focus search</span></li>
            <li><span class="docs-hotkeys-modal__keys"><kbd>⌘</kbd><span class="docs-hotkeys-modal__sep">+</span><kbd>K</kbd></span><span class="docs-hotkeys-modal__action">Focus search</span></li>
            <li><span class="docs-hotkeys-modal__keys"><kbd>g</kbd><span class="docs-hotkeys-modal__sep">→</span><kbd>h</kbd></span><span class="docs-hotkeys-modal__action">Go to portal home</span></li>
            <li><span class="docs-hotkeys-modal__keys"><kbd>g</kbd><span class="docs-hotkeys-modal__sep">→</span><kbd>s</kbd></span><span class="docs-hotkeys-modal__action">Focus sidebar (opens drawer on mobile)</span></li>
            <li><span class="docs-hotkeys-modal__keys"><kbd>g</kbd><span class="docs-hotkeys-modal__sep">→</span><kbd>t</kbd></span><span class="docs-hotkeys-modal__action">Focus TOC</span></li>
            <li><span class="docs-hotkeys-modal__keys"><kbd>Esc</kbd></span><span class="docs-hotkeys-modal__action">Close overlay / leave reading mode</span></li>
          </ul>
        </section>
        <section class="docs-hotkeys-modal__group">
          <h3 class="docs-hotkeys-modal__group-title">View &amp; theme</h3>
          <ul class="docs-hotkeys-modal__list">
            <li><span class="docs-hotkeys-modal__keys"><kbd>t</kbd></span><span class="docs-hotkeys-modal__action">Toggle theme</span></li>
            <li><span class="docs-hotkeys-modal__keys"><kbd>[</kbd></span><span class="docs-hotkeys-modal__action">Collapse / expand sidebar</span></li>
            <li><span class="docs-hotkeys-modal__keys"><kbd>]</kbd></span><span class="docs-hotkeys-modal__action">Collapse / expand TOC</span></li>
            <li><span class="docs-hotkeys-modal__keys"><kbd>z</kbd></span><span class="docs-hotkeys-modal__action">Toggle reading mode</span></li>
          </ul>
        </section>
        <section class="docs-hotkeys-modal__group">
          <h3 class="docs-hotkeys-modal__group-title">Help</h3>
          <ul class="docs-hotkeys-modal__list">
            <li><span class="docs-hotkeys-modal__keys"><kbd>?</kbd></span><span class="docs-hotkeys-modal__action">Open this cheat-sheet</span></li>
            <li><span class="docs-hotkeys-modal__keys"><kbd>⌘</kbd><span class="docs-hotkeys-modal__sep">+</span><kbd>/</kbd></span><span class="docs-hotkeys-modal__action">Open this cheat-sheet</span></li>
          </ul>
        </section>
      </div>
      <footer class="docs-hotkeys-modal__foot">
        Full contract: <a href="/services/portal/ui-kit/pages/foundations/hotkeys.html">Foundations · Hotkeys</a>
      </footer>
    </div>
  `;
  document.body.appendChild(modal);

  // Wire backdrop + close button (modal.js may have already mounted earlier
  // and missed this node — wire here too so it works lazily).
  const backdrop = modal.querySelector(".docs-modal__backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", () => {
      if (window.docsModal) window.docsModal.close(modal);
      else modal.setAttribute("aria-hidden", "true");
    });
  }
  const closeBtn = modal.querySelector(".docs-modal__close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (window.docsModal) window.docsModal.close(modal);
      else modal.setAttribute("aria-hidden", "true");
    });
  }
  return modal;
}

function openCheatSheet() {
  const modal = ensureCheatModal();
  if (window.docsModal && typeof window.docsModal.open === "function") {
    window.docsModal.open(modal);
  } else {
    modal.setAttribute("aria-hidden", "false");
  }
}

function handleKeydown(e) {
  // Esc is always allowed — overlays must close even from inside their own inputs.
  if (e.key === "Escape") {
    if (closeOpenOverlays()) e.preventDefault();
    return;
  }

  // Modifier combos work even with focus in an input where appropriate.
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
    if (e.key === "/" ) {
      e.preventDefault();
      openCheatSheet();
      return;
    }
    if (e.key.toLowerCase() === "k") {
      e.preventDefault();
      focusSearch();
      return;
    }
  }

  // Single-key shortcuts: skip when focus is in an editable field.
  if (isEditableTarget(e.target)) {
    // Chord leader was armed but user is typing — drop it.
    if (chordArmed) disarmChord();
    return;
  }
  if (!isPlainKey(e)) return;

  // Chord follower step.
  if (chordArmed) {
    const k = e.key.toLowerCase();
    disarmChord();
    if (k === "h") {
      e.preventDefault();
      goHome();
      return;
    }
    if (k === "s") {
      e.preventDefault();
      focusSidebar();
      return;
    }
    if (k === "t") {
      e.preventDefault();
      focusToc();
      return;
    }
    // Unknown follower: fall through and treat current key as fresh input.
  }

  switch (e.key) {
    case "/":
      e.preventDefault();
      focusSearch();
      return;
    case "?":
      e.preventDefault();
      openCheatSheet();
      return;
    case "t":
    case "T":
      e.preventDefault();
      toggleTheme();
      return;
    case "[":
      e.preventDefault();
      toggleSidebar();
      return;
    case "]":
      e.preventDefault();
      toggleToc();
      return;
    case "z":
    case "Z":
      e.preventDefault();
      toggleReadingMode();
      return;
    case "g":
    case "G":
      e.preventDefault();
      armChord();
      return;
    default:
      break;
  }
}

export function mountHotkeys() {
  if (mounted) return;
  mounted = true;
  document.addEventListener("keydown", handleKeydown);
}
