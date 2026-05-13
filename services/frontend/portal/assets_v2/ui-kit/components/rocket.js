/* ui-kit/components/rocket.js
   On landing pages  → loads the home WebGL flowfield into a [data-component="rocket"] slot.
   On docs-shell pages → mounts a scroll-to-top FAB (no WebGL dependency needed). */

const WEBGL_URL = "/services/frontend/portal/assets/home-webgl.js";

function svgFallback(slot) {
  slot.innerHTML =
    "<svg class='docs-rocket__fallback' viewBox='0 0 220 220' aria-hidden='true' xmlns='http://www.w3.org/2000/svg'>" +
    "<defs><radialGradient id='r-g' cx='50%' cy='40%' r='60%'><stop offset='0%' stop-color='var(--accent)' stop-opacity='0.5'/><stop offset='100%' stop-color='var(--accent)' stop-opacity='0'/></radialGradient></defs>" +
    "<circle cx='110' cy='110' r='90' fill='url(#r-g)'/>" +
    "<path d='M110 30 c20 30 30 60 30 90 c0 22 -14 40 -30 50 c-16 -10 -30 -28 -30 -50 c0 -30 10 -60 30 -90 z' fill='currentColor' fill-opacity='0.85'/>" +
    "<circle cx='110' cy='100' r='12' fill='var(--card)'/>" +
    "</svg>";
}

function loadWebgl() {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src='${WEBGL_URL}']`)) return resolve();
    const s = document.createElement("script");
    s.src = WEBGL_URL;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function mountScrollTop() {
  const reduced =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "docs-scroll-top";
  btn.setAttribute("aria-label", "Back to top");
  btn.setAttribute("data-visible", "false");
  btn.innerHTML =
    "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' aria-hidden='true'>" +
    "<path d='M12 19V5M5 12l7-7 7 7' stroke-linecap='round' stroke-linejoin='round'/>" +
    "</svg>";

  document.body.appendChild(btn);

  const update = () => {
    btn.setAttribute("data-visible", window.scrollY > 300 ? "true" : "false");
  };
  window.addEventListener("scroll", update, { passive: true });
  update();

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
  });
}

// Only the top-level portal landing page uses the rocket as a hero visual.
// Section landings and all doc pages get a scroll-to-top button instead.
const LANDING_TYPES = new Set(["landing"]);

export async function mountRocket(root = document) {
  const slots = root.querySelectorAll('[data-component="rocket"]');
  if (!slots.length) return;

  const pageType = document.body.getAttribute("data-page-type") || "";
  const isLanding = LANDING_TYPES.has(pageType);
  const isDocsShell = document.body.classList.contains("docs-shell");

  if (isDocsShell && !isLanding) {
    mountScrollTop();
    return;
  }

  // Landing pages: leave the rocket slot as-is (emoji / decorative content).
  if (isLanding) return;

  // Landing page: load WebGL animation into each slot
  const reduced =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  for (const slot of slots) {
    slot.classList.add("docs-rocket");
    if (reduced) {
      svgFallback(slot);
      continue;
    }
    if (!slot.querySelector("canvas")) {
      const c = document.createElement("canvas");
      c.className = "docs-rocket__canvas";
      slot.appendChild(c);
    }
    try {
      await loadWebgl();
    } catch (_) {
      svgFallback(slot);
    }
  }
}
