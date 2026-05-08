"use strict";

/**
 * Internal docs UI helpers (portal grouping, page editors, profile maintained list).
 * People data is generated into docs/assets/docs-portal-data.js from each profile page
 * (data-* on <body>) by scripts/collect_docs_portal_data.py — run make docs-fix.
 */
(function () {
  window.__DOCS_INTERNAL_META__ = {
    site: {
      github: {
        owner: "iboiarkin96",
        repo: "study_bot",
        defaultBranch: "main",
        docsPathPrefix: "docs/",
      },
    },
  };

  function normalizeParts(parts) {
    const out = [];
    for (const part of parts) {
      if (!part || part === ".") {
        continue;
      }
      if (part === "..") {
        if (out.length > 0) {
          out.pop();
        }
        continue;
      }
      out.push(part);
    }
    return out;
  }

  function relHref(fromDir, targetRelPath) {
    const fromParts = normalizeParts(fromDir.split("/"));
    const targetParts = normalizeParts(targetRelPath.split("/"));
    let i = 0;
    while (i < fromParts.length && i < targetParts.length && fromParts[i] === targetParts[i]) {
      i += 1;
    }
    const up = new Array(fromParts.length - i).fill("..");
    const down = targetParts.slice(i);
    const joined = [...up, ...down].join("/");
    return joined || ".";
  }

  function currentDocsRelPath() {
    const path = window.location.pathname.replace(/\\/g, "/");
    const marker = "/docs/";
    // First "/docs/" is the repo docs root; lastIndexOf fails for .../docs/audit/docs/...
    const idx = path.indexOf(marker);
    if (idx >= 0) {
      return path.slice(idx + marker.length);
    }
    const parts = path.split("/").filter(Boolean);
    const docsRootFirstSegments = new Set([
      "index.html",
      "adr",
      "api",
      "assets",
      "audit",
      "backlog",
      "developer",
      "howto",
      "internal",
      "meta",
      "openapi",
      "qa",
      "rfc",
      "runbooks",
    ]);
    if (docsRootFirstSegments.has(parts[0])) {
      return parts.join("/");
    }
    if (parts.length >= 2) {
      return parts.slice(1).join("/");
    }
    return parts[0] || "index.html";
  }

  function docsRootPrefixFromPage() {
    const relPath = currentDocsRelPath();
    const dir = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";
    const fromParts = normalizeParts(dir.split("/"));
    const up = new Array(fromParts.length).fill("..");
    const joined = [...up].join("/");
    return joined ? `${joined}/` : "";
  }

  function getPortalPeople() {
    const d = window.__DOCS_PORTAL_DATA__;
    return d && Array.isArray(d.people) ? d.people : [];
  }

  function personById(id) {
    const list = getPortalPeople();
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].personId === id) {
        return list[i];
      }
    }
    return null;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Comma-separated person ids on <body data-maintainer-ids="a,b"> */
  function parseMaintainerIds() {
    const raw = document.body.getAttribute("data-maintainer-ids") || "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function renderPageMeta() {
    const mount = document.getElementById("docs-page-meta-mount");
    if (!mount) {
      return;
    }
    const ids = parseMaintainerIds();
    if (ids.length === 0) {
      return;
    }

    const relPath = currentDocsRelPath();
    const fromDir = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";

    const VISIBLE_MAX = 3;

    function editorItem(pid, overflow) {
      const p = personById(pid);
      const overflowClass = overflow ? " docs-page-meta__editor--overflow" : "";
      if (p) {
        const profileHref = relHref(fromDir, `internal/portal/people/${p.slug}/index.html`);
        const photoHref = `${docsRootPrefixFromPage()}${p.photo}`;
        const name = p.displayName;
        return `<li class="docs-page-meta__editor${overflowClass}">
  <a class="docs-page-meta__avatar-link" href="${profileHref}">
    <img class="docs-page-meta__avatar" src="${photoHref}" width="38" height="38" alt="" />
  </a>
  <a class="docs-page-meta__editor-name-link" href="${profileHref}">${escapeHtml(name)}</a>
</li>`;
      }
      return `<li class="docs-page-meta__editor${overflowClass}" role="status">Unknown person id <code>${escapeHtml(pid)}</code> — add a profile under <code>docs/internal/portal/people/</code> with this <code>data-person-id</code> and run <code>make docs-fix</code>.</li>`;
    }

    const visibleIds = ids.slice(0, VISIBLE_MAX);
    const overflowIds = ids.slice(VISIBLE_MAX);
    const editorsHtml = visibleIds.map((pid) => editorItem(pid, false)).join("") +
      overflowIds.map((pid) => editorItem(pid, true)).join("");

    const moreHtml = overflowIds.length > 0
      ? `<li class="docs-page-meta__more"><button type="button" class="docs-page-meta__more-btn">+${overflowIds.length} more</button></li>`
      : "";

    mount.innerHTML = `<section class="docs-page-meta docs-page-meta--premium" aria-label="Page maintainers">
  <span class="docs-page-meta__title">Maintained by</span>
  <ul class="docs-page-meta__editors">${editorsHtml}${moreHtml}</ul>
</section>`;

    if (overflowIds.length > 0) {
      const moreBtn = mount.querySelector(".docs-page-meta__more-btn");
      const moreItem = mount.querySelector(".docs-page-meta__more");
      const list = mount.querySelector(".docs-page-meta__editors");
      if (moreBtn && list) {
        // { once: true } — handler is single-use and the button is removed after click,
        // so no listener references survive the teardown.
        moreBtn.addEventListener("click", () => {
          list.classList.add("docs-page-meta__editors--expanded");
          moreItem.remove();
        }, { once: true });
      }
    }

    mount.hidden = false;
  }

  const PORTAL_GROUP_ORDER = ["pm", "backend", "devops"];

  const PORTAL_GROUP_TITLES = {
    pm: "PM",
    backend: "Backend",
    devops: "DevOps",
  };

  function titleForGroupKey(k) {
    if (Object.prototype.hasOwnProperty.call(PORTAL_GROUP_TITLES, k)) {
      return PORTAL_GROUP_TITLES[k];
    }
    return String(k)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  function collectGroupKeysPresent(people) {
    const set = new Set();
    for (let i = 0; i < people.length; i += 1) {
      const g = people[i].groups;
      if (!Array.isArray(g)) {
        continue;
      }
      for (let j = 0; j < g.length; j += 1) {
        set.add(g[j]);
      }
    }
    return set;
  }

  function orderedPortalGroupEntries(presentKeys) {
    const out = [];
    let idx = 0;
    for (idx = 0; idx < PORTAL_GROUP_ORDER.length; idx += 1) {
      const k = PORTAL_GROUP_ORDER[idx];
      if (presentKeys.has(k)) {
        out.push({ key: k, title: titleForGroupKey(k) });
      }
    }
    const rest = [...presentKeys]
      .filter((k) => PORTAL_GROUP_ORDER.indexOf(k) === -1)
      .sort();
    for (idx = 0; idx < rest.length; idx += 1) {
      const k = rest[idx];
      out.push({ key: k, title: titleForGroupKey(k) });
    }
    return out;
  }

  function portalGroupDomId(key) {
    return String(key).replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  /** Items per page for Maintained pages on profile */
  const MAINTAINED_PAGE_SIZE = 10;
  const SKELETON_MIN_VISIBLE_MS = 600;

  let maintainedPagerState = null;

  function maintainedListItemsHtml(slice, fromDir) {
    return slice
      .map((pg) => {
        const href = relHref(fromDir, pg.path);
        return `<li><a href="${escapeHtml(href)}">${escapeHtml(pg.title)}</a> <span class="portal-profile__path">(<code>${escapeHtml(pg.path)}</code>)</span></li>`;
      })
      .join("");
  }

  function maintainedPagerNavHtml(pageIndex, totalPages) {
    if (totalPages <= 1) {
      return "";
    }
    const prevDisabled = pageIndex <= 0;
    const nextDisabled = pageIndex >= totalPages - 1;
    return `<nav class="portal-maintained-pager__nav" aria-label="Maintained pages pagination">
  <button type="button" class="portal-maintained-pager__btn" data-maintained-act="prev"${prevDisabled ? " disabled" : ""
      }>Previous</button>
  <span class="portal-maintained-pager__status">Page ${pageIndex + 1} of ${totalPages}</span>
  <button type="button" class="portal-maintained-pager__btn" data-maintained-act="next"${nextDisabled ? " disabled" : ""
      }>Next</button>
</nav>`;
  }

  function paintMaintainedPager(mount) {
    const state = maintainedPagerState;
    if (!state || !mount) {
      return;
    }
    const { pages, fromDir, pageSize } = state;
    const total = pages.length;
    if (total === 0) {
      mount.innerHTML = `<p class="portal-people-group__empty">No pages list you yet. Set <code>data-maintainer-ids=&quot;${escapeHtml(
        state.personId,
      )}&quot;</code> on a doc page <code>&lt;body&gt;</code> and run <code>make docs-fix</code>.</p>`;
      mount.onclick = null;
      return;
    }
    const totalPages = Math.ceil(total / pageSize);
    let idx = state.pageIndex;
    if (idx >= totalPages) {
      idx = totalPages - 1;
    }
    if (idx < 0) {
      idx = 0;
    }
    state.pageIndex = idx;
    const start = idx * pageSize;
    const slice = pages.slice(start, start + pageSize);
    const items = maintainedListItemsHtml(slice, fromDir);
    const nav = maintainedPagerNavHtml(idx, totalPages);
    mount.innerHTML = `<ul class="portal-profile-maintained__list">${items}</ul>${nav}`;
    mount.onclick = function (e) {
      const btn = e.target.closest("[data-maintained-act]");
      if (!btn || btn.disabled || !maintainedPagerState) {
        return;
      }
      const act = btn.getAttribute("data-maintained-act");
      const st = maintainedPagerState;
      const tp = Math.ceil(st.pages.length / st.pageSize);
      if (act === "prev" && st.pageIndex > 0) {
        st.pageIndex -= 1;
      } else if (act === "next" && st.pageIndex < tp - 1) {
        st.pageIndex += 1;
      }
      paintMaintainedPager(mount);
    };
  }

  function renderProfileMaintainedMount() {
    const mount = document.getElementById("portal-maintained-mount");
    if (!mount) {
      return;
    }
    const personId = document.body.getAttribute("data-person-id");
    if (!personId) {
      return;
    }
    mount.innerHTML = `<ul class="portal-skeleton-list" aria-hidden="true"><li></li><li></li><li></li></ul>`;
    const d = window.__DOCS_PORTAL_DATA__ || {};
    const pages = (d.maintainerPages && d.maintainerPages[personId]) || [];
    const relPath = currentDocsRelPath();
    const fromDir = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";
    maintainedPagerState = {
      personId,
      pages,
      fromDir,
      pageIndex: 0,
      pageSize: MAINTAINED_PAGE_SIZE,
    };
    window.setTimeout(() => {
      paintMaintainedPager(mount);
    }, SKELETON_MIN_VISIBLE_MS);
  }

  function renderPersonCard(p, fromDir) {
    const profileHref = relHref(fromDir, `internal/portal/people/${p.slug}/index.html`);
    const photoHref = `${docsRootPrefixFromPage()}${p.photo}`;
    const name = escapeHtml(p.displayName);
    const groupsRaw = Array.isArray(p.groups) ? p.groups : [];
    const groups = groupsRaw.map((g) => escapeHtml(titleForGroupKey(g))).join(" · ");
    const groupsHtml = groups ? `<span class="portal-people__meta">${groups}</span>` : "";
    return `<li class="portal-people__item card">
  <a class="portal-people__link" href="${profileHref}">
    <span class="portal-people__avatar-link">
      <img class="portal-people__avatar" src="${photoHref}" width="56" height="56" alt="" />
    </span>
    <span class="portal-people__text">
      <span class="portal-people__name">${name}</span>
      ${groupsHtml}
    </span>
  </a>
</li>`;
  }

  function renderPortalPeople() {
    const mount = document.getElementById("portal-people-mount");
    if (!mount) {
      return;
    }
    mount.innerHTML = `<div class="portal-skeleton-grid" aria-hidden="true"><span></span><span></span><span></span></div>`;
    // Derive fromDir from the current page so the mount works on both
    // `internal/README.html` and `internal/portal/people/index.html`.
    const relPath = currentDocsRelPath();
    const fromDir = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";
    const people = getPortalPeople();

    const presentKeys = collectGroupKeysPresent(people);
    const groupEntries = orderedPortalGroupEntries(presentKeys);

    if (groupEntries.length === 0) {
      mount.innerHTML = `<p class="portal-people-group__empty">No profiles with <code>data-groups</code> under <code>docs/internal/portal/people/</code> yet. Run <code>make docs-fix</code> after editing profiles.</p>`;
      return;
    }

    const blocks = groupEntries
      .map((g) => {
        const gid = portalGroupDomId(g.key);
        const inGroup = people
          .filter((p) => Array.isArray(p.groups) && p.groups.includes(g.key))
          .slice()
          .sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || "")));
        const listItems = inGroup.map((p) => renderPersonCard(p, fromDir)).join("");
        const count = inGroup.length;
        const countBadge = `<span class="portal-people-group__count" aria-label="${escapeHtml(g.title)} people count">${count}</span>`;
        const body = listItems
          ? `<ul class="portal-people__list">${listItems}</ul>`
          : `<p class="portal-people-group__empty">No people listed yet.</p>`;
        return `<section class="portal-people-group" aria-labelledby="portal-group-${gid}">
  <h3 class="portal-people-group__title" id="portal-group-${gid}">${escapeHtml(g.title)} ${countBadge}</h3>
  ${body}
</section>`;
      })
      .join("");

    window.setTimeout(() => {
      mount.innerHTML = blocks;
    }, SKELETON_MIN_VISIBLE_MS);
  }

  /* ──────────────────────────────────────────────────────────────────────────
   *  Portal "Hall of Contributors" — premium gallery for people/index.html
   *  Mounts: #portal-spotlight-mount, #portal-people-gallery-mount,
   *          #portal-coverage-mount, plus [data-portal-ticker-target] in hero.
   *  Reads __DOCS_PORTAL_DATA__.{people, maintainerPages}; same data set
   *  used by the lightweight #portal-people-mount on internal/README.html.
   * ────────────────────────────────────────────────────────────────────────── */

  const PORTAL_TONE_BY_GROUP = { pm: "rose", backend: "blue", devops: "teal" };
  const PORTAL_TONE_HEX = {
    blue: "#3b82f6",
    teal: "#06b6d4",
    rose: "#f43f5e",
    amber: "#f59e0b",
    green: "#10b981",
    purple: "#0ea5e9",
    mono: "#64748b",
  };

  const PORTAL_SECTION_LABELS = {
    adr: "ADRs",
    rfc: "RFCs",
    runbooks: "Runbooks",
    qa: "QA docs",
    audit: "Audits",
    developer: "Dev guides",
    howto: "How-to guides",
    internal: "Internal specs",
    openapi: "OpenAPI",
    backlog: "Backlog",
  };

  function portalToneForPerson(p) {
    const g = Array.isArray(p.groups) && p.groups.length ? p.groups[0] : null;
    return (g && PORTAL_TONE_BY_GROUP[g]) || "mono";
  }

  function portalSectionBucket(path) {
    const i = path.indexOf("/");
    return i >= 0 ? path.slice(0, i) : path;
  }

  function portalSectionLabel(key) {
    return PORTAL_SECTION_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
  }

  function portalPagesFor(maintainerPages, personId) {
    return (maintainerPages && maintainerPages[personId]) || [];
  }

  function portalCountSections(pages) {
    const counts = {};
    for (let i = 0; i < pages.length; i += 1) {
      const b = portalSectionBucket(pages[i].path);
      counts[b] = (counts[b] || 0) + 1;
    }
    return counts;
  }

  function portalTopSections(pages, limit) {
    const counts = portalCountSections(pages);
    return Object.keys(counts)
      .map((k) => [k, counts[k]])
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  function portalGithubIcon() {
    return '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.69.08-.69 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.17.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.18-1.48 3.14-1.17 3.14-1.17.63 1.59.23 2.76.12 3.05.74.8 1.18 1.82 1.18 3.08 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/></svg>';
  }

  function portalArrowIcon() {
    return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>';
  }

  function paintPortalTickers(totals) {
    const nodes = document.querySelectorAll("[data-portal-ticker-target]");
    nodes.forEach((node) => {
      const key = node.getAttribute("data-portal-ticker-target");
      const v = totals[key];
      if (typeof v === "number") {
        node.textContent = String(v);
      }
    });
  }

  function renderPortalSpotlight(top, totals, fromDir) {
    const mount = document.getElementById("portal-spotlight-mount");
    if (!mount || !top) {
      return;
    }
    const pages = portalPagesFor(window.__DOCS_PORTAL_DATA__.maintainerPages, top.personId);
    const profileHref = relHref(fromDir, `internal/portal/people/${top.slug}/index.html`);
    const photoHref = `${docsRootPrefixFromPage()}${top.photo}`;
    const tone = portalToneForPerson(top);
    const hex = PORTAL_TONE_HEX[tone];

    const top4 = portalTopSections(pages, 4);
    const statItems = top4
      .map(([key, count]) => {
        return `<li class="portal-spotlight__stat">
          <span class="portal-spotlight__stat-num">${count}</span>
          <span class="portal-spotlight__stat-lab">${escapeHtml(portalSectionLabel(key))}</span>
        </li>`;
      })
      .join("");

    const groupsHtml = (top.groups || [])
      .map((g) => `<li class="portal-spotlight__role">${escapeHtml(titleForGroupKey(g))}</li>`)
      .join("");

    const githubHtml = top.github && top.github !== "-"
      ? `<a class="portal-spotlight__github" href="https://github.com/${encodeURIComponent(top.github)}" rel="noopener noreferrer">${portalGithubIcon()}<span>@${escapeHtml(top.github)}</span></a>`
      : "";

    mount.innerHTML = `<article class="portal-spotlight" data-portal-tone="${tone}" style="--portal-tone:${hex};" aria-labelledby="portal-spotlight-title">
      <div class="portal-spotlight__decor" aria-hidden="true">
        <span class="portal-spotlight__orb"></span>
        <span class="portal-spotlight__grid"></span>
      </div>
      <a class="portal-spotlight__avatar-link" href="${profileHref}" tabindex="-1" aria-hidden="true">
        <span class="portal-spotlight__halo" aria-hidden="true"></span>
        <img class="portal-spotlight__avatar" src="${photoHref}" width="128" height="128" alt="" />
      </a>
      <div class="portal-spotlight__body">
        <p class="portal-spotlight__eyebrow">Team lead</p>
        <h2 id="portal-spotlight-title" class="portal-spotlight__name">${escapeHtml(top.displayName)}</h2>
        <ul class="portal-spotlight__roles">${groupsHtml}</ul>
        <p class="portal-spotlight__lead">Owns <strong>${pages.length}</strong> of <strong>${totals.pageCount}</strong> documentation pages — about <strong>${Math.round((pages.length / Math.max(1, totals.pageCount)) * 100)}%</strong> of the surface.</p>
        <ul class="portal-spotlight__stats">${statItems}</ul>
        <div class="portal-spotlight__actions">
          <a class="portal-spotlight__cta" href="${profileHref}">View profile ${portalArrowIcon()}</a>
          ${githubHtml}
        </div>
      </div>
    </article>`;
  }

  function renderPortalPersonCard(p, maintainerPages, fromDir /* , totalPages */) {
    const profileHref = relHref(fromDir, `internal/portal/people/${p.slug}/index.html`);
    const photoHref = `${docsRootPrefixFromPage()}${p.photo}`;
    const tone = portalToneForPerson(p);
    const hex = PORTAL_TONE_HEX[tone];

    const groups = Array.isArray(p.groups) ? p.groups : [];
    const rolesInner = groups
      .map((g, i) => {
        const gTone = PORTAL_TONE_BY_GROUP[g] || "mono";
        const gHex = PORTAL_TONE_HEX[gTone];
        const sep = i > 0
          ? `<span class="portal-person__role-sep" aria-hidden="true">×</span>`
          : "";
        return `${sep}<span class="portal-person__role" data-portal-tone="${gTone}" style="--role-tone:${gHex};">
          <span class="portal-person__role-dot" aria-hidden="true"></span>${escapeHtml(titleForGroupKey(g))}
        </span>`;
      })
      .join("");

    const githubHtml = p.github && p.github !== "-"
      ? `<a class="portal-person__github" href="https://github.com/${encodeURIComponent(p.github)}" rel="noopener noreferrer" onclick="event.stopPropagation();">${portalGithubIcon()}<span>${escapeHtml(p.github)}</span></a>`
      : `<span class="portal-person__github portal-person__github--empty" aria-hidden="true">no github</span>`;

    return `<li class="portal-person" data-portal-tone="${tone}" style="--portal-tone:${hex};">
      <a class="portal-person__link" href="${profileHref}" aria-label="${escapeHtml(p.displayName)} — open profile">
        <span class="portal-person__avatar-wrap" aria-hidden="true">
          <img class="portal-person__avatar" src="${photoHref}" width="88" height="88" alt="" />
        </span>
        <div class="portal-person__body">
          <h3 class="portal-person__name">${escapeHtml(p.displayName)}</h3>
          <div class="portal-person__roles">${rolesInner}</div>
        </div>
      </a>
      <div class="portal-person__foot">
        ${githubHtml}
        <a class="portal-person__open" href="${profileHref}" aria-label="Open ${escapeHtml(p.displayName)} profile">Open profile ${portalArrowIcon()}</a>
      </div>
    </li>`;
  }

  function renderPortalPeopleGallery() {
    const mount = document.getElementById("portal-people-gallery-mount");
    if (!mount) {
      return;
    }
    const data = window.__DOCS_PORTAL_DATA__ || {};
    const people = Array.isArray(data.people) ? data.people : [];
    const maintainerPages = data.maintainerPages || {};
    const relPath = currentDocsRelPath();
    const fromDir = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";
    const presentKeys = collectGroupKeysPresent(people);
    const groupEntries = orderedPortalGroupEntries(presentKeys);
    if (groupEntries.length === 0) {
      mount.innerHTML = `<p class="portal-people-group__empty">No profiles with <code>data-groups</code> under <code>docs/internal/portal/people/</code> yet. Run <code>make docs-fix</code> after editing profiles.</p>`;
      return;
    }
    let totalPages = 0;
    for (let i = 0; i < people.length; i += 1) {
      totalPages += portalPagesFor(maintainerPages, people[i].personId).length;
    }
    const blocks = groupEntries
      .map((g) => {
        const gid = portalGroupDomId(g.key);
        const inGroup = people
          .filter((p) => Array.isArray(p.groups) && p.groups.includes(g.key))
          .slice()
          .sort((a, b) => {
            const ap = portalPagesFor(maintainerPages, a.personId).length;
            const bp = portalPagesFor(maintainerPages, b.personId).length;
            if (ap !== bp) return bp - ap;
            return String(a.displayName || "").localeCompare(String(b.displayName || ""));
          });
        const tone = PORTAL_TONE_BY_GROUP[g.key] || "mono";
        const hex = PORTAL_TONE_HEX[tone];
        const cards = inGroup
          .map((p) => renderPortalPersonCard(p, maintainerPages, fromDir, totalPages))
          .join("");
        return `<section class="portal-strip" data-portal-tone="${tone}" style="--portal-tone:${hex};" aria-labelledby="portal-strip-${gid}">
          <header class="portal-strip__head">
            <p class="portal-strip__eyebrow" id="portal-strip-${gid}">${escapeHtml(g.title)}</p>
            <hr class="portal-strip__rule" />
            <span class="portal-strip__count">${inGroup.length} ${inGroup.length === 1 ? "person" : "people"}</span>
          </header>
          <ul class="portal-strip__grid">${cards}</ul>
        </section>`;
      })
      .join("");
    mount.innerHTML = blocks;
  }

  function renderPortalCoverage() {
    const mount = document.getElementById("portal-coverage-mount");
    if (!mount) {
      return;
    }
    const data = window.__DOCS_PORTAL_DATA__ || {};
    const people = Array.isArray(data.people) ? data.people : [];
    const maintainerPages = data.maintainerPages || {};
    const entries = people
      .map((p) => ({
        person: p,
        count: portalPagesFor(maintainerPages, p.personId).length,
        tone: portalToneForPerson(p),
      }))
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count);
    const total = entries.reduce((acc, e) => acc + e.count, 0);
    if (entries.length === 0 || total === 0) {
      mount.innerHTML = "";
      return;
    }
    const segments = entries
      .map((e) => {
        const pct = (e.count / total) * 100;
        const hex = PORTAL_TONE_HEX[e.tone];
        return `<span class="portal-coverage__seg" style="width:${pct}%; background:${hex};" title="${escapeHtml(e.person.displayName)} — ${e.count} pages (${Math.round(pct)}%)"></span>`;
      })
      .join("");
    const legend = entries
      .map((e) => {
        const pct = Math.round((e.count / total) * 100);
        const hex = PORTAL_TONE_HEX[e.tone];
        return `<li class="portal-coverage__legend-item">
          <span class="portal-coverage__swatch" style="background:${hex};" aria-hidden="true"></span>
          <span class="portal-coverage__legend-name">${escapeHtml(e.person.displayName)}</span>
          <span class="portal-coverage__legend-num"><strong>${e.count}</strong> · ${pct}%</span>
        </li>`;
      })
      .join("");
    mount.innerHTML = `<div class="portal-coverage__bar" role="img" aria-label="Documentation ownership distribution">${segments}</div>
      <ul class="portal-coverage__legend">${legend}</ul>`;
  }

  function renderPortalGallery() {
    const heroPresent = document.getElementById("portal-people-gallery-mount");
    if (!heroPresent) {
      return;
    }
    const data = window.__DOCS_PORTAL_DATA__ || {};
    const people = Array.isArray(data.people) ? data.people : [];
    const maintainerPages = data.maintainerPages || {};
    let totalPages = 0;
    let topPerson = null;
    let topCount = -1;
    for (let i = 0; i < people.length; i += 1) {
      const own = portalPagesFor(maintainerPages, people[i].personId);
      totalPages += own.length;
      if (own.length > topCount) {
        topCount = own.length;
        topPerson = people[i];
      }
    }
    const totals = {
      people: people.length,
      pages: totalPages,
      groups: collectGroupKeysPresent(people).size,
    };
    paintPortalTickers(totals);

    const relPath = currentDocsRelPath();
    const fromDir = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";
    renderPortalSpotlight(topPerson, { pageCount: totalPages, peopleCount: people.length }, fromDir);
    renderPortalPeopleGallery();
    renderPortalCoverage();
  }

  function initDocsInternalMeta() {
    renderProfileMaintainedMount();
    renderPageMeta();
    renderPortalPeople();
    renderPortalGallery();
  }

  window.initDocsInternalMeta = initDocsInternalMeta;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDocsInternalMeta);
  } else {
    initDocsInternalMeta();
  }
})();
