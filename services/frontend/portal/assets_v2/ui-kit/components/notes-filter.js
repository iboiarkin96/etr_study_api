/* ui-kit/components/notes-filter.js
   Wires the [data-component="multi-filter-chips"][data-state-key="group"]
   on the personal notes index to the actual card grid. The chip component
   itself only fires a `multifilterchange` event; this listener hides
   `.notes-card[data-group]` cards whose group does not match.

   In by-group view it also hides the entire `<section data-group>` if the
   active filter does not match its group — so the headings of unrelated
   groups disappear too, not just their (already-empty) card grids.

   When the resulting selection is empty (e.g. "API & Contract" with no
   posts yet), it sets `data-empty="true"` on `#notes-views` so the
   `.notes-empty` callout takes over. */

function getActiveGroup() {
  const raw = (window.location.hash || "").replace(/^#/, "");
  return new URLSearchParams(raw).get("group") || "all";
}

function apply(container, group) {
  const cards = Array.from(container.querySelectorAll(".notes-card[data-group]"));
  let visibleCards = 0;

  cards.forEach(card => {
    const match = group === "all" || card.getAttribute("data-group") === group;
    if (match) {
      card.removeAttribute("data-filter-hidden");
      visibleCards += 1;
    } else {
      card.setAttribute("data-filter-hidden", "");
    }
  });

  // By-group view: hide whole sections (heading + grid) whose group does
  // not match. The empty-group rule in notes-card.css already hides
  // sections that have no cards at all.
  container.querySelectorAll(".notes-by-group > section[data-group]").forEach(section => {
    const match = group === "all" || section.getAttribute("data-group") === group;
    if (match) {
      section.removeAttribute("data-filter-hidden");
    } else {
      section.setAttribute("data-filter-hidden", "");
    }
  });

  if (visibleCards === 0) {
    container.setAttribute("data-empty", "true");
  } else {
    container.removeAttribute("data-empty");
  }
}

export function mountNotesFilter() {
  const container = document.getElementById("notes-views");
  if (!container) return;

  apply(container, getActiveGroup());

  window.addEventListener("multifilterchange", event => {
    const detail = event && event.detail;
    if (!detail || detail.key !== "group") return;
    apply(container, detail.value || "all");
  });

  window.addEventListener("hashchange", () => {
    apply(container, getActiveGroup());
  });
}
