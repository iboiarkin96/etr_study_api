/* ui-kit/components/text-decrypt.js
   Two effects for a headline:
     mountTextDecrypt()   — glyph-scramble decrypt on every `[data-decrypt]`
     mountVariableWeight() — scroll-driven font-weight on `[data-variable-weight]`

   Usage:
     <h1 data-variable-weight>
       <span data-decrypt="Build, ship, and">Build, ship, and</span>
       <span data-decrypt="document fearlessly.">document fearlessly.</span>
     </h1>

   Each `[data-decrypt]` line can carry `data-decrypt-delay` (ms before start),
   `data-decrypt-duration` (per-char scramble window, default 580), and
   `data-decrypt-stagger` (ms between char starts, default 32). */

const SCRAMBLE_CHARS = "█▓▒░ABCDEFGHIJKLMNOPQRSTUVWXYZ#@%&*+=<>/_";

function randomGlyph() {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

function decryptElement(el, finalText, opts) {
  const duration = opts.duration || 580;
  const stagger = opts.stagger || 32;

  /* Pin element size to its FINAL-text rect before clearing — wider scramble
     glyphs (█▓▒░A-Z) would otherwise reflow the line every frame and force
     ResizeObservers (incl. the WebGL canvas) to flicker. `height` (not
     `min-height`) so the box truly can't grow taller; combined with the
     CSS `white-space: nowrap; overflow: hidden;` on `[data-decrypt]`. */
  const rect = el.getBoundingClientRect();
  if (rect.width > 0) {
    const display = getComputedStyle(el).display;
    if (display === "inline") el.style.display = "inline-block";
    el.style.minWidth = rect.width + "px";
    el.style.height = rect.height + "px";
  }

  el.textContent = "";
  el.setAttribute("aria-label", finalText);

  const chars = Array.from(finalText);
  const spans = chars.map((ch) => {
    const span = document.createElement("span");
    span.className = "docs-decrypt-char docs-decrypt-char--scrambling";
    span.textContent = ch === " " ? "\u00a0" : randomGlyph();
    el.appendChild(span);
    return span;
  });

  const start = performance.now();
  function frame(now) {
    const t = now - start;
    let allDone = true;
    spans.forEach((span, i) => {
      if (span.dataset.done === "1") return;
      const localStart = i * stagger;
      const localEnd = localStart + duration;
      if (t < localStart) {
        allDone = false;
        return;
      }
      if (t >= localEnd) {
        span.textContent = chars[i] === " " ? "\u00a0" : chars[i];
        span.classList.remove("docs-decrypt-char--scrambling");
        span.dataset.done = "1";
        return;
      }
      span.textContent = randomGlyph();
      allDone = false;
    });
    if (!allDone) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

export function mountTextDecrypt() {
  const nodes = document.querySelectorAll("[data-decrypt]");
  if (!nodes.length) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  nodes.forEach((el) => {
    const finalText = el.getAttribute("data-decrypt") || el.textContent.trim();
    if (!finalText) return;

    if (reduced) {
      el.textContent = finalText;
      return;
    }

    const delay = parseInt(el.getAttribute("data-decrypt-delay"), 10) || 0;
    const duration = parseInt(el.getAttribute("data-decrypt-duration"), 10) || 580;
    const stagger = parseInt(el.getAttribute("data-decrypt-stagger"), 10) || 32;

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      setTimeout(() => decryptElement(el, finalText, { duration, stagger }), delay);
    };

    // Decrypt fires once on first intersection.
    if ("IntersectionObserver" in window) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            obs.disconnect();
            start();
          }
        });
      }, { threshold: 0.3 });
      obs.observe(el);
    } else {
      start();
    }
  });
}

export function mountVariableWeight() {
  const nodes = document.querySelectorAll("[data-variable-weight]");
  if (!nodes.length) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  let rafId = 0;
  function update() {
    rafId = 0;
    const vh = window.innerHeight || 1;
    nodes.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const offset = Math.max(0, Math.min(1, 1 - rect.top / vh));
      // 500 (airy) → 820 (heavy) as the element scrolls past the viewport top.
      const wght = Math.round(500 + offset * 320);
      el.style.setProperty("--docs-h1-wght", String(wght));
    });
  }
  function schedule() {
    if (!rafId) rafId = requestAnimationFrame(update);
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  update();
}
