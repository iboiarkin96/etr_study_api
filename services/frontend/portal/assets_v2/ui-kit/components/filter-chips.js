/* ui-kit/components/filter-chips.js
   Functional filter chips — mount via [data-filter-group].
   data-target : CSS selector of the filterable container.
   Each chip needs [data-filter="tag"] (use "all" for show-all).
   Each filterable item needs [data-tags="tag1 tag2 ..."].
   Active chip gets class docs-chip--active + aria-pressed="true".
   URL hash updated as #filter=<tag> (skipped for "all"). */

export function mountFilterChips() {
  document.querySelectorAll("[data-filter-group]").forEach(group => {
    const targetSel = group.getAttribute("data-target");
    const container = targetSel ? document.querySelector(targetSel) : null;
    if (!container) return;

    const chips = Array.from(group.querySelectorAll("[data-filter]"));
    if (!chips.length) return;

    function applyFilter(filter) {
      chips.forEach(c => {
        const on = c.getAttribute("data-filter") === filter;
        c.setAttribute("aria-pressed", on ? "true" : "false");
        c.classList.toggle("docs-chip--active", on);
      });

      container.querySelectorAll("[data-tags]").forEach(item => {
        if (filter === "all") {
          item.removeAttribute("data-filter-hidden");
        } else {
          const tags = (item.getAttribute("data-tags") || "").split(" ");
          if (tags.includes(filter)) {
            item.removeAttribute("data-filter-hidden");
          } else {
            item.setAttribute("data-filter-hidden", "");
          }
        }
      });

      if (history.replaceState) {
        const hash = filter === "all" ? "" : `#filter=${filter}`;
        history.replaceState(null, "", window.location.pathname + window.location.search + hash);
      }
    }

    const hash    = window.location.hash.match(/^#filter=(.+)/)?.[1] || null;
    const initial = chips[0]?.getAttribute("data-filter") || "all";
    applyFilter(hash && chips.some(c => c.getAttribute("data-filter") === hash) ? hash : initial);

    chips.forEach(chip => {
      chip.addEventListener("click", () => applyFilter(chip.getAttribute("data-filter") || "all"));
    });
  });
}
