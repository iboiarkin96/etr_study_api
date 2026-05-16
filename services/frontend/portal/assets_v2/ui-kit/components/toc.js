/* ui-kit/components/toc.js — desktop "On this page" rail.
   Wires a collapse toggle next to the title and scroll-spy that flashes
   the active heading. State persists in localStorage; the body
   data-toc-collapsed attribute lets layout.css collapse the column. */

const COLLAPSE_KEY = "docs-toc-collapsed";

function storedCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "true";
  } catch (_) {
    return false;
  }
}

function saveCollapsed(val) {
  try {
    localStorage.setItem(COLLAPSE_KEY, val ? "true" : "false");
  } catch (_) {
    /* ignore */
  }
}

function applyCollapsed(toc, toggle, collapsed) {
  if (collapsed) {
    toc.setAttribute("data-collapsed", "true");
    document.body.setAttribute("data-toc-collapsed", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("data-tooltip", "Expand the on-this-page rail.");
  } else {
    toc.removeAttribute("data-collapsed");
    document.body.removeAttribute("data-toc-collapsed");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("data-tooltip", "Collapse the on-this-page rail.");
  }
}

function buildListFromHeadings(toc) {
  if (toc.querySelector(".docs-toc__list")) return true;
  const main = document.querySelector("main");
  if (!main) return false;

  const headings = Array.from(main.querySelectorAll("h2[id], h3[id]"));
  if (headings.length < 2) return false;

  const root = document.createElement("ol");
  root.className = "docs-toc__list";

  let lastH2Item = null;
  let lastH2SubList = null;

  for (const h of headings) {
    const li = document.createElement("li");
    li.className = "docs-toc__item";
    const a = document.createElement("a");
    a.className = "docs-toc__link";
    a.href = `#${h.id}`;
    a.textContent = h.textContent.trim();
    li.appendChild(a);

    if (h.tagName === "H2") {
      root.appendChild(li);
      lastH2Item = li;
      lastH2SubList = null;
    } else if (lastH2Item) {
      if (!lastH2SubList) {
        lastH2SubList = document.createElement("ol");
        lastH2SubList.className = "docs-toc__list";
        lastH2Item.appendChild(lastH2SubList);
      }
      lastH2SubList.appendChild(li);
    } else {
      li.classList.add("docs-toc__item--h3");
      root.appendChild(li);
    }
  }

  toc.appendChild(root);
  return true;
}

function ensureTitle(toc) {
  if (toc.querySelector(".docs-toc__title")) return;
  const p = document.createElement("p");
  p.className = "docs-toc__title";
  p.textContent = "On this page";
  toc.prepend(p);
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
  toggle.setAttribute("data-tooltip", "Collapse the on-this-page rail.");
  toggle.setAttribute("data-tooltip-placement", "left");
  toggle.innerHTML =
    "<svg viewBox='0 0 12 12' aria-hidden='true'>" +
    "<path d='M2 4l4 4 4-4' fill='none' stroke='currentColor' stroke-width='1.5' " +
    "stroke-linecap='round' stroke-linejoin='round'/></svg>";

  title.replaceWith(header);
  header.appendChild(title);
  header.appendChild(toggle);

  applyCollapsed(toc, toggle, storedCollapsed());

  toggle.addEventListener("click", () => {
    const collapsed = toc.hasAttribute("data-collapsed");
    applyCollapsed(toc, toggle, !collapsed);
    saveCollapsed(!collapsed);
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

  function recalc() {
    const threshold = window.innerHeight * 0.35;
    for (const h of headings) {
      const top = h.getBoundingClientRect().top;
      if (top >= 0 && top < threshold) {
        setActive(h);
        return;
      }
    }
    const mid = window.innerHeight / 2;
    let last = null;
    for (const h of headings) {
      if (h.getBoundingClientRect().top < mid) last = h;
    }
    if (last) setActive(last);
  }

  const obs = new IntersectionObserver(
    () => recalc(),
    { rootMargin: "0px 0px -65% 0px", threshold: 0 }
  );

  headings.forEach((h) => obs.observe(h));
}

export function mountToc(root = document) {
  const toc = root.querySelector("aside.docs-toc:not(.docs-toc--demo)") ||
              root.querySelector("aside.docs-toc");
  if (!toc) return;

  const built = buildListFromHeadings(toc);
  if (!built && !toc.querySelector(".docs-toc__list")) {
    toc.hidden = true;
    return;
  }
  ensureTitle(toc);
  wireCollapse(toc);
  wireScrollSpy(toc);
}
