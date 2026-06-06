/* ui-kit/components/backlog-table.js
   Renders the filtered backlog as a sticky-head zebra table. Pure function:
   call with the container, the filtered task array, and the sprints index. */

/* Column-header tooltips — kept locally to avoid a circular import with
   backlog-cockpit.js (which already imports this module). The full TIP
   map lives there; the strings below are a subset matched in wording. */
const TIP = {
  col_id:       "Stable BL-NNN handle. Immutable, never reused — incidents and postmortems link by this ID forever.",
  col_title:    "One-line description. Click the row to open the full detail card.",
  col_pri:      "Priority. P0 critical → P3 post-launch.",
  professions:  "Which professional roles this task is relevant for (Architect · SWE · Manager · QA · SA · SRE).",
  sprint:       "Which one-week sprint this task is committed to. «backlog» means unscheduled — work that does not need to ship by the deadline.",
  status:       "Task lifecycle state — To do · In progress · Blocked · Done.",
  eta_hours:    "Estimated hours of focused work to ship this task. Rough order-of-magnitude, not a deadline contract.",
  updated:      "Last date any field on this task changed. A long-stale «updated» on a «to do» row is a smell.",
};

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

const PROF_LABEL = {
  architect: "Architect",
  dev:       "Dev",
  manager:   "Manager",
  qa:        "QA",
  sa:        "SA",
  sre:       "SRE",
};

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderBacklogTable(container, tasks, sprintsById) {
  if (!container) return;
  if (!tasks.length) {
    container.innerHTML = `<p class="docs-empty">No tasks match the current filters.</p>`;
    return;
  }

  const rows = tasks.map(t => {
    const sprint = sprintsById[t.sprint];
    const sprintLabel = sprint ? sprint.label : t.sprint;
    const profChips = t.professions
      .map(p => `<span class="docs-pill docs-pill--neutral">${esc(PROF_LABEL[p] || p)}</span>`)
      .join(" ");
    return `<tr class="backlog-table__row" data-task-id="${esc(t.id)}" tabindex="0">
      <td><code>${esc(t.id)}</code></td>
      <td>${esc(t.title)}</td>
      <td class="backlog-table__profs">${profChips}</td>
      <td>${esc(sprintLabel)}</td>
      <td><span class="docs-status-pill ${STATUS_CLASS[t.status] || ""}">${esc(STATUS_LABEL[t.status] || t.status)}</span></td>
      <td><span class="docs-pill ${PRI_CLASS[t.priority] || "docs-pill--neutral"}">${esc(t.priority)}</span></td>
      <td class="backlog-table__eta"><span class="backlog-table__eta-num">${Number(t.eta_hours) || 0}</span><span class="backlog-table__eta-unit">h</span></td>
      <td class="backlog-table__updated"><time datetime="${esc(t.updated)}">${esc(t.updated)}</time></td>
    </tr>`;
  }).join("");

  container.innerHTML = `<div class="docs-table-wrap">
    <table class="docs-table docs-table--zebra docs-table--sticky-head">
      <thead>
        <tr>
          <th scope="col" style="width:8ch" data-tooltip="${TIP.col_id}">ID</th>
          <th scope="col" data-tooltip="${TIP.col_title}">Title</th>
          <th scope="col" data-tooltip="${TIP.professions}">Professions</th>
          <th scope="col" style="width:14ch" data-tooltip="${TIP.sprint}">Sprint</th>
          <th scope="col" style="width:14ch" data-tooltip="${TIP.status}">Status</th>
          <th scope="col" style="width:6ch" data-tooltip="${TIP.col_pri}">Pri</th>
          <th scope="col" style="width:6ch" data-tooltip="${TIP.eta_hours}">ETA</th>
          <th scope="col" style="width:12ch" data-tooltip="${TIP.updated}">Updated</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}
