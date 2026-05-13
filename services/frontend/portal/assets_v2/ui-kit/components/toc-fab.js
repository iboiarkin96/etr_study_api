/* ui-kit/components/toc-fab.js — floating "on this page" button (≤1024px).
   Ports prod behavior: idle dim after no scroll, stick-to-sidebar when sidebar visible. */

const IDLE_DELAY_MS = 1800;

function getHeadings(scope) {
  const main = scope.querySelector("main") || scope;
  return main.querySelectorAll("h2[id], h3[id]");
}

function buildList(headings) {
  const ul = document.createElement("ul");
  ul.className = "docs-toc-fab__list";
  headings.forEach((h) => {
    const li = document.createElement("li");
    li.className = "docs-toc-fab__item docs-toc-fab__item--" + h.tagName.toLowerCase();
    const a = document.createElement("a");
    a.href = "#" + h.id;
    a.textContent = h.textContent;
    a.className = "docs-toc-fab__link";
    li.appendChild(a);
    ul.appendChild(li);
  });
  return ul;
}

export function mountTocFab(root = document) {
  const fab = root.querySelector('[data-component="toc-fab"]');
  if (!fab) return;
  fab.classList.add("docs-toc-fab");
  if (!fab.innerHTML.trim()) {
    fab.innerHTML =
      "<svg class='docs-toc-fab__icon' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' aria-hidden='true'><path d='M4 6h16M4 12h16M4 18h10' stroke-linecap='round'/></svg>";
  }

  const panel = document.createElement("nav");
  panel.className = "docs-toc-fab__panel";
  panel.setAttribute("aria-hidden", "true");
  panel.setAttribute("aria-label", "On this page");
  const headings = getHeadings(root);
  if (!headings.length) return;
  panel.appendChild(buildList(headings));
  document.body.appendChild(panel);

  let open = false;
  const setOpen = (next) => {
    open = next;
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    fab.setAttribute("aria-expanded", open ? "true" : "false");
  };
  fab.addEventListener("click", () => setOpen(!open));
  document.addEventListener("click", (e) => {
    if (!open) return;
    if (panel.contains(e.target) || fab.contains(e.target)) return;
    setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) setOpen(false);
  });

  let idleTimer = null;
  const wake = () => {
    fab.removeAttribute("data-fab-idle");
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => fab.setAttribute("data-fab-idle", "true"), IDLE_DELAY_MS);
  };
  wake();
  window.addEventListener("scroll", wake, { passive: true });
  window.addEventListener("mousemove", wake, { passive: true });
  window.addEventListener("touchstart", wake, { passive: true });

  const sidebar = root.querySelector('[data-component="sidebar"]');
  if (sidebar) {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio > 0.1) {
            fab.setAttribute("data-fab-stuck", "true");
          } else {
            fab.removeAttribute("data-fab-stuck");
          }
        });
      },
      { threshold: [0, 0.1, 0.5, 1] }
    );
    obs.observe(sidebar);
  }
}
