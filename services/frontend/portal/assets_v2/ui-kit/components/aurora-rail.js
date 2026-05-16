/* ui-kit/components/aurora-rail.js — pre-footer atmosphere zone.

   The visual is implemented entirely in aurora-rail.css (a direct port
   of the legacy docs.css body::before fog + body::after dot-wave
   system). This module just injects the markup hooks the CSS expects
   and updates --docs-footer-scroll-strength as the user scrolls.

   Mount API
   ─────────
     mountAuroraRail(root = document)
       • Idempotent. Honours <html data-aurora="off">.
       • Creates <section class="aurora-rail">
           <div class="aurora-rail__fog"></div>
           <div class="aurora-rail__dots"></div>
         </section>
         and inserts it directly before .site-footer (or appends to
         .docs-shell when the footer hasn't mounted yet — the footer
         mounts next and lands below).
       • Wires a passive scroll listener that mirrors the v1
         initDocsFooterAtmosphereScroll() helper from docs-nav.js:
         scales --docs-footer-scroll-strength from 0.18 at the top of
         the document to 1.0 at the bottom, so the rail feels subtler
         while the user is reading and blooms as they reach the foot.
*/

const SCROLL_VAR = "--docs-footer-scroll-strength";
const SCROLL_MIN = 0.18;

/* ─── DOM scaffolding ───────────────────────────────────────────── */

function buildRailElement() {
  const rail = document.createElement("section");
  rail.className = "aurora-rail";
  rail.setAttribute("data-component", "aurora-rail");
  rail.setAttribute("aria-hidden", "true");

  const fog = document.createElement("div");
  fog.className = "aurora-rail__fog";
  rail.appendChild(fog);

  const dots = document.createElement("div");
  dots.className = "aurora-rail__dots";
  rail.appendChild(dots);

  return rail;
}

function placeRail(rail) {
  const footer = document.querySelector(
    ".site-footer, [data-component=\"site-footer\"]"
  );
  if (footer && footer.parentNode) {
    footer.parentNode.insertBefore(rail, footer);
    return;
  }
  const shell = document.querySelector(".docs-shell");
  if (shell) { shell.appendChild(rail); return; }
  const main = document.querySelector("main");
  if (main && main.parentNode) {
    main.parentNode.insertBefore(rail, main.nextSibling);
    return;
  }
  document.body.appendChild(rail);
}

/* ─── Scroll strength driver ────────────────────────────────────── */

/* Mirrors v1's initDocsFooterAtmosphereScroll(): scale the rail's
   atmosphere by scroll position. Subtle near the top, full strength
   when the user has reached the footer. */
function bindScrollStrength() {
  const root = document.documentElement;
  let ticking = false;

  function compute() {
    const scrollable = root.scrollHeight - window.innerHeight;
    if (scrollable <= 4) return 1;
    const t = Math.min(1, Math.max(0, window.scrollY / scrollable));
    return SCROLL_MIN + (1 - SCROLL_MIN) * t;
  }

  function apply() {
    root.style.setProperty(SCROLL_VAR, compute().toFixed(4));
    ticking = false;
  }

  function onScrollOrResize() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(apply);
  }

  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize, { passive: true });
  apply();
}

/* ─── Public mount ───────────────────────────────────────────────── */

export function mountAuroraRail(root = document) {
  if (typeof window === "undefined") return;
  const html = document.documentElement;
  if (html && html.dataset.aurora === "off") return;

  const scope = root.querySelector ? root : document;
  if (scope.querySelector("[data-component=\"aurora-rail\"]")) return;

  const rail = buildRailElement();
  placeRail(rail);
  bindScrollStrength();
}
