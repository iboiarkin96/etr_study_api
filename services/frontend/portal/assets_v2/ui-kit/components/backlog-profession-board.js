/* ui-kit/components/backlog-profession-board.js
   Renders the filtered backlog grouped into one column per profession (the
   six study-app roles). Tasks with multiple professions appear in every
   relevant column with a small cross-cutting marker. */

const PROFESSIONS = [
  { id: "architect", label: "Architect", icon: "△" },
  { id: "dev",       label: "Dev",       icon: "⌘" },
  { id: "manager",   label: "Manager",   icon: "▣" },
  { id: "qa",        label: "QA",        icon: "✓" },
  { id: "sa",        label: "SA",        icon: "✎" },
  { id: "sre",       label: "SRE",       icon: "⛭" },
];

const STATUS_LABEL = {
  "todo":        "To do",
  "in-progress": "In progress",
  "blocked":     "Blocked",
  "done":        "Done",
};

const STATUS_CLASS = {
  "todo":        "docs-status-pill--todo",
  "in-progress": "docs-status-pill--in-progress",
  "blocked":     "docs-status-pill--blocked",
  "done":        "docs-status-pill--done",
};

const PRI_CLASS = {
  "P0": "docs-pill--rose",
  "P1": "docs-pill--warn",
  "P2": "docs-pill--info",
  "P3": "docs-pill--neutral",
};

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderBacklogProfessionBoard(container, tasks) {
  if (!container) return;

  const columns = PROFESSIONS.map(prof => {
    const items = tasks.filter(t => t.professions.includes(prof.id));
    const itemMarkup = items.length
      ? items.map(t => {
          const crossCutting = t.professions.length > 1;
          const markerTitle = `Also: ${t.professions.filter(p => p !== prof.id).join(", ")}`;
          const marker = crossCutting
            ? `<span class="backlog-board__cross" title="${esc(markerTitle)}" aria-label="${esc(markerTitle)}">+${t.professions.length - 1}</span>`
            : "";
          return `<article class="backlog-board__tile" data-status="${esc(t.status)}" data-task-id="${esc(t.id)}" tabindex="0">
            <div class="backlog-board__tile-head">
              <span class="docs-pill ${PRI_CLASS[t.priority] || "docs-pill--neutral"}">${esc(t.priority)}</span>
              <span class="docs-status-pill ${STATUS_CLASS[t.status] || ""}">${esc(STATUS_LABEL[t.status] || t.status)}</span>
              ${marker}
            </div>
            <h4 class="backlog-board__tile-title">${esc(t.title)}</h4>
            <div class="backlog-board__tile-meta">
              <code>${esc(t.id)}</code>
              <span>${Number(t.eta_hours) || 0}h</span>
            </div>
          </article>`;
        }).join("")
      : `<p class="backlog-board__empty">Clean queue.</p>`;

    return `<section class="backlog-board__column" aria-label="${esc(prof.label)} column">
      <header class="backlog-board__column-head">
        <span class="backlog-board__column-icon" aria-hidden="true">${prof.icon}</span>
        <h3 class="backlog-board__column-title">${esc(prof.label)}</h3>
        <span class="backlog-board__column-count">${items.length}</span>
      </header>
      <div class="backlog-board__column-body">${itemMarkup}</div>
    </section>`;
  }).join("");

  container.innerHTML = `<div class="backlog-board">${columns}</div>`;
}
