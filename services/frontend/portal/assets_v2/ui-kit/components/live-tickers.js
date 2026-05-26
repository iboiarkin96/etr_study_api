/* ui-kit/components/live-tickers.js
   Count-up animation for `.docs-ticker__val[data-target]`.
   Driven by IntersectionObserver — fires once per ticker. */

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function animate(el, target, duration) {
  const start = performance.now();
  // Pull out the suffix (if any) so we can re-append after each number update.
  const suffix = el.querySelector(".docs-ticker__suffix");
  if (suffix) suffix.remove();

  // Numeric text node we will mutate every frame — cheap, no allocs.
  el.textContent = "0";
  const textNode = el.firstChild;
  if (suffix) el.appendChild(suffix);

  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = easeOutCubic(t);
    textNode.nodeValue = String(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

export function mountLiveTickers() {
  const nodes = document.querySelectorAll(".docs-ticker__val[data-target]");
  if (!nodes.length) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  nodes.forEach((el) => {
    const target = parseInt(el.getAttribute("data-target"), 10);
    if (!Number.isFinite(target)) return;

    if (reduced) {
      const suffix = el.querySelector(".docs-ticker__suffix");
      if (suffix) suffix.remove();
      el.textContent = String(target);
      if (suffix) el.appendChild(suffix);
      return;
    }

    if ("IntersectionObserver" in window) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            obs.disconnect();
            animate(el, target, 1400);
          }
        });
      }, { threshold: 0.4 });
      obs.observe(el);
    } else {
      animate(el, target, 1400);
    }
  });
}
