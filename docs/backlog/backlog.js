(() => {
  const GROUP_PREVIEW_LIMIT = 10;
  const items = Array.from(document.querySelectorAll(".backlog-item"));
  if (!items.length) {
    return;
  }

  const groupLabel = {
    frontend: "Frontend",
    backend: "Backend",
    devops: "DevOps",
    docs: "Docs",
  };
  const allowedGroups = new Set(["frontend", "backend", "devops", "docs"]);
  const allowedTags = new Set(["bug", "feature", "research", "tech-debt"]);
  const priorityBaseHours = {
    P0: 28,
    P1: 18,
    P2: 11,
    P3: 7,
  };
  const groupComplexityMultiplier = {
    frontend: 1.0,
    backend: 1.2,
    devops: 1.3,
    docs: 0.8,
  };
  const llmAssistFactor = 0.78;
  const seniorFocusHoursPerDay = 5;
  const estimateScaleDivisor = 3;

  const state = {
    group: "all",
    priorities: new Set(),
    taskTypes: new Set(),
    statuses: new Set(),
    search: "",
    quickPreset: "all",
    viewMode: "board",
  };
  const prioritySortRank = {
    P1: 2,
    P2: 3,
    P3: 4,
    P0: 5,
  };
  const statusSortRank = {
    todo: 0,
    "in-progress": 1,
    blocked: 2,
    done: 3,
    rejected: 4,
  };
  const reorderTopSections = () => {
    const main = document.querySelector("main.container");
    const overview = document.getElementById("overview-section");
    const groups = document.getElementById("backlog-blocks");
    const allTasks = document.getElementById("all-tasks-section");
    const cockpit = document.getElementById("backlog-cockpit");
    if (!main || !cockpit || !overview || !groups || !allTasks) {
      return;
    }
    main.insertBefore(cockpit, overview);
    main.insertBefore(overview, groups);
    main.insertBefore(groups, allTasks);
  };
  const taskListMount = document.getElementById("backlog-task-list");
  const ensureEmptyState = () => {
    if (!taskListMount) {
      return null;
    }
    let emptyState = document.getElementById("backlog-task-list-empty");
    if (!emptyState) {
      emptyState = document.createElement("p");
      emptyState.id = "backlog-task-list-empty";
      emptyState.className = "backlog-empty-state";
      emptyState.textContent = "По указанным фильтрам задач не найдено.";
      emptyState.hidden = true;
      taskListMount.insertAdjacentElement("beforebegin", emptyState);
    }
    return emptyState;
  };
  const ensureValidationMount = () => {
    const cockpit = document.getElementById("backlog-cockpit");
    if (!cockpit) {
      return null;
    }
    let mount = document.getElementById("backlog-validation-alert");
    if (!mount) {
      mount = document.createElement("section");
      mount.id = "backlog-validation-alert";
      mount.className = "backlog-validation-alert";
      mount.hidden = true;
      cockpit.appendChild(mount);
    }
    return mount;
  };
  const mountTaskList = () => {
    if (!taskListMount) {
      return;
    }
    items.forEach((item) => {
      taskListMount.appendChild(item);
    });
  };

  const numberCards = () => {
    items.forEach((item, index) => {
      const heading = item.querySelector("h2");
      if (!heading) {
        return;
      }
      const existing = heading.querySelector(".backlog-order");
      if (existing) {
        existing.remove();
      }
      const marker = document.createElement("span");
      marker.className = "backlog-order";
      marker.textContent = `${index + 1}.`;
      heading.insertBefore(marker, heading.firstChild);
    });
  };


  const normalize = (value) => (value || "").trim().toLowerCase();
  const searchableTextFor = (item) => normalize(item.textContent || "");

  const readStatus = (item) => {
    const value = normalize(item.dataset.status);
    if (value) {
      return value;
    }
    const pill = item.querySelector(".status-pill");
    if (!pill) {
      return "";
    }
    if (pill.classList.contains("status-pill--todo")) return "todo";
    if (pill.classList.contains("status-pill--in-progress")) return "in-progress";
    if (pill.classList.contains("status-pill--blocked")) return "blocked";
    if (pill.classList.contains("status-pill--done")) return "done";
    if (pill.classList.contains("status-pill--rejected")) return "rejected";
    return "";
  };

  const itemNumber = (item) => {
    const match = (item.id || "").match(/item-(\d+)/i);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  };

  const readTags = (item) =>
    normalize(item.dataset.tags)
      .split(/\s+/)
      .filter(Boolean);

  const hasAnyTag = (item, expectedTags) => {
    const tags = readTags(item);
    return expectedTags.some((tag) => tags.includes(tag));
  };

  const priorityBucketRank = (item, status, priority) => {
    if (isOpenStatus(status) && priority === "P0") {
      return 0;
    }
    if (hasAnyTag(item, ["bug"])) {
      return 1;
    }
    return prioritySortRank[priority] ?? 6;
  };

  const sortItemsInPlace = () => {
    items.sort((a, b) => {
      const statusA = readStatus(a);
      const statusB = readStatus(b);
      const priorityA = (a.dataset.priority || "").trim();
      const priorityB = (b.dataset.priority || "").trim();

      const openRankA = isOpenStatus(statusA) ? 0 : 1;
      const openRankB = isOpenStatus(statusB) ? 0 : 1;
      if (openRankA !== openRankB) {
        return openRankA - openRankB;
      }

      const bucketA = priorityBucketRank(a, statusA, priorityA);
      const bucketB = priorityBucketRank(b, statusB, priorityB);
      if (bucketA !== bucketB) {
        return bucketA - bucketB;
      }

      const statusRankA = statusSortRank[statusA] ?? 99;
      const statusRankB = statusSortRank[statusB] ?? 99;
      if (statusRankA !== statusRankB) {
        return statusRankA - statusRankB;
      }

      return itemNumber(a) - itemNumber(b);
    });
  };

  const decorateCards = () => {
    items.forEach((item) => {
      const tags = normalize(item.dataset.tags)
        .split(/\s+/)
        .filter(Boolean);
      const summary = document.createElement("div");
      summary.className = "backlog-item-summary";

      const group = normalize(item.dataset.group);
      if (group) {
        const groupBadge = document.createElement("span");
        groupBadge.className = "backlog-chip backlog-chip--group";
        groupBadge.textContent = groupLabel[group] || group;
        summary.appendChild(groupBadge);
      }

      tags.forEach((tag) => {
        const chip = document.createElement("span");
        chip.className = "backlog-chip";
        chip.textContent = tag;
        summary.appendChild(chip);
      });

      if (summary.childElementCount) {
        const h2 = item.querySelector("h2");
        h2?.insertAdjacentElement("afterend", summary);
      }
    });
  };

  const roundToHalf = (value) => Math.max(0.5, Math.round(value * 2) / 2);

  const estimateForItem = (item) => {
    const priority = (item.dataset.priority || "P2").trim();
    const group = normalize(item.dataset.group) || "backend";
    const baseHours = priorityBaseHours[priority] || priorityBaseHours.P2;
    const complexity = groupComplexityMultiplier[group] || 1;
    const adjustedHours = (baseHours * complexity * llmAssistFactor) / estimateScaleDivisor;
    const days = adjustedHours / seniorFocusHoursPerDay;
    const minDays = roundToHalf(days * 0.8);
    const maxDays = roundToHalf(days * 1.35);
    const minHours = minDays * seniorFocusHoursPerDay;
    const maxHours = maxDays * seniorFocusHoursPerDay;
    return { minDays, maxDays, minHours, maxHours };
  };

  const recalibrateEstimateBlocks = () => {
    items.forEach((item) => {
      const estimateTitle = Array.from(item.querySelectorAll("dt")).find((dt) =>
        /Rough estimate/i.test(dt.textContent || ""),
      );
      if (!estimateTitle) {
        return;
      }
      estimateTitle.textContent = "Estimate (recalibrated for one senior + LLM)";

      const estimateBlock = estimateTitle.nextElementSibling;
      if (!estimateBlock) {
        return;
      }
      const cells = Array.from(estimateBlock.querySelectorAll(".time-cell"));
      if (!cells.length) {
        return;
      }
      const { minHours, maxHours } = estimateForItem(item);
      const hourByCell = [3, 2, 1];
      cells.forEach((cell, index) => {
        const strongLabel = cell.querySelector("strong")?.textContent || `${hourByCell[index] || 3} h/day`;
        const dayRate = hourByCell[index] || 3;
        const minDays = roundToHalf(minHours / dayRate);
        const maxDays = roundToHalf(maxHours / dayRate);
        cell.innerHTML = `<strong>${strongLabel}</strong> ~${minDays}-${maxDays} days`;
      });
    });
  };

  const isOpenStatus = (status) =>
    status === "todo" || status === "in-progress" || status === "blocked";

  const hasPriorityFilter = () => state.priorities.size > 0;
  const hasTaskTypeFilter = () => state.taskTypes.size > 0;
  const hasStatusFilter = () => state.statuses.size > 0;
  const openStatuses = ["todo", "in-progress", "blocked"];
  const isExactStatusSet = (expected) =>
    state.statuses.size === expected.length &&
    expected.every((status) => state.statuses.has(status));
  const hasExactPriorities = (expected) =>
    state.priorities.size === expected.length &&
    expected.every((priority) => state.priorities.has(priority));

  const setQuickPresetButtons = (preset) => {
    document.querySelectorAll("[data-quick-preset]").forEach((button) => {
      const value = button.getAttribute("data-quick-preset") || "";
      button.classList.toggle("is-active", value === preset);
    });
  };

  const activatePriorityButtons = () => {
    const hasActivePriority = hasPriorityFilter();
    document.querySelectorAll("[data-filter-priority]").forEach((button) => {
      const value = button.getAttribute("data-filter-priority") || "all";
      if (value === "all") {
        button.classList.toggle("is-active", !hasActivePriority);
        return;
      }
      button.classList.toggle("is-active", state.priorities.has(value));
    });
  };

  const activateTaskTypeButtons = () => {
    const hasActiveTaskType = hasTaskTypeFilter();
    document.querySelectorAll("[data-filter-task-type]").forEach((button) => {
      const value = button.getAttribute("data-filter-task-type") || "all";
      if (value === "all") {
        button.classList.toggle("is-active", !hasActiveTaskType);
        return;
      }
      button.classList.toggle("is-active", state.taskTypes.has(value));
    });
  };

  const activateStatusButtons = () => {
    const hasActiveStatus = hasStatusFilter();
    document.querySelectorAll("[data-filter-status]").forEach((button) => {
      const value = button.getAttribute("data-filter-status") || "all";
      if (value === "all") {
        button.classList.toggle("is-active", !hasActiveStatus);
        return;
      }
      button.classList.toggle("is-active", state.statuses.has(value));
    });
  };

  const matchesQuickPreset = (item, status, priority) => {
    switch (state.quickPreset) {
      case "my-focus":
        return isOpenStatus(status) && (priority === "P0" || priority === "P1");
      case "open":
        return isOpenStatus(status);
      case "blocked":
        return status === "blocked";
      case "high-risk":
        return priority === "P0" && hasAnyTag(item, ["bug", "tech-debt"]);
      default:
        return true;
    }
  };

  const syncQuickPresetFromDetailed = () => {
    const hasGroupFilter = state.group !== "all";
    if (!hasGroupFilter && !hasStatusFilter() && !hasPriorityFilter() && !hasTaskTypeFilter()) {
      state.quickPreset = "all";
    } else if (
      !hasGroupFilter &&
      isExactStatusSet(openStatuses) &&
      hasExactPriorities(["P0", "P1"]) &&
      !hasTaskTypeFilter()
    ) {
      state.quickPreset = "my-focus";
    } else if (
      !hasGroupFilter &&
      isExactStatusSet(openStatuses) &&
      !hasPriorityFilter() &&
      !hasTaskTypeFilter()
    ) {
      state.quickPreset = "open";
    } else if (
      !hasGroupFilter &&
      isExactStatusSet(["blocked"]) &&
      !hasPriorityFilter() &&
      !hasTaskTypeFilter()
    ) {
      state.quickPreset = "blocked";
    } else if (
      !hasGroupFilter &&
      !hasStatusFilter() &&
      hasExactPriorities(["P0"]) &&
      state.taskTypes.size === 2 &&
      state.taskTypes.has("bug") &&
      state.taskTypes.has("tech-debt")
    ) {
      state.quickPreset = "high-risk";
    } else {
      state.quickPreset = "custom";
    }
    setQuickPresetButtons(state.quickPreset);
  };

  const applyDetailedFromQuickPreset = (preset) => {
    state.group = "all";
    state.priorities.clear();
    state.taskTypes.clear();
    state.statuses.clear();

    switch (preset) {
      case "my-focus":
        openStatuses.forEach((status) => state.statuses.add(status));
        state.priorities.add("P0");
        state.priorities.add("P1");
        break;
      case "open":
        openStatuses.forEach((status) => state.statuses.add(status));
        break;
      case "blocked":
        state.statuses.add("blocked");
        break;
      case "high-risk":
        state.priorities.add("P0");
        state.taskTypes.add("bug");
        state.taskTypes.add("tech-debt");
        break;
      default:
        break;
    }

    activateFilterButtons("[data-filter-group]", state.group);
    activatePriorityButtons();
    activateTaskTypeButtons();
    activateStatusButtons();
  };

  const matches = (item) => {
    const group = normalize(item.dataset.group);
    const priority = (item.dataset.priority || "").trim();
    const tags = readTags(item);
    const status = readStatus(item);
    const searchHaystack = searchableTextFor(item);
    const searchOk = !state.search || searchHaystack.includes(state.search);

    const groupOk = state.group === "all" || group === state.group;
    const priorityOk = !hasPriorityFilter() || state.priorities.has(priority);
    const taskTypeOk = !hasTaskTypeFilter() || tags.some((tag) => state.taskTypes.has(tag));
    const statusOk = !hasStatusFilter() || state.statuses.has(status);
    const quickPresetOk = matchesQuickPreset(item, status, priority);

    return groupOk && priorityOk && taskTypeOk && statusOk && quickPresetOk && searchOk;
  };

  const renderCockpitStats = () => {
    const mount = document.getElementById("backlog-cockpit-stats");
    if (!mount) {
      return;
    }
    const visible = items.filter((item) => !item.hidden);
    const openCount = visible.filter((item) => isOpenStatus(readStatus(item))).length;
    const blockedCount = visible.filter((item) => readStatus(item) === "blocked").length;
    const highRiskCount = visible.filter((item) => {
      const status = readStatus(item);
      const priority = (item.dataset.priority || "").trim();
      return status === "blocked" || (isOpenStatus(status) && priority === "P0");
    }).length;
    const doneCount = visible.filter((item) => readStatus(item) === "done").length;
    mount.innerHTML = `
      <article class="backlog-kpi">
        <span class="backlog-kpi__label">Visible tasks</span>
        <strong class="backlog-kpi__value">${visible.length}</strong>
      </article>
      <article class="backlog-kpi">
        <span class="backlog-kpi__label">Open</span>
        <strong class="backlog-kpi__value">${openCount}</strong>
      </article>
      <article class="backlog-kpi">
        <span class="backlog-kpi__label">Blocked</span>
        <strong class="backlog-kpi__value">${blockedCount}</strong>
      </article>
      <article class="backlog-kpi">
        <span class="backlog-kpi__label">High risk</span>
        <strong class="backlog-kpi__value">${highRiskCount}</strong>
      </article>
      <article class="backlog-kpi">
        <span class="backlog-kpi__label">Done</span>
        <strong class="backlog-kpi__value">${doneCount}</strong>
      </article>
    `;
  };

  const applyViewMode = () => {
    document.body.setAttribute("data-backlog-view", state.viewMode);
  };

  const validateTaxonomy = () => {
    const issues = [];
    items.forEach((item) => {
      item.classList.remove("backlog-item--invalid-taxonomy");
      item.removeAttribute("data-validation-errors");

      const group = normalize(item.dataset.group);
      const tags = normalize(item.dataset.tags)
        .split(/\s+/)
        .filter(Boolean);
      const itemIssues = [];

      if (!allowedGroups.has(group)) {
        itemIssues.push(`invalid group "${group || "empty"}"`);
      }
      if (!tags.length) {
        itemIssues.push("missing tags");
      } else {
        const unknownTags = tags.filter((tag) => !allowedTags.has(tag));
        if (unknownTags.length) {
          itemIssues.push(`unknown tags: ${unknownTags.join(", ")}`);
        }
      }

      if (itemIssues.length) {
        const title = item.querySelector("h2")?.textContent?.replace(/\s+/g, " ").trim() || item.id;
        item.classList.add("backlog-item--invalid-taxonomy");
        item.setAttribute("data-validation-errors", itemIssues.join("; "));
        item.title = `Taxonomy issue: ${itemIssues.join("; ")}`;
        issues.push({ id: item.id, title, problems: itemIssues });
      } else {
        item.removeAttribute("title");
      }
    });

    const mount = ensureValidationMount();
    if (!mount) {
      return;
    }
    if (!issues.length) {
      mount.hidden = true;
      mount.innerHTML = "";
      return;
    }

    const preview = issues
      .slice(0, 5)
      .map(
        (issue) =>
          `<li><a href="#${issue.id}">${issue.title}</a> — ${issue.problems.join(", ")}</li>`,
      )
      .join("");
    const more = issues.length > 5 ? `<p>...and ${issues.length - 5} more.</p>` : "";
    mount.hidden = false;
    mount.innerHTML = `
      <h3>Taxonomy validation warnings</h3>
      <p>Some cards violate the backlog schema (<code>group</code> or <code>tags</code>). Fix them to keep filters reliable.</p>
      <ul>${preview}</ul>
      ${more}
    `;
  };

  const applyFilter = () => {
    items.forEach((item) => {
      item.hidden = !matches(item);
    });
    const visibleCount = items.filter((item) => !item.hidden).length;
    const emptyState = ensureEmptyState();
    if (emptyState) {
      emptyState.hidden = visibleCount !== 0;
    }
    renderGroupSections();
    renderCockpitStats();
  };

  const activateFilterButtons = (selector, value) => {
    document.querySelectorAll(selector).forEach((button) => {
      const buttonValue =
        button.getAttribute("data-filter-group") ||
        button.getAttribute("data-filter-priority") ||
        button.getAttribute("data-filter-task-type") ||
        button.getAttribute("data-filter-status") ||
        button.getAttribute("data-quick-preset") ||
        button.getAttribute("data-view-mode") ||
        "";
      button.classList.toggle("is-active", buttonValue === value);
    });
  };

  const wireButtons = () => {
    document.querySelectorAll("[data-filter-group]").forEach((button) => {
      button.addEventListener("click", () => {
        state.group = button.getAttribute("data-filter-group") || "all";
        activateFilterButtons("[data-filter-group]", state.group);
        syncQuickPresetFromDetailed();
        applyFilter();
      });
    });

    document.querySelectorAll("[data-filter-priority]").forEach((button) => {
      button.addEventListener("click", () => {
        const selectedPriority = button.getAttribute("data-filter-priority") || "all";
        if (selectedPriority === "all") {
          state.priorities.clear();
        } else if (state.priorities.has(selectedPriority)) {
          state.priorities.delete(selectedPriority);
        } else {
          state.priorities.add(selectedPriority);
        }
        activatePriorityButtons();
        syncQuickPresetFromDetailed();
        applyFilter();
      });
    });

    document.querySelectorAll("[data-filter-task-type]").forEach((button) => {
      button.addEventListener("click", () => {
        const selectedTaskType = button.getAttribute("data-filter-task-type") || "all";
        if (selectedTaskType === "all") {
          state.taskTypes.clear();
        } else if (state.taskTypes.has(selectedTaskType)) {
          state.taskTypes.delete(selectedTaskType);
        } else {
          state.taskTypes.add(selectedTaskType);
        }
        activateTaskTypeButtons();
        syncQuickPresetFromDetailed();
        applyFilter();
      });
    });

    document.querySelectorAll("[data-filter-status]").forEach((button) => {
      button.addEventListener("click", () => {
        const selectedStatus = button.getAttribute("data-filter-status") || "all";
        if (selectedStatus === "all") {
          state.statuses.clear();
        } else if (state.statuses.has(selectedStatus)) {
          state.statuses.delete(selectedStatus);
        } else {
          state.statuses.add(selectedStatus);
        }
        activateStatusButtons();
        syncQuickPresetFromDetailed();
        applyFilter();
      });
    });

    document.querySelectorAll("[data-quick-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        state.quickPreset = button.getAttribute("data-quick-preset") || "all";
        setQuickPresetButtons(state.quickPreset);
        applyDetailedFromQuickPreset(state.quickPreset);
        applyFilter();
      });
    });

    document.querySelectorAll("[data-view-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        state.viewMode = button.getAttribute("data-view-mode") || "board";
        activateFilterButtons("[data-view-mode]", state.viewMode);
        applyViewMode();
      });
    });

    const searchInput = document.getElementById("backlog-global-search");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        state.search = normalize(searchInput.value);
        applyFilter();
      });
    }

    const detailedFilters = document.getElementById("backlog-detailed-filters");
    if (detailedFilters && window.matchMedia("(max-width: 780px)").matches) {
      detailedFilters.open = false;
    }
  };

  const renderGroupSections = () => {
    const mount = document.getElementById("backlog-group-sections");
    if (!mount) {
      return;
    }
    mount.innerHTML = "";

    const groups = ["frontend", "backend", "devops", "docs"];
    groups.forEach((group) => {
      const section = document.createElement("section");
      section.className = "backlog-group";

      const headerRow = document.createElement("div");
      headerRow.className = "backlog-group-header";
      const heading = document.createElement("h3");
      heading.textContent = groupLabel[group];
      const counter = document.createElement("span");
      counter.className = "backlog-group-count";
      headerRow.appendChild(heading);
      headerRow.appendChild(counter);
      section.appendChild(headerRow);

      const list = document.createElement("ul");
      list.className = "backlog-group-list";
      const groupItems = items.filter(
        (item) => normalize(item.dataset.group) === group && !item.hidden,
      );
      counter.textContent = `${groupItems.length}`;
      groupItems.forEach((item, index) => {
          const h2 = item.querySelector("h2");
          if (!h2) {
            return;
          }
          const li = document.createElement("li");
          if (index >= GROUP_PREVIEW_LIMIT) {
            li.hidden = true;
            li.classList.add("is-extra-item");
          }
          const a = document.createElement("a");
          a.href = `#${item.id}`;
          a.textContent = h2.textContent.replace(/\s+/g, " ").trim();
          li.appendChild(a);
          list.appendChild(li);
        });

      if (!list.childElementCount) {
        const li = document.createElement("li");
        li.textContent = "No tasks in this block for current filter.";
        list.appendChild(li);
      }
      section.appendChild(list);

      if (groupItems.length > GROUP_PREVIEW_LIMIT) {
        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "backlog-group-toggle";
        toggleBtn.textContent = `Show more (${groupItems.length - GROUP_PREVIEW_LIMIT})`;
        toggleBtn.setAttribute("aria-expanded", "false");
        toggleBtn.addEventListener("click", () => {
          const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
          list.querySelectorAll(".is-extra-item").forEach((node) => {
            node.hidden = expanded;
          });
          toggleBtn.setAttribute("aria-expanded", expanded ? "false" : "true");
          toggleBtn.textContent = expanded
            ? `Show more (${groupItems.length - GROUP_PREVIEW_LIMIT})`
            : "Show less";
        });
        section.appendChild(toggleBtn);
      }

      mount.appendChild(section);
    });
  };

  sortItemsInPlace();
  mountTaskList();
  reorderTopSections();
  numberCards();
  decorateCards();
  recalibrateEstimateBlocks();
  wireButtons();
  activatePriorityButtons();
  activateTaskTypeButtons();
  activateStatusButtons();
  setQuickPresetButtons(state.quickPreset);
  validateTaxonomy();
  applyViewMode();
  applyFilter();
})();
