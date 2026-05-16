/* ui-kit/components/toast.js — transient toast notifications.

   Canonical API:
     import { showToast } from "./toast.js";
     const t = showToast({ message, variant?, icon?, duration? });
     t?.dismiss();   // optional, e.g. when an upload completes

   Showcase / non-module HTML may also use the documented facade
   `window.docsToast.show(...)` (deliberate exception to the no-globals rule;
   kept narrow and read-only). Lazily creates a fixed bottom-right stack with
   aria-live="polite". */

const ICONS = {
  sun:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  moon:
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  info:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/>' +
    '<path d="M12 16v-5M12 8h.01"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M5 13l4 4L19 7"/></svg>',
  warn:
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 3l10 18H2L12 3zM12 10v5M12 18h.01"/></svg>',
  danger:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/>' +
    '<path d="M15 9l-6 6M9 9l6 6"/></svg>',
};

const VARIANTS = new Set(["neutral", "success", "warn", "danger"]);
const DEFAULT_DURATION = 2400;
const EXIT_DURATION = 260;

let stackEl = null;

function ensureStack() {
  if (stackEl && document.body.contains(stackEl)) return stackEl;
  stackEl = document.createElement("div");
  stackEl.className = "docs-toast-stack";
  stackEl.setAttribute("role", "region");
  stackEl.setAttribute("aria-live", "polite");
  stackEl.setAttribute("aria-label", "Notifications");
  document.body.appendChild(stackEl);
  return stackEl;
}

function show(opts = {}) {
  const { message, variant = "neutral", icon, duration = DEFAULT_DURATION } = opts;
  if (!message) return null;
  const stack = ensureStack();

  const safeVariant = VARIANTS.has(variant) ? variant : "neutral";
  const toast = document.createElement("div");
  toast.className = `docs-toast docs-toast--${safeVariant}`;
  toast.setAttribute("role", "status");

  const iconSvg = icon && ICONS[icon] ? ICONS[icon] : "";
  const iconHtml = iconSvg ? `<span class="docs-toast__icon">${iconSvg}</span>` : "";
  toast.innerHTML =
    iconHtml +
    '<span class="docs-toast__msg"></span>' +
    '<button class="docs-toast__close" type="button" aria-label="Dismiss">×</button>';
  toast.querySelector(".docs-toast__msg").textContent = message;

  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-entering"));

  // Lifecycle timers (not DOM polling):
  //   • EXIT_DURATION timer waits for the leave-animation to finish, then
  //     removes the node from the DOM.
  //   • exitTimer auto-dismisses the toast after `duration` ms.
  let exitTimer = null;
  const dismiss = () => {
    if (exitTimer) {
      clearTimeout(exitTimer);
      exitTimer = null;
    }
    if (!toast.isConnected) return;
    toast.classList.remove("is-entering");
    toast.classList.add("is-leaving");
    window.setTimeout(() => {
      if (toast.isConnected) toast.remove();
    }, EXIT_DURATION);
  };

  toast.querySelector(".docs-toast__close").addEventListener("click", dismiss);
  if (duration > 0) {
    exitTimer = window.setTimeout(dismiss, duration);
  }

  return { dismiss, el: toast };
}

export function showToast(opts) {
  return show(opts);
}

export function mountToast() {
  if (typeof window === "undefined") return;
  if (!window.docsToast) {
    // Showcase / non-module HTML facade. Documented public API.
    window.docsToast = { show };
  }
}
