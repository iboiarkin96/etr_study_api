/* ui-kit/components/v3/studio-reading-progress.js — fills a 2px bar based
   on how far the target <article> has been scrolled past. Idempotent.

   Markup contract:
     <div class="studio-reading-progress"
          data-component="studio-reading-progress"
          data-target="#article-main"
          role="progressbar"
          aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>

   Behaviour:
   - Uses a single window scroll listener (rAF-throttled) per host.
   - Sets --progress (0..1) on the host element + aria-valuenow.
   - Reduced-motion: still updates value, CSS gates the transition. */

const BOUND = "data-reading-progress-bound";

function clamp01(n) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function calcProgress(target) {
  const rect = target.getBoundingClientRect();
  const viewportH = window.innerHeight || document.documentElement.clientHeight;
  const total = rect.height - viewportH;
  if (total <= 0) {
    return rect.bottom <= viewportH ? 1 : 0;
  }
  const scrolled = -rect.top;
  return clamp01(scrolled / total);
}

export function mountStudioReadingProgress(root = document) {
  const hosts = root.querySelectorAll(
    '[data-component="studio-reading-progress"]:not([' + BOUND + '])'
  );
  if (!hosts.length) return;

  hosts.forEach((host) => {
    const selector = host.getAttribute("data-target");
    if (!selector) return;
    const target = document.querySelector(selector);
    if (!target) return;

    host.setAttribute(BOUND, "true");

    let pending = false;

    const update = () => {
      pending = false;
      const p = calcProgress(target);
      host.style.setProperty("--progress", p.toFixed(3));
      host.setAttribute("aria-valuenow", Math.round(p * 100));
    };

    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => mountStudioReadingProgress(),
      { once: true }
    );
  } else {
    mountStudioReadingProgress();
  }
}
