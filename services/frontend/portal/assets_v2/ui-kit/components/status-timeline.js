/* ui-kit/components/status-timeline.js
   Auto-mounts from: <div data-component="status-timeline" ...>
   Data attributes:
     data-current   — "proposed" | "accepted" | "active" | "superseded" | "deprecated"
     data-decided   — ISO date string, shown in metadata row
     data-supersedes      — e.g. "ADR 0017"          (optional)
     data-supersedes-href — href for the supersedes link (optional)
     data-superseded-by       — e.g. "ADR 0035"      (only when current=superseded)
     data-superseded-by-href  — href for the link-card (optional)
     data-superseded-by-title — short title of the superseding document (optional)
     data-author-id — person-id for author-chip (optional) */

const STATES = ["proposed", "accepted", "active", "superseded", "deprecated"];

const STATE_LABELS = {
  proposed:   "Proposed",
  accepted:   "Accepted",
  active:     "Active",
  superseded: "Superseded",
  deprecated: "Deprecated",
};

function nodeClass(state, currentIdx, i) {
  if (i < currentIdx) return "docs-status-timeline__node--past";
  if (i === currentIdx) return "docs-status-timeline__node--current";
  return "docs-status-timeline__node--future";
}

function buildChain(current) {
  const currentIdx = STATES.indexOf(current);
  const items = STATES.map((state, i) => {
    const mod = nodeClass(state, currentIdx, i);
    return (
      '<li class="docs-status-timeline__node ' + mod + '" aria-current="' + (i === currentIdx ? "step" : "false") + '">' +
        '<span class="docs-status-timeline__dot" aria-hidden="true"></span>' +
        '<span class="docs-status-timeline__label">' + STATE_LABELS[state] + "</span>" +
      "</li>"
    );
  });
  return (
    '<ol class="docs-status-timeline__chain" role="list" aria-label="Document lifecycle" style="--st-progress: ' + currentIdx + '">' +
    items.join("") +
    "</ol>"
  );
}

function buildMeta(el) {
  const decided = el.dataset.decided;
  const supersedes = el.dataset.supersedes;
  const supersededBy = el.dataset.supersededBy;
  const supersedHref = el.dataset.supersedHref || "#";
  const authorId = el.dataset.authorId;

  const items = [];

  if (decided) {
    items.push(
      '<div class="docs-status-timeline__meta-item">' +
        '<dt class="docs-status-timeline__meta-key">Decided on</dt>' +
        '<dd class="docs-status-timeline__meta-val">' + decided + "</dd>" +
      "</div>"
    );
  }

  if (authorId) {
    items.push(
      '<div class="docs-status-timeline__meta-item">' +
        '<dt class="docs-status-timeline__meta-key">Author</dt>' +
        '<dd class="docs-status-timeline__meta-val">' +
          '<span data-component="author-chip" data-person-id="' + authorId + '" data-variant="sm">Author</span>' +
        "</dd>" +
      "</div>"
    );
  }

  if (supersedes) {
    const href = el.dataset.supersedeshref || "#";
    items.push(
      '<div class="docs-status-timeline__meta-item">' +
        '<dt class="docs-status-timeline__meta-key">Supersedes</dt>' +
        '<dd class="docs-status-timeline__meta-val"><a href="' + href + '">' + supersedes + "</a></dd>" +
      "</div>"
    );
  }

  if (supersededBy) {
    const href = el.dataset.supersededByhref || "#";
    items.push(
      '<div class="docs-status-timeline__meta-item">' +
        '<dt class="docs-status-timeline__meta-key">Superseded by</dt>' +
        '<dd class="docs-status-timeline__meta-val"><a href="' + href + '">' + supersededBy + "</a></dd>" +
      "</div>"
    );
  }

  if (!items.length) return "";
  return (
    '<dl class="docs-status-timeline__meta">' +
    items.join("") +
    "</dl>"
  );
}

function buildSuccessor(el) {
  const current = el.dataset.current || "proposed";
  if (current !== "superseded") return "";

  const supersededBy = el.dataset.supersededBy;
  if (!supersededBy) return "";

  const href = el.dataset.supersededByhref || "#";
  const title = el.dataset.supersededByTitle || "Superseding document";

  return (
    '<div class="docs-status-timeline__successor-wrap">' +
      '<p class="docs-status-timeline__successor-heading">This document has been superseded</p>' +
      '<a class="docs-status-timeline__successor" href="' + href + '">' +
        '<span class="docs-status-timeline__successor-icon" aria-hidden="true">' +
          '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
          "</svg>" +
        "</span>" +
        '<span class="docs-status-timeline__successor-body">' +
          '<span class="docs-status-timeline__successor-id">' + supersededBy + "</span>" +
          '<span class="docs-status-timeline__successor-title">' + title + "</span>" +
        "</span>" +
        '<span class="docs-status-timeline__successor-arrow" aria-hidden="true">' +
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
          "</svg>" +
        "</span>" +
      "</a>" +
    "</div>"
  );
}

function mount(el) {
  const current = (el.dataset.current || "proposed").toLowerCase();
  const valid = STATES.includes(current) ? current : "proposed";

  el.innerHTML =
    buildChain(valid) +
    buildMeta(el) +
    buildSuccessor(el);

  el.removeAttribute("data-component");
  el.classList.add("docs-status-timeline");
}

export function initStatusTimeline() {
  document
    .querySelectorAll('[data-component="status-timeline"]')
    .forEach(mount);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initStatusTimeline);
} else {
  initStatusTimeline();
}
