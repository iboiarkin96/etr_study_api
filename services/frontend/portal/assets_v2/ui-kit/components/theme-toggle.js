/* ui-kit/components/theme-toggle.js — toggles html[data-theme] between light/dark.
   The no-flash bootstrap runs in _page-base.html <head>; this only wires the button. */

const STORAGE_KEY = "docs-theme-preference";

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

export function mountThemeToggle(root = document) {
  const buttons = root.querySelectorAll(
    '[data-component="theme-toggle"], .docs-theme-toggle'
  );
  buttons.forEach((btn) => {
    if (btn.dataset.themeToggleBound === "true") return;
    btn.dataset.themeToggleBound = "true";
    btn.classList.add("docs-theme-toggle");
    btn.setAttribute("aria-label", "Toggle theme");
    if (!btn.innerHTML.trim()) {
      btn.innerHTML =
        "<svg class='docs-theme-toggle__icon docs-theme-toggle__icon--sun' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' aria-hidden='true'><circle cx='12' cy='12' r='4'/><path d='M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41' stroke-linecap='round'/></svg>" +
        "<svg class='docs-theme-toggle__icon docs-theme-toggle__icon--moon' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' aria-hidden='true'><path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' stroke-linejoin='round'/></svg>";
    }
    btn.addEventListener("click", () => {
      setTheme(getTheme() === "dark" ? "light" : "dark");
    });
  });
}
