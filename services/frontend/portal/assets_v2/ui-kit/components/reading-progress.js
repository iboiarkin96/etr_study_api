/* ui-kit/components/reading-progress.js — auto-injects a fixed scroll
   progress bar at the top of the viewport. Ported 1:1 from the legacy
   services/frontend/portal/assets/docs-nav.js (initReadingProgress).

   Behaviour:
     - On mount, creates a single `.docs-reading-progress` element and
       appends it to <body>.
     - Recalculates the fill ratio on scroll/resize, RAF-throttled.
     - Hides itself (opacity 0) when the page is shorter than the viewport
       so it doesn't show a useless empty bar on landing pages. */

let mounted = false;

export function mountReadingProgress(root = document) {
  if (mounted) return;
  if (!root || !root.body) return;
  if (root.querySelector(".docs-reading-progress")) {
    mounted = true;
    return;
  }

  const docEl = root.documentElement;
  const bar = document.createElement("div");
  bar.className = "docs-reading-progress is-hidden";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", "Page reading progress");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("aria-valuenow", "0");

  const fill = document.createElement("span");
  fill.className = "docs-reading-progress__fill";
  fill.setAttribute("aria-hidden", "true");
  bar.appendChild(fill);
  root.body.appendChild(bar);

  let ticking = false;

  function update() {
    const maxScroll = Math.max(0, docEl.scrollHeight - window.innerHeight);
    if (maxScroll <= 8) {
      bar.classList.add("is-hidden");
      fill.style.transform = "scaleX(0)";
      bar.setAttribute("aria-valuenow", "0");
      return;
    }

    bar.classList.remove("is-hidden");
    const scrollTop = Math.max(0, window.scrollY || docEl.scrollTop || 0);
    const ratio = Math.min(1, Math.max(0, scrollTop / maxScroll));
    fill.style.transform = `scaleX(${ratio})`;
    bar.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
  }

  function scheduleUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      update();
    });
  }

  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate, { passive: true });
  scheduleUpdate();

  mounted = true;
}
