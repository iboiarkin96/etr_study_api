/* ui-kit/components/toc.js — desktop TOC: scroll-spy active heading + collapse toggle. */

const COLLAPSE_KEY = "docs-toc-collapsed";

function storedCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === "true"; } catch (_) { return false; }
}
function saveCollapsed(val) {
  try { localStorage.setItem(COLLAPSE_KEY, val ? "true" : "false"); } catch (_) {}
}

function wireCollapse(toc) {
  const title = toc.querySelector(".docs-toc__title");
  if (!title) return;

  const header = document.createElement("div");
  header.className = "docs-toc__header";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "docs-toc__toggle";
  toggle.setAttribute("aria-label", "Toggle table of contents");
  toggle.innerHTML =
    "<svg viewBox='0 0 12 12' aria-hidden='true'>" +
    "<path d='M2 4l4 4 4-4' fill='none' stroke='currentColor' stroke-width='1.5' " +
    "stroke-linecap='round' stroke-linejoin='round'/></svg>";

  if (storedCollapsed()) {
    toc.setAttribute("data-collapsed", "true");
    toggle.setAttribute("aria-expanded", "false");
  } else {
    toggle.setAttribute("aria-expanded", "true");
  }

  title.replaceWith(header);
  header.appendChild(title);
  header.appendChild(toggle);

  toggle.addEventListener("click", () => {
    const collapsed = toc.hasAttribute("data-collapsed");
    if (collapsed) {
      toc.removeAttribute("data-collapsed");
      toggle.setAttribute("aria-expanded", "true");
      saveCollapsed(false);
    } else {
      toc.setAttribute("data-collapsed", "true");
      toggle.setAttribute("aria-expanded", "false");
      saveCollapsed(true);
    }
  });
}

function wireScrollSpy(toc) {
  const main = document.querySelector("main");
  if (!main) return;

  const headings = Array.from(main.querySelectorAll("h2[id], h3[id]"));
  if (!headings.length) return;

  const linkFor = new Map();
  headings.forEach((h) => {
    const a = toc.querySelector(`.docs-toc__link[href="#${CSS.escape(h.id)}"]`);
    if (a) linkFor.set(h, a);
  });
  if (!linkFor.size) return;

  // Remove static --active set in HTML (we take over from here)
  toc.querySelectorAll(".docs-toc__item--active").forEach((el) => {
    el.classList.remove("docs-toc__item--active");
  });

  let active = null;

  function setActive(heading) {
    if (active === heading) return;
    if (active) {
      const prev = linkFor.get(active);
      prev?.closest(".docs-toc__item")?.classList.remove("docs-toc__item--active");
    }
    active = heading;
    if (heading) {
      const next = linkFor.get(heading);
      next?.closest(".docs-toc__item")?.classList.add("docs-toc__item--active");
    }
  }

  const visible = new Set();

  function recalc() {
    // Prefer topmost heading currently inside the top 35% of viewport
    const threshold = window.innerHeight * 0.35;
    for (const h of headings) {
      const top = h.getBoundingClientRect().top;
      if (top >= 0 && top < threshold) {
        setActive(h);
        return;
      }
    }
    // Nothing in zone — use the last heading that scrolled past the midpoint
    const mid = window.innerHeight / 2;
    let last = null;
    for (const h of headings) {
      if (h.getBoundingClientRect().top < mid) last = h;
    }
    if (last) setActive(last);
  }

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      });
      recalc();
    },
    { rootMargin: "0px 0px -65% 0px", threshold: 0 }
  );

  headings.forEach((h) => obs.observe(h));
}

export function mountToc(root = document) {
  const toc = root.querySelector("aside.docs-toc");
  if (!toc) return;
  wireCollapse(toc);
  wireScrollSpy(toc);
}
