/* ui-kit/components/backlog-timeline.js
   Renders the filtered backlog as vertical sprint lanes. Reuses the cockpit
   timeline classes already in cockpit.css. */

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

function fmtDates(sprint) {
  if (!sprint.starts || !sprint.ends) return "Unscheduled";
  return `${sprint.starts} → ${sprint.ends}`;
}

export function renderBacklogTimeline(container, tasks, sprints) {
  if (!container) return;

  const lanes = sprints.map(sprint => {
    const items = tasks.filter(t => t.sprint === sprint.id);
    const itemMarkup = items.length
      ? items.map(t => `
        <div class="cockpit-timeline__item" data-task-id="${esc(t.id)}" tabindex="0">
          <span class="cockpit-timeline__item-title">${esc(t.title)}</span>
          <div class="cockpit-timeline__item-meta">
            <span class="docs-status-pill ${STATUS_CLASS[t.status] || ""}">${esc(STATUS_LABEL[t.status] || t.status)}</span>
            <span class="docs-pill ${PRI_CLASS[t.priority] || "docs-pill--neutral"}">${esc(t.priority)}</span>
            <span class="backlog-timeline__eta">${Number(t.eta_hours) || 0}h</span>
          </div>
        </div>`).join("")
      : `<p class="backlog-timeline__empty">No matching tasks in this sprint.</p>`;

    const currentClass = sprint.state === "active" ? " cockpit-timeline__lane--current" : "";
    return `<div class="cockpit-timeline__lane${currentClass}">
      <div class="cockpit-timeline__head">
        <span class="cockpit-timeline__sprint-label">${esc(sprint.label)}</span>
        <span class="cockpit-timeline__sprint-dates">${esc(fmtDates(sprint))}</span>
      </div>
      <div class="cockpit-timeline__body">${itemMarkup}</div>
    </div>`;
  }).join("");

  container.innerHTML = `<div class="cockpit-timeline">${lanes}</div>`;
}
