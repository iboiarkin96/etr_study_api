/* ui-kit/components/design-canvas-card.js
   Renders the "design canvas" hero — an aurora stage with drifting orbs, big
   stencil display type, a 3D-tilted frosted-glass component card with a
   holographic conic sweep and cursor-lit spotlight, plus floating token chips.
   Markup is built in JS so any host with `data-component="design-canvas-card"`
   gets the full structure without copy-pasting boilerplate.

   Mouse parallax: pointer position on the host is normalized to [0..1] on
   each axis and written to CSS custom props `--dcc-mx` / `--dcc-my`. The CSS
   drives all 3D rotations, layer parallax, and the cursor highlight from those
   two props, so this file only does the math. */

const MARKUP = `
  <div class="dcc__sky" aria-hidden="true">
    <span class="dcc__orb dcc__orb--blue"></span>
    <span class="dcc__orb dcc__orb--pink"></span>
    <span class="dcc__orb dcc__orb--cyan"></span>
    <span class="dcc__orb dcc__orb--gold"></span>
  </div>

  <div class="dcc__grid" aria-hidden="true"></div>
  <div class="dcc__noise" aria-hidden="true"></div>

  <div class="dcc__bigtype" aria-hidden="true">
    <span class="dcc__bigtype-row">UI</span>
    <span class="dcc__bigtype-row">KIT</span>
  </div>

  <span class="dcc__hud" aria-hidden="true">design / canvas · live</span>

  <div class="dcc__stage">
    <article class="dcc__card" aria-label="Component preview">
      <span class="dcc__holo" aria-hidden="true"></span>
      <span class="dcc__cursor" aria-hidden="true"></span>

      <header class="dcc__card-head">
        <span class="dcc__card-status">
          <span class="dcc__card-dot" aria-hidden="true"></span>
          specimen
        </span>
        <span class="dcc__card-file">etr.tokens.css</span>
      </header>

      <div class="dcc__specimen">
        <div class="dcc__palette" aria-hidden="true">
          <div class="dcc__palette-bar">
            <span class="dcc__palette-swatch dcc__palette-swatch--1"></span>
            <span class="dcc__palette-swatch dcc__palette-swatch--2"></span>
            <span class="dcc__palette-swatch dcc__palette-swatch--3"></span>
            <span class="dcc__palette-swatch dcc__palette-swatch--4"></span>
            <span class="dcc__palette-swatch dcc__palette-swatch--5"></span>
          </div>
          <div class="dcc__palette-labels">
            <span>100</span>
            <span>300</span>
            <span>500</span>
            <span>700</span>
            <span>900</span>
          </div>
        </div>

        <div class="dcc__type" aria-hidden="true">
          <span class="dcc__type-sample">Aa</span>
          <span class="dcc__type-meta">
            <strong>Display · 40 / 32</strong>
            <span>weight 800 · −0.045em</span>
          </span>
        </div>
      </div>

      <div class="dcc__rule" aria-hidden="true"></div>

      <div class="dcc__cta-row">
        <span class="dcc__cta" aria-hidden="true">
          Inspect
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2.5 6h7M6 2.5L9.5 6 6 9.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="dcc__metrics" aria-hidden="true">
          <span>r12</span>
          <span>·</span>
          <span>p16</span>
          <span>·</span>
          <span>shadow xl</span>
        </span>
      </div>
    </article>
  </div>

  <span class="dcc__token dcc__token--1" aria-hidden="true">
    <span class="dcc__token-dot"></span>
    accent / 500
    <span class="dcc__token-tag">#3B82F6</span>
  </span>
  <span class="dcc__token dcc__token--2" aria-hidden="true">
    <span class="dcc__token-dot"></span>
    radius / lg
    <span class="dcc__token-tag">12px</span>
  </span>
  <span class="dcc__token dcc__token--3" aria-hidden="true">
    <span class="dcc__token-dot"></span>
    font / display
    <span class="dcc__token-tag">600</span>
  </span>
  <span class="dcc__token dcc__token--4" aria-hidden="true">
    <span class="dcc__token-dot"></span>
    shadow / xl
    <span class="dcc__token-tag">28 56</span>
  </span>

  <div class="dcc__foot" aria-hidden="true">
    <span>frame · 460 × 368</span>
    <span><span class="dcc__foot-val">120</span>fps</span>
  </div>
`;

function build(host) {
  host.classList.add("dcc");
  host.innerHTML = MARKUP;
}

function wireParallax(host) {
  let frame = 0;
  let pendingX = 0.5;
  let pendingY = 0.5;

  function flush() {
    frame = 0;
    host.style.setProperty("--dcc-mx", pendingX.toFixed(3));
    host.style.setProperty("--dcc-my", pendingY.toFixed(3));
  }

  function onMove(event) {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const mx = (event.clientX - rect.left) / rect.width;
    const my = (event.clientY - rect.top) / rect.height;
    pendingX = Math.min(1, Math.max(0, mx));
    pendingY = Math.min(1, Math.max(0, my));
    if (!frame) frame = window.requestAnimationFrame(flush);
  }

  function reset() {
    pendingX = 0.5;
    pendingY = 0.5;
    if (!frame) frame = window.requestAnimationFrame(flush);
  }

  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerleave", reset);
  host.addEventListener("pointercancel", reset);
}

function reveal(host) {
  window.requestAnimationFrame(() => host.classList.add("is-visible"));
}

export function mountDesignCanvasCard() {
  const hosts = document.querySelectorAll('[data-component="design-canvas-card"]');
  if (!hosts.length) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  hosts.forEach((host) => {
    build(host);

    if (!reduced) wireParallax(host);

    if (reduced || !("IntersectionObserver" in window)) {
      host.classList.add("is-visible");
      host.removeAttribute("data-component");
      return;
    }

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          obs.disconnect();
          reveal(host);
        }
      });
    }, { threshold: 0.3 });
    obs.observe(host);

    host.removeAttribute("data-component");
  });
}
