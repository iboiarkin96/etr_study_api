/* ui-kit/components/backlog-cockpit.js
   Backlog cockpit page controller.

   Mounts on:
     <section data-component="backlog-cockpit"
              data-tasks-src="…/tasks.json"
              data-sprints-src="…/sprints.json">
       …
     </section>

   Responsibilities:
     • Fetch tasks.json + sprints.json
     • Render the sprint switcher chip group from sprints.json
     • Render the active sprint goal callout
     • Compute KPIs over the filtered scope and update the KPI strip
     • Re-render the active view (table | timeline | by-profession) on
       every filter / sprint / view change
     • Listen to the shared multi-key hash via window events:
         - "multifilterchange" from multi-filter-chips.js
         - "viewchange" from view-switcher.js
*/

import { renderBacklogTable } from "./backlog-table.js";
import { renderBacklogTimeline } from "./backlog-timeline.js";
import { renderBacklogProfessionBoard } from "./backlog-profession-board.js";
import { mountMultiFilterChips } from "./multi-filter-chips.js";
import { openModal, closeModal } from "./modal.js";

const DEADLINE_ISO = "2026-06-30";

/* TIP — plain-English tooltip text for every field on the task-detail card.
   Kept in one place so the wording stays consistent across the modal and
   the «Help» affordance future readers may add. Sourced from the _schema
   block at the top of tasks.json — keep these strings in sync if the
   schema descriptions change. */
const TIP = {
  // Section titles
  summary:    "One-sentence answer to «what does shipping this look like?»",
  problem:    "Why this task exists — what hurts today that shipping it fixes. Read before deciding to cut or defer.",
  actions:    "Ordered concrete steps to ship. The recipe, not the rationale — every line is something you actually do.",
  acceptance: "What must be true before the task can flip to «done». If any line is still false, the task is in-progress, not done.",
  meta:       "The bookkeeping fields — who owns it, which sprint, how big, when it last moved.",

  // Top-line pills
  priority: {
    P0: "P0 · Critical — must ship before deadline; blocks other work.",
    P1: "P1 · High — committed to current scope; ship before deadline if humanly possible.",
    P2: "P2 · Medium — nice-to-have for current scope; first to be cut when the week is tight.",
    P3: "P3 · Low — post-launch / opportunistic; safe to defer past the deadline.",
    _default: "Task priority (P0 critical → P3 post-launch).",
  },
  status: {
    "todo":        "To do · Queued but not started. Owner is assigned and the spec is ready to pick up.",
    "in-progress": "In progress · Actively being worked on right now — there is an open branch, draft, or PR.",
    "blocked":     "Blocked · Cannot move forward until an external dependency clears (see «Blocked by» field).",
    "done":        "Done · Shipped and accepted — every Acceptance bullet passes and the change is merged.",
    _default:      "Task lifecycle state.",
  },

  // Meta fields
  professions:  "Which professional roles this task is relevant for (Architect · SWE · Manager · QA · SA · SRE). Drives the profession filter chips.",
  sprint:       "Which one-week sprint this task is committed to. «backlog» means unscheduled — work that does not need to ship by the deadline.",
  sprint_goal:  "Headline theme of the sprint this task belongs to — copied from sprints.json. Tells you why the task is grouped with its siblings.",
  eta_hours:    "Estimated hours of focused work to ship this task. Rough order-of-magnitude, not a deadline contract — used for sprint capacity, not billing.",
  owner:        "Person on the hook to drive this to done. An empty owner is the most serious smell — it means «no one owns it» and the row is a top-of-backlog defect.",
  group:        "High-level area the task touches (backend · frontend · docs · devops). Used by the «By profession» board view to group cards.",
  updated:      "Last date any field on this task changed. A long-stale «updated» on a «to do» row is a smell — either the row is dead or it needs a re-confirm.",
  blocked_by:   "ID of the task that must finish first. While this is set, status auto-promotes to «blocked» and the row appears in the Blocked filter.",
  tags:         "Free-form labels — «feature», «tech-debt», «bug», «research». Drive secondary filters and tell reviewers what shape of change to expect.",
  links:        "External references for context — related ADRs, RFCs, postmortems, dashboards, source files.",

  // Table column headers (used by backlog-table.js as well via the export)
  col_id:       "Stable BL-NNN handle. Immutable, never reused — incidents and postmortems link by this ID forever.",
  col_title:    "One-line description. Click the row to open the full detail card.",
  col_pri:      "Priority. P0 critical → P3 post-launch.",
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

function readHash() {
  return new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function daysBetween(aIso, bIso) {
  const ms = new Date(bIso + "T00:00:00Z").getTime() - new Date(aIso + "T00:00:00Z").getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function todayIso() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function getState(defaults) {
  const params = readHash();
  return {
    sprint:     params.get("sprint")     || defaults.sprint,
    profession: params.get("profession") || "all",
    status:     params.get("status")     || "open",
    priority:   params.get("priority")   || "all",
    view:       params.get("view")       || "table",
  };
}

function filterTasks(tasks, state) {
  return tasks.filter(t => {
    if (state.sprint     !== "all" && t.sprint !== state.sprint) return false;
    if (state.profession !== "all" && !t.professions.includes(state.profession)) return false;
    if (state.status     !== "all") {
      if (state.status === "open" && t.status === "done") return false;
      if (state.status !== "open" && t.status !== state.status) return false;
    }
    if (state.priority   !== "all" && t.priority !== state.priority) return false;
    return true;
  });
}

function fmtDateRange(starts, ends) {
  if (!starts || !ends) return "Unscheduled";
  const sMonth = new Date(starts + "T00:00:00Z").toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const eMonth = new Date(ends + "T00:00:00Z").toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const sDay = Number(starts.slice(8, 10));
  const eDay = Number(ends.slice(8, 10));
  return sMonth === eMonth ? `${sMonth} ${sDay}–${eDay}` : `${sMonth} ${sDay} – ${eMonth} ${eDay}`;
}

function computeKpis(tasks, allTasks, state, sprintsById) {
  const today = todayIso();
  const days = Math.max(0, daysBetween(today, DEADLINE_ISO));
  const activeSprint = sprintsById[state.sprint];

  const open = tasks.filter(t => t.status !== "done");
  // At-risk = every open P0/P1, regardless of sprint timing. The previous
  // «sprint ends within 7 days» refinement hid most of the queue and made
  // the metric feel arbitrary; the simpler «critical work not yet shipped»
  // reading is the one a reviewer actually wants on the hero.
  const atRisk = allTasks.filter(t =>
    t.status !== "done" && (t.priority === "P0" || t.priority === "P1")
  );
  const doneThisSprint = activeSprint
    ? allTasks.filter(t => t.sprint === activeSprint.id && t.status === "done")
    : [];

  const openHoursTotal = open.reduce((s, t) => s + (Number(t.eta_hours) || 0), 0);

  return {
    daysToShip: days,
    openInScope: open.length,
    openHours: openHoursTotal,
    atRisk: atRisk.length,
    doneThisSprint: doneThisSprint.length,
    activeSprintLabel: activeSprint ? activeSprint.label : "—",
  };
}

function paintKpis(root, k) {
  const set = (sel, value) => {
    const el = root.querySelector(sel);
    if (el) el.textContent = String(value);
  };
  set("[data-kpi-value='days']",     k.daysToShip);
  set("[data-kpi-value='open']",     k.openInScope);
  set("[data-kpi-value='open-h']",   k.openHours + "h");
  set("[data-kpi-value='at-risk']",  k.atRisk);
  set("[data-kpi-value='done']",     k.doneThisSprint);
  set("[data-kpi-sub='sprint']",     k.activeSprintLabel);
}

function sprintTooltip(s) {
  if (!s) return "";
  const today = todayIso();
  const lines = [];
  if (s.starts && s.ends) {
    lines.push(`${s.starts} → ${s.ends}`);
    const remaining = daysBetween(today, s.ends);
    const beforeStart = daysBetween(today, s.starts);
    if (beforeStart > 0) lines.push(`starts in ${beforeStart}d`);
    else if (remaining < 0) lines.push(`ended ${-remaining}d ago`);
    else if (remaining === 0) lines.push(`ends today`);
    else {
      const total = Math.max(1, daysBetween(s.starts, s.ends));
      const elapsed = Math.min(total, Math.max(0, daysBetween(s.starts, today)));
      lines.push(`${remaining}d left · day ${elapsed + 1}/${total + 1}`);
    }
  } else {
    lines.push("Unscheduled");
  }
  if (s.goal) lines.push("", s.goal);
  return lines.join("\n");
}

function renderSprintSwitcher(host, sprints, defaultSprint) {
  if (!host) return;
  const buttons = sprints.map(s => {
    const dot = s.state === "active" ? `<span class="backlog-sprint-dot" aria-hidden="true"></span>` : "";
    // Compact chips: show only the date range. Sprints without dates
    // (e.g. the synthetic «backlog» bucket) fall back to their label.
    const labelText = s.starts && s.ends ? fmtDateRange(s.starts, s.ends) : s.label;
    const tip = esc(sprintTooltip(s));
    return `<button type="button"
                    class="docs-chip docs-chip--filter backlog-sprint-chip"
                    data-value="${esc(s.id)}"
                    aria-pressed="false"
                    title="${tip}">
      <span class="backlog-sprint-chip__row">${dot}<span class="backlog-sprint-chip__dates">${esc(labelText)}</span></span>
    </button>`;
  }).join("");
  const allBtn = `<button type="button"
                          class="docs-chip docs-chip--filter backlog-sprint-chip"
                          data-value="all"
                          aria-pressed="false"
                          title="All sprints — whole horizon">
    <span class="backlog-sprint-chip__row"><span class="backlog-sprint-chip__dates">All</span></span>
  </button>`;
  host.innerHTML = allBtn + buttons;
  host.setAttribute("data-component", "multi-filter-chips");
  host.setAttribute("data-state-key", "sprint");
  host.setAttribute("data-default", defaultSprint);
}

function renderTaskDetail(task, sprintsById, tasksById) {
  const sprint = sprintsById[task.sprint];
  const sprintLine = sprint
    ? `${esc(sprint.label)}${sprint.starts && sprint.ends ? ` · ${esc(sprint.starts)} → ${esc(sprint.ends)}` : ""}`
    : esc(task.sprint);
  const profs = (task.professions || [])
    .map(p => `<span class="docs-pill docs-pill--neutral">${esc(PROF_LABEL[p] || p)}</span>`)
    .join(" ");
  const tags = (task.tags || []).length
    ? `<dt data-tooltip="${TIP.tags}">Tags</dt><dd class="backlog-detail__tags">${task.tags.map(t => `<span class="docs-chip">${esc(t)}</span>`).join(" ")}</dd>`
    : "";
  const blockedBy = task.blocked_by
    ? `<dt data-tooltip="${TIP.blocked_by}">Blocked by</dt><dd><code>${esc(task.blocked_by)}</code>${tasksById[task.blocked_by] ? ` — ${esc(tasksById[task.blocked_by].title)}` : ""}</dd>`
    : "";
  const links = Array.isArray(task.links) && task.links.length
    ? `<dt data-tooltip="${TIP.links}">Links</dt><dd><ul class="backlog-detail__links">${task.links.map(l => `<li><a href="${esc(l.href)}">${esc(l.label || l.href)}</a></li>`).join("")}</ul></dd>`
    : "";
  const sprintGoal = sprint && sprint.goal
    ? `<dt data-tooltip="${TIP.sprint_goal}">Sprint goal</dt><dd>${esc(sprint.goal)}</dd>`
    : "";

  const summary = task.summary
    ? `<section class="backlog-detail__section"><h4 class="backlog-detail__section-title" data-tooltip="${TIP.summary}">Summary</h4><p class="backlog-detail__summary">${esc(task.summary)}</p></section>`
    : "";
  const problem = task.problem
    ? `<section class="backlog-detail__section"><h4 class="backlog-detail__section-title" data-tooltip="${TIP.problem}">Problem</h4><p class="backlog-detail__paragraph">${esc(task.problem)}</p></section>`
    : "";
  const actions = Array.isArray(task.actions) && task.actions.length
    ? `<section class="backlog-detail__section"><h4 class="backlog-detail__section-title" data-tooltip="${TIP.actions}">Actions</h4><ol class="backlog-detail__steps">${task.actions.map(a => `<li>${esc(a)}</li>`).join("")}</ol></section>`
    : "";
  const acceptance = Array.isArray(task.acceptance) && task.acceptance.length
    ? `<section class="backlog-detail__section"><h4 class="backlog-detail__section-title" data-tooltip="${TIP.acceptance}">Acceptance</h4><ul class="backlog-detail__checks">${task.acceptance.map(a => `<li>${esc(a)}</li>`).join("")}</ul></section>`
    : "";

  return `
    <div class="backlog-detail__head-row">
      <span class="docs-pill ${PRI_CLASS[task.priority] || "docs-pill--neutral"}" data-tooltip="${TIP.priority[task.priority] || TIP.priority._default}">${esc(task.priority)}</span>
      <span class="docs-status-pill ${STATUS_CLASS[task.status] || ""}" data-tooltip="${TIP.status[task.status] || TIP.status._default}">${esc(STATUS_LABEL[task.status] || task.status)}</span>
      <span class="backlog-detail__id"><code>${esc(task.id)}</code></span>
    </div>
    <h3 class="backlog-detail__title">${esc(task.title)}</h3>
    ${summary}
    ${problem}
    ${actions}
    ${acceptance}
    <section class="backlog-detail__section">
      <h4 class="backlog-detail__section-title" data-tooltip="${TIP.meta}">Meta</h4>
      <dl class="backlog-detail__meta">
        <dt data-tooltip="${TIP.professions}">Professions</dt><dd class="backlog-detail__profs">${profs}</dd>
        <dt data-tooltip="${TIP.sprint}">Sprint</dt><dd>${sprintLine}</dd>
        ${sprintGoal}
        <dt data-tooltip="${TIP.eta_hours}">ETA</dt><dd>${Number(task.eta_hours) || 0}h</dd>
        <dt data-tooltip="${TIP.owner}">Owner</dt><dd>${esc(task.owner || "—")}</dd>
        ${task.group ? `<dt data-tooltip="${TIP.group}">Group</dt><dd>${esc(task.group)}</dd>` : ""}
        <dt data-tooltip="${TIP.updated}">Updated</dt><dd><time datetime="${esc(task.updated)}">${esc(task.updated)}</time></dd>
        ${blockedBy}
        ${tags}
        ${links}
      </dl>
    </section>
  `;
}

function ensureTaskModal() {
  let modal = document.getElementById("backlog-task-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.className = "docs-modal";
  modal.id = "backlog-task-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "backlog-task-modal-title");
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="docs-modal__backdrop" data-modal-close></div>
    <div class="docs-modal__panel">
      <div class="docs-modal__head">
        <h2 id="backlog-task-modal-title" class="docs-modal__title">Task</h2>
        <button class="docs-close-btn" type="button" data-modal-close aria-label="Close">×</button>
      </div>
      <div class="docs-modal__body" data-slot="task-body"></div>
    </div>
  `;
  document.body.appendChild(modal);
  const backdrop = modal.querySelector(".docs-modal__backdrop");
  if (backdrop) backdrop.addEventListener("click", () => closeModal(modal));
  modal.querySelectorAll("[data-modal-close]").forEach(btn => {
    if (btn === backdrop) return;
    btn.addEventListener("click", () => closeModal(modal));
  });
  return modal;
}

function openTaskDetail(task, sprintsById, tasksById) {
  if (!task) return;
  const modal = ensureTaskModal();
  const titleEl = modal.querySelector("#backlog-task-modal-title");
  const bodyEl  = modal.querySelector("[data-slot='task-body']");
  if (titleEl) titleEl.textContent = `${task.id} · ${task.title}`;
  if (bodyEl)  bodyEl.innerHTML = renderTaskDetail(task, sprintsById, tasksById);
  openModal(modal);
}

function findDefaultSprint(sprints) {
  // Prefer the sprint whose date window contains today — survives a stale
  // `state: "active"` flag in sprints.json (which decays the moment a week
  // ends if no one re-stamps the file). Falls back to the declared active
  // sprint, then to the first record.
  const today = todayIso();
  const current = sprints.find(s => s.starts && s.ends && s.starts <= today && today <= s.ends);
  if (current) return current.id;
  const declared = sprints.find(s => s.state === "active");
  if (declared) return declared.id;
  return sprints[0] ? sprints[0].id : "all";
}

export async function mountBacklogCockpit() {
  const root = document.querySelector('[data-component="backlog-cockpit"]');
  if (!root) return;

  const tasksUrl   = root.getAttribute("data-tasks-src");
  const sprintsUrl = root.getAttribute("data-sprints-src");
  if (!tasksUrl || !sprintsUrl) {
    console.error("backlog-cockpit: missing data-tasks-src or data-sprints-src");
    return;
  }

  let tasks = [];
  let sprints = [];
  try {
    const [tRes, sRes] = await Promise.all([fetch(tasksUrl), fetch(sprintsUrl)]);
    if (!tRes.ok || !sRes.ok) throw new Error("fetch failed");
    const tasksPayload = await tRes.json();
    // tasks.json may be a bare array (legacy) or { _schema, tasks } (current).
    tasks   = Array.isArray(tasksPayload) ? tasksPayload : tasksPayload.tasks;
    sprints = await sRes.json();
  } catch (err) {
    root.innerHTML = `<p class="docs-empty">Could not load backlog data. Check <code>${esc(tasksUrl)}</code> and <code>${esc(sprintsUrl)}</code>.</p>`;
    return;
  }

  const sprintsById = Object.fromEntries(sprints.map(s => [s.id, s]));
  const defaultSprint = findDefaultSprint(sprints);

  const sprintSwitcher = root.querySelector("[data-slot='sprint-switcher']");
  const tableHost      = root.querySelector(".cockpit-view--table");
  const timelineHost   = root.querySelector(".cockpit-view--timeline");
  const profBoardHost  = root.querySelector(".cockpit-view--by-profession");
  const viewsHost      = root.querySelector(".cockpit-views");

  renderSprintSwitcher(sprintSwitcher, sprints, defaultSprint);
  root.removeAttribute("data-component");

  mountMultiFilterChips();

  function rerender() {
    const state = getState({ sprint: defaultSprint });
    const filtered = filterTasks(tasks, state);
    paintKpis(root, computeKpis(filtered, tasks, state, sprintsById));
    renderBacklogTable(tableHost, filtered, sprintsById);
    renderBacklogTimeline(timelineHost, filtered, sprints);
    renderBacklogProfessionBoard(profBoardHost, filtered);
  }

  // The view-switcher mounted before us and may have restored a stale view
  // from localStorage. If the URL hash carries a `view` value, click the
  // matching button so the cockpit honours the URL as the source of truth.
  const hashView = readHash().get("view");
  if (hashView && viewsHost) {
    const btn = document.querySelector(`[data-view="${hashView}"]`);
    if (btn && btn.getAttribute("aria-pressed") !== "true") {
      btn.click();
    }
  }
  if (viewsHost && !viewsHost.getAttribute("data-view")) {
    viewsHost.setAttribute("data-view", hashView || "table");
  }

  rerender();

  const tasksById = Object.fromEntries(tasks.map(t => [t.id, t]));
  const openFromEl = (el) => {
    const id = el.getAttribute("data-task-id");
    if (!id) return;
    openTaskDetail(tasksById[id], sprintsById, tasksById);
  };
  root.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-task-id]");
    if (!trigger || !root.contains(trigger)) return;
    if (e.target.closest("a")) return;
    openFromEl(trigger);
  });
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const trigger = e.target.closest("[data-task-id]");
    if (!trigger) return;
    e.preventDefault();
    openFromEl(trigger);
  });

  window.addEventListener("multifilterchange", rerender);

  if (viewsHost) {
    viewsHost.addEventListener("viewchange", e => {
      const view = e && e.detail && e.detail.view;
      if (!view) return;
      const params = readHash();
      if (view === "table") {
        params.delete("view");
      } else {
        params.set("view", view);
      }
      const str = params.toString();
      const hash = str ? "#" + str : "";
      if (history.replaceState) {
        history.replaceState(null, "", window.location.pathname + window.location.search + hash);
      }
    });
  }
}
