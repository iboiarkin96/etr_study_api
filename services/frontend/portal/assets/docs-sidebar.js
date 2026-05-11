"use strict";

/**
 * Shared sidebar runtime for the public and internal portals.
 *
 * Exposes `window.DocsSidebar.createSidebar(config)` — both portals call this
 * with their own navigation tree, CSS prefixes, storage keys, and chrome hooks.
 * The behavior (path resolution, tree renderer, collapse toggle, drawer state
 * machine, active-item scroll) is identical across portals; only the visual
 * elements (wordmark, footer link, icons, color tokens) differ via config.
 *
 * Per ADR 0030 the layout chrome lives in docs-shell.css (token contract);
 * this module owns the navigation runtime that drives that chrome.
 *
 * ── CONFIG contract (locked; both portal sidebars must conform) ──────────
 *   navData              — Array<NavNode>. See NavNode shape below.
 *   treePrefix           — BEM prefix for tree class names (e.g. "internal-sidebar")
 *   layoutPrefix         — BEM prefix for layout class names (e.g. "internal-layout")
 *   mountId              — id of the <div> that hosts the rendered sidebar
 *   sidebarSelector      — CSS selector for the enclosing <aside>
 *   shellSelector        — CSS selector for the layout shell wrapper
 *   storageKey           — localStorage key for collapsed/expanded preference
 *   navAriaLabel         — aria-label on the generated <nav>
 *   defaultRelPath       — fallback docs-root-relative path
 *   docsRootFirstSegments— Array<string> of first path segments rooted at docs/
 *   supportsIcons        — boolean; if true, NavNode.icon is rendered
 *   supportsLabelHtml    — boolean; if true, NavNode.labelHtml renders raw HTML
 *   shouldOpenGroup      — (optional) (node, currentPath) => boolean. Default:
 *                          navHasActiveChild — opens a group when any descendant
 *                          matches the current path. Portal-specific override
 *                          discouraged; prefer the `expand` keyword on the node
 *                          (currently supported: "on-descendant" — explicit
 *                          opt-in for the default behavior, used as a marker).
 *   activeScrollBlock    — "center" | "start" | "end"; scroll alignment for active
 *   collapseToggle       — { hideTitleSelector?, hideHostOnCollapse, toggleLabelText,
 *                            tooltipOnCollapse, dataAttr }
 *   drawer               — { id, title, drawerModeShellClass, toggleEventName, ... }
 *   beforeRenderTree(ctx)— optional hook; runs before the <nav> is appended.
 *   afterRenderTree(ctx) — optional hook; runs after the <nav> is appended.
 *
 * ── NavNode shape ────────────────────────────────────────────────────────
 *   Leaf:    { label | labelHtml, path, icon? }
 *   Group:   { label | labelHtml, children: NavNode[], icon?, expand? }
 *   Section: { kind: "section", label }   — non-clickable visual header
 *   Legacy separator: { separator: true } — retained for backwards compatibility
 */
(function () {
  if (window.DocsSidebar) return;

  /* ── Path utilities ───────────────────────────────────────────────────── */

  function normalizeParts(parts) {
    const out = [];
    for (const p of parts) {
      if (!p || p === ".") continue;
      if (p === "..") {
        if (out.length) out.pop();
        continue;
      }
      out.push(p);
    }
    return out;
  }

  function relHref(fromDir, targetRelPath) {
    const from = normalizeParts(fromDir.split("/"));
    const to = normalizeParts(targetRelPath.split("/"));
    let i = 0;
    while (i < from.length && i < to.length && from[i] === to[i]) i += 1;
    const up = new Array(from.length - i).fill("..");
    const down = to.slice(i);
    return [...up, ...down].join("/") || ".";
  }

  function normalizePath(p) {
    return normalizeParts(p.split("/")).join("/");
  }

  function pathIsActive(current, target) {
    return normalizePath(current) === normalizePath(target);
  }

  function navHasActiveChild(node, currentPath) {
    if (node.path && pathIsActive(currentPath, node.path)) return true;
    if (!node.children) return false;
    return node.children.some((c) => navHasActiveChild(c, currentPath));
  }

  function makeCurrentDocsRelPath(opts) {
    const rootMarkers = opts.rootMarkers || ["/services/portal/", "/docs/"];
    const knownFirstSegments = new Set(opts.docsRootFirstSegments || []);
    const defaultPath = opts.defaultRelPath || "index.html";
    return function currentDocsRelPath() {
      const path = window.location.pathname.replace(/\\/g, "/");
      for (const marker of rootMarkers) {
        const idx = path.indexOf(marker);
        if (idx >= 0) return path.slice(idx + marker.length);
      }
      const parts = path.split("/").filter(Boolean);
      if (!parts.length) return defaultPath;
      if (knownFirstSegments.has(parts[0])) return parts.join("/");
      return parts.length >= 2 ? parts.slice(1).join("/") : (parts[0] || defaultPath);
    };
  }

  /* ── Toggle SVGs (panel-open / panel-close glyphs) ───────────────────── */

  const SVG_PANEL_OPEN =
    '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor"' +
    ' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="1" y="2" width="18" height="16" rx="2"/>' +
    '<line x1="7" y1="2" x2="7" y2="18"/>' +
    '<polyline points="11,7 14.5,10 11,13"/></svg>';

  const SVG_PANEL_CLOSE =
    '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor"' +
    ' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="1" y="2" width="18" height="16" rx="2"/>' +
    '<line x1="7" y1="2" x2="7" y2="18"/>' +
    '<polyline points="12,7 8.5,10 12,13"/></svg>';

  /* ── Tree renderer ────────────────────────────────────────────────────── */

  function makeRenderTree(config) {
    const treePrefix = config.treePrefix; /* e.g. "internal-sidebar" */
    const supportsIcons = config.supportsIcons !== false;
    const supportsLabelHtml = config.supportsLabelHtml !== false;
    const shouldOpenGroup =
      config.shouldOpenGroup ||
      function (node, currentPath) {
        return navHasActiveChild(node, currentPath);
      };

    function renderTree(nodes, fromDir, currentPath) {
      const ul = document.createElement("ul");
      ul.className = treePrefix + "__tree";

      for (const node of nodes) {
        const li = document.createElement("li");

        if (node.kind === "section") {
          li.className = treePrefix + "__section";
          li.setAttribute("role", "presentation");
          const span = document.createElement("span");
          span.className = treePrefix + "__section-label";
          span.textContent = node.label;
          li.appendChild(span);
        } else if (node.separator) {
          li.className = treePrefix + "__separator";
          li.setAttribute("role", "presentation");
          const hr = document.createElement("hr");
          hr.setAttribute("aria-hidden", "true");
          li.appendChild(hr);
        } else if (node.children && node.children.length) {
          const details = document.createElement("details");
          details.className = treePrefix + "__group";
          if (shouldOpenGroup(node, currentPath)) details.open = true;

          const summary = document.createElement("summary");
          summary.className = treePrefix + "__summary";
          if (supportsIcons && node.icon) {
            const iconSpan = document.createElement("span");
            iconSpan.setAttribute("aria-hidden", "true");
            iconSpan.textContent = node.icon + "  ";
            summary.appendChild(iconSpan);
          }
          if (supportsLabelHtml && node.labelHtml) {
            const span = document.createElement("span");
            span.innerHTML = node.labelHtml;
            summary.appendChild(span);
          } else {
            summary.appendChild(document.createTextNode(node.label));
          }
          details.appendChild(summary);
          details.appendChild(renderTree(node.children, fromDir, currentPath));
          li.appendChild(details);
        } else {
          const a = document.createElement("a");
          a.href = relHref(fromDir, node.path);
          if (supportsLabelHtml && node.labelHtml) {
            a.innerHTML = node.labelHtml;
          } else {
            a.textContent = node.label;
          }
          if (pathIsActive(currentPath, node.path)) {
            a.classList.add("is-active");
            a.setAttribute("aria-current", "page");
          }
          li.appendChild(a);
        }

        ul.appendChild(li);
      }
      return ul;
    }

    return renderTree;
  }

  /* ── Collapse toggle (desktop) ───────────────────────────────────────── */

  function ensureCollapseToggle(ctx) {
    const { sidebar, sidebarHost, shell, config } = ctx;
    if (!sidebar || !sidebarHost || !shell) return null;

    const toggleConfig = config.collapseToggle || {};
    const storageKey = config.storageKey;

    function readPref() {
      try {
        return window.localStorage.getItem(storageKey) === "1";
      } catch {
        return false;
      }
    }
    function writePref(v) {
      try {
        window.localStorage.setItem(storageKey, v ? "1" : "0");
      } catch {
        /* storage may be unavailable — toggle still works for the session */
      }
    }

    if (toggleConfig.hideTitleSelector) {
      const title = sidebar.querySelector(toggleConfig.hideTitleSelector);
      if (title) title.hidden = true;
    }

    const dataAttr = toggleConfig.dataAttr || "data-docs-sidebar-toggle";
    let toggle = sidebar.querySelector("[" + dataAttr + "]");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = toggleConfig.toggleClass || (config.layoutPrefix + "__sidebar-toggle");
      toggle.setAttribute(dataAttr, "1");
      const insertAfter = toggleConfig.hideTitleSelector
        ? sidebar.querySelector(toggleConfig.hideTitleSelector)
        : null;
      if (insertAfter) {
        insertAfter.insertAdjacentElement("afterend", toggle);
      } else {
        sidebar.insertBefore(toggle, sidebarHost);
      }
    }

    if (!sidebarHost.id) sidebarHost.id = config.mountId;
    toggle.setAttribute("aria-controls", sidebarHost.id);

    const labelText = toggleConfig.toggleLabelText || "Hide";
    const labelClass =
      toggleConfig.toggleLabelClass || (config.layoutPrefix + "__sidebar-toggle__label");
    const hideHostOnCollapse = toggleConfig.hideHostOnCollapse !== false;

    function applyCollapsedState(isCollapsed) {
      shell.classList.toggle("is-sidebar-collapsed", isCollapsed);
      if (hideHostOnCollapse) sidebarHost.hidden = isCollapsed;
      toggle.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
      toggle.setAttribute("aria-label", isCollapsed ? "Show navigation" : "Hide navigation");
      toggle.title = "";
      if (toggleConfig.tooltipOnCollapse) {
        if (isCollapsed) toggle.setAttribute("data-tooltip", "Show navigation");
        else toggle.removeAttribute("data-tooltip");
      }
      toggle.innerHTML = isCollapsed
        ? SVG_PANEL_OPEN
        : SVG_PANEL_CLOSE + '<span class="' + labelClass + '">' + labelText + "</span>";
    }

    let isCollapsed = readPref();
    applyCollapsedState(isCollapsed);
    toggle.addEventListener("click", () => {
      isCollapsed = !isCollapsed;
      applyCollapsedState(isCollapsed);
      writePref(isCollapsed);
    });

    return { toggle, applyCollapsedState, readPref };
  }

  /* ── Drawer (mobile + tablet) ────────────────────────────────────────── */

  function ensureDrawer(ctx) {
    const { sidebar, shell, config, collapseCtl } = ctx;
    if (!sidebar || !shell) return;

    const drawerConfig = config.drawer || {};
    const phoneMaxWidth = drawerConfig.phoneMaxWidth || 760;
    const drawerMaxWidth = drawerConfig.drawerMaxWidth || 1024;

    const drawerMedia = window.matchMedia(`(max-width: ${drawerMaxWidth}px)`);
    const phoneMedia = window.matchMedia(`(max-width: ${phoneMaxWidth}px)`);

    let isOpen = false;
    let lastLauncherFocus = null;

    const drawerId = drawerConfig.id;
    const drawerClass = drawerConfig.drawerClass || (config.layoutPrefix + "__drawer");
    const drawerTitleId = drawerId + "-title";

    let drawerRoot = document.getElementById(drawerId);
    if (!drawerRoot) {
      drawerRoot = document.createElement("div");
      drawerRoot.id = drawerId;
      drawerRoot.className = drawerClass;
      drawerRoot.setAttribute("role", "dialog");
      drawerRoot.setAttribute("aria-modal", "true");
      drawerRoot.setAttribute("aria-labelledby", drawerTitleId);
      drawerRoot.setAttribute("hidden", "");

      const backdrop = document.createElement("button");
      backdrop.type = "button";
      backdrop.className = drawerClass + "-backdrop";
      backdrop.setAttribute("aria-label", "Close navigation menu");

      const panel = document.createElement("div");
      panel.className = drawerClass + "-panel";

      const header = document.createElement("div");
      header.className = drawerClass + "-header";

      const title = document.createElement("p");
      title.id = drawerTitleId;
      title.className = drawerClass + "-title";
      title.textContent = drawerConfig.title || "Navigation";

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = drawerClass + "-close";
      closeBtn.setAttribute("aria-label", "Close navigation menu");
      closeBtn.textContent = "Close";

      const body = document.createElement("div");
      body.className = drawerClass + "-body";

      header.appendChild(title);
      header.appendChild(closeBtn);
      panel.appendChild(header);
      panel.appendChild(body);
      drawerRoot.appendChild(backdrop);
      drawerRoot.appendChild(panel);
      document.body.appendChild(drawerRoot);

      backdrop.addEventListener("click", () => closeDrawer());
      closeBtn.addEventListener("click", () => closeDrawer());
    }

    const drawerBody = drawerRoot.querySelector("." + drawerClass + "-body");
    const drawerPanel = drawerRoot.querySelector("." + drawerClass + "-panel");

    if (!sidebar.id) sidebar.id = config.layoutPrefix + "-sidebar-drawer";

    function inDrawerMode() {
      return drawerMedia.matches;
    }

    function syncDrawerNavFromSource() {
      const sourceNav = sidebar.querySelector("nav");
      if (!sourceNav || !drawerBody) return;
      drawerBody.replaceChildren(sourceNav.cloneNode(true));
    }

    function applyDrawerState(nextOpen) {
      const active = inDrawerMode();
      const open = active && nextOpen;
      isOpen = open;

      if (drawerConfig.drawerModeShellClass) {
        shell.classList.toggle(drawerConfig.drawerModeShellClass, active);
      }
      if (drawerConfig.bodyClassOnOpen) {
        document.body.classList.toggle(drawerConfig.bodyClassOnOpen, open);
      } else if (drawerConfig.inlineScrollLock) {
        document.body.style.overflow = open ? "hidden" : "";
      }

      if (collapseCtl) {
        if (active) {
          collapseCtl.applyCollapsedState(false);
          collapseCtl.toggle.hidden = true;
        } else {
          collapseCtl.applyCollapsedState(collapseCtl.readPref());
          collapseCtl.toggle.hidden = false;
        }
      }

      if (open) {
        syncDrawerNavFromSource();
        drawerRoot.removeAttribute("hidden");
        drawerRoot.classList.add("is-open");
      } else {
        drawerRoot.classList.remove("is-open");
        drawerRoot.setAttribute("hidden", "");
      }

      if (drawerConfig.stateEventName) {
        document.dispatchEvent(
          new CustomEvent(drawerConfig.stateEventName, {
            detail: { open, drawerMode: active, drawerId: drawerRoot.id },
          }),
        );
      }
    }

    function openDrawer() {
      applyDrawerState(true);
      const firstFocusable = drawerPanel
        ? drawerPanel.querySelector("a, button, summary")
        : null;
      if (firstFocusable && typeof firstFocusable.focus === "function") {
        firstFocusable.focus();
      }
    }

    function closeDrawer() {
      applyDrawerState(false);
      if (
        drawerConfig.focusRestore !== false &&
        lastLauncherFocus &&
        typeof lastLauncherFocus.focus === "function"
      ) {
        lastLauncherFocus.focus();
      }
    }

    function toggleDrawer() {
      if (!inDrawerMode()) return;
      if (isOpen) closeDrawer();
      else openDrawer();
    }

    /* Transient surface — every page load starts closed regardless of viewport. */
    function syncForViewport() {
      if (!inDrawerMode() && drawerConfig.drawerModeShellClass) {
        shell.classList.remove(drawerConfig.drawerModeShellClass);
      }
      closeDrawer();
    }

    if (drawerBody && !drawerBody.__docsSidebarNavBound) {
      drawerBody.__docsSidebarNavBound = true;
      drawerBody.addEventListener("click", (event) => {
        const target = event.target;
        const link = target && target.closest ? target.closest("a[href]") : null;
        if (!link || !inDrawerMode() || !isOpen) return;
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const href = link.getAttribute("href");
        if (!href || href.startsWith("#")) return;
        event.preventDefault();
        closeDrawer();
        window.location.assign(link.href);
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen) closeDrawer();
    });

    if (drawerConfig.toggleEventName) {
      document.addEventListener(drawerConfig.toggleEventName, () => {
        lastLauncherFocus = document.activeElement;
        toggleDrawer();
      });
    }

    if (drawerConfig.openEventName) {
      document.addEventListener(drawerConfig.openEventName, () => {
        lastLauncherFocus = document.activeElement;
        openDrawer();
      });
    }

    drawerMedia.addEventListener("change", syncForViewport);
    phoneMedia.addEventListener("change", syncForViewport);
    syncForViewport();

    /* Optional menu button — auto-injected when in drawer mode. */
    const menuBtn = drawerConfig.menuButton;
    if (menuBtn) {
      function injectMenuButton() {
        const container = document.querySelector(menuBtn.containerSelector);
        if (!container) return;
        if (container.querySelector("." + menuBtn.btnClass)) return;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = menuBtn.btnClass;
        btn.setAttribute("aria-label", "Open navigation menu");
        btn.innerHTML = menuBtn.btnHtml;
        btn.addEventListener("click", () => {
          const evtName = menuBtn.dispatchEventName || drawerConfig.openEventName;
          if (evtName) document.dispatchEvent(new CustomEvent(evtName));
        });

        if (menuBtn.beforeNode) {
          const ref = container.querySelector(menuBtn.beforeNode);
          if (ref) {
            ref.insertAdjacentElement("afterend", btn);
            return;
          }
        }
        container.prepend(btn);
      }

      if (drawerMedia.matches) injectMenuButton();
      drawerMedia.addEventListener("change", () => {
        if (drawerMedia.matches) injectMenuButton();
      });
    }
  }

  /* ── Public factory ──────────────────────────────────────────────────── */

  function createSidebar(config) {
    const renderTree = makeRenderTree({
      treePrefix: config.treePrefix,
      supportsIcons: config.supportsIcons,
      supportsLabelHtml: config.supportsLabelHtml,
      shouldOpenGroup: config.shouldOpenGroup,
    });
    const currentDocsRelPath = makeCurrentDocsRelPath({
      rootMarkers: config.rootMarkers,
      docsRootFirstSegments: config.docsRootFirstSegments,
      defaultRelPath: config.defaultRelPath,
    });

    function mount() {
      const host = document.getElementById(config.mountId);
      if (!host) return;

      const sidebar = host.closest(config.sidebarSelector);
      const shell = document.querySelector(config.shellSelector);
      const relPath = currentDocsRelPath();
      const fromDir = relPath.includes("/")
        ? relPath.slice(0, relPath.lastIndexOf("/"))
        : "";

      const ctx = { host, sidebar, shell, relPath, fromDir, config };

      /* Idempotent mount: clear any prior render before chrome + tree. */
      host.replaceChildren();

      if (typeof config.beforeRenderTree === "function") {
        config.beforeRenderTree(ctx);
      }

      const nav = document.createElement("nav");
      nav.className = (config.treePrefix || "docs-sidebar") + "__nav";
      nav.setAttribute("aria-label", config.navAriaLabel || "Documentation");
      nav.appendChild(renderTree(config.navData, fromDir, relPath));
      host.appendChild(nav);

      if (typeof config.afterRenderTree === "function") {
        config.afterRenderTree(ctx);
      }

      const activeScrollBlock = config.activeScrollBlock || "center";
      requestAnimationFrame(() => {
        const active = host.querySelector("a.is-active");
        if (active && typeof active.scrollIntoView === "function") {
          active.scrollIntoView({
            block: activeScrollBlock,
            inline: "nearest",
            behavior: "auto",
          });
        }
      });

      const collapseCtl = ensureCollapseToggle({ sidebar, sidebarHost: host, shell, config });
      ensureDrawer({ sidebar, shell, config, collapseCtl });
    }

    return { mount };
  }

  /* ── Bootstrap from a script tag config (optional) ───────────────────── */

  function autoMount() {
    const tag = document.querySelector("script[data-docs-sidebar-config]");
    if (!tag) return;
    try {
      const cfg = JSON.parse(tag.getAttribute("data-docs-sidebar-config"));
      createSidebar(cfg).mount();
    } catch (err) {
      /* malformed inline config — log to console and bail */
      // eslint-disable-next-line no-console
      console.error("[docs-sidebar] failed to parse data-docs-sidebar-config", err);
    }
  }

  window.DocsSidebar = {
    createSidebar,
    pathUtils: {
      normalizeParts,
      relHref,
      normalizePath,
      pathIsActive,
      navHasActiveChild,
      makeCurrentDocsRelPath,
    },
    constants: { SVG_PANEL_OPEN, SVG_PANEL_CLOSE },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    autoMount();
  }
})();
