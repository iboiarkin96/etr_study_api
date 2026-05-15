/* ui-kit/components/theme-toggle.js — vertical-flashlight toggle.
   Ports the legacy DOCS_THEME_FLASHLIGHT_SVG from
   services/frontend/portal/assets/docs-nav.js into every
   [data-component="theme-toggle"] / .docs-theme-toggle button.
   Light = beam dim. Dark = beam lit. */

const STORAGE_KEY = "docs-theme-preference";

const FLASHLIGHT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
  <ellipse class="docs-theme-flashlight-beam" cx="12" cy="4.35" rx="5" ry="1.9" fill="currentColor" />
  <path fill="currentColor" d="M7.65 10.85c0-1.45 1.18-2.62 2.62-2.62h3.46c1.45 0 2.62 1.18 2.62 2.62v0.42c0 .38-.31.7-.7.7H8.35c-.38 0-.7-.31-.7-.7v-.42z" />
  <path fill="currentColor" opacity="0.9" d="M8.2 11.85h7.6v1.05c0 .34-.28.62-.62.62H8.82c-.34 0-.62-.28-.62-.62v-1.05z" />
  <rect x="9.1" y="13.35" width="5.8" height="8.35" rx="1.35" fill="currentColor" />
  <rect x="9.85" y="21.2" width="4.3" height="1.7" rx="0.5" fill="currentColor" opacity="0.88" />
</svg>`;

function getTheme() {
  return document.documentElement.getAttribute("data-theme") || "light";
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (_) {
    /* ignore */
  }
}

function syncPressed(btn) {
  btn.setAttribute("aria-pressed", getTheme() === "dark" ? "true" : "false");
}

export function mountThemeToggle(root = document) {
  const buttons = root.querySelectorAll(
    '[data-component="theme-toggle"], .docs-theme-toggle'
  );
  buttons.forEach((btn) => {
    if (btn.dataset.themeToggleBound === "true") return;
    btn.dataset.themeToggleBound = "true";
    btn.classList.add("docs-theme-toggle");
    if (!btn.hasAttribute("type")) btn.setAttribute("type", "button");
    btn.setAttribute("aria-label", "Toggle theme");

    if (btn.dataset.icon !== "custom") {
      btn.innerHTML = `<span class="docs-theme-toggle__icon">${FLASHLIGHT_SVG}</span>`;
    }
    syncPressed(btn);

    if (btn.dataset.demoOnly === "true") return;

    btn.addEventListener("click", () => {
      setTheme(getTheme() === "dark" ? "light" : "dark");
      syncPressed(btn);
    });
  });
}
