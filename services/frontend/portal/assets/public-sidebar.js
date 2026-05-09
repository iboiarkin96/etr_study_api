"use strict";

/**
 * Left navigation sidebar for the public developer documentation.
 * Serves services/portal/public/** pages exclusively — no internal links.
 *
 * Paths are relative to the services/portal/ root (same convention as
 * internal-sidebar.js). The sidebar is the primary navigation surface for
 * the standalone public portal.
 */
(function () {
  const PHONE_MAX_WIDTH = 760;
  const DRAWER_MAX_WIDTH = 1024;
  const PUBLIC_SIDEBAR_COLLAPSED_STORAGE_KEY = "docs.public.sidebar.collapsed";

  /* ── Navigation tree ──────────────────────────────────────────────────── */

  const PUBLIC_NAV = [
    { label: "⌂  ETR Study API", path: "public/index.html" },
    { separator: true },
    {
      label: "Tutorials",
      icon: "📖",
      children: [
        { label: "All tutorials", path: "public/tutorials/index.html" },
        { label: "First API call", path: "public/tutorials/first-api-call.html" },
      ],
    },
    {
      label: "How-to guides",
      icon: "🛠",
      children: [
        { label: "All how-to guides", path: "public/how-to/index.html" },
        { label: "Authenticate", path: "public/how-to/authenticate.html" },
        { label: "Handle errors", path: "public/how-to/handle-errors.html" },
        { label: "Handle idempotency", path: "public/how-to/handle-idempotency.html" },
      ],
    },
    {
      label: "Reference",
      icon: "📋",
      children: [
        { label: "Reference hub", path: "public/reference/index.html" },
        { label: "API reference / Swagger UI", path: "public/reference/api/index.html" },
        { label: "Error catalogue", path: "public/reference/errors/index.html" },
        { label: "Environment variables", path: "public/reference/env-vars/index.html" },
      ],
    },
    {
      label: "Explanation",
      icon: "💡",
      children: [
        { label: "All explanations", path: "public/explanation/index.html" },
        { label: "Architecture overview", path: "public/explanation/architecture.html" },
        { label: "API versioning", path: "public/explanation/api-versioning.html" },
        { label: "Security model", path: "public/explanation/security-model.html" },
        { label: "SLO & error budget", path: "public/explanation/slo-error-budget.html" },
      ],
    },
  ];

  /* ── Path utilities ───────────────────────────────────────────────────── */

  function normalizeParts(parts) {
    const out = [];
    for (const p of parts) {
      if (!p || p === ".") continue;
      if (p === "..") { if (out.length) out.pop(); continue; }
      out.push(p);
    }
    return out;
  }

  function relHref(fromDir, targetRelPath) {
    const from = normalizeParts(fromDir.split("/"));
    const to = normalizeParts(targetRelPath.split("/"));
    let i = 0;
    while (i < from.length && i < to.length && from[i] === to[i]) i++;
    return [...new Array(from.length - i).fill(".."), ...to.slice(i)].join("/") || ".";
  }

  function currentDocsRelPath() {
    const path = window.location.pathname.replace(/\\/g, "/");
    for (const marker of ["/services/portal/", "/docs/"]) {
      const idx = path.indexOf(marker);
      if (idx >= 0) return path.slice(idx + marker.length);
    }
    const parts = path.split("/").filter(Boolean);
    if (!parts.length) return "public/index.html";
    const knownRoots = new Set(["public", "internal", "index.html"]);
    if (knownRoots.has(parts[0])) return parts.join("/");
    return parts.length >= 2 ? parts.slice(1).join("/") : (parts[0] || "public/index.html");
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

  /* ── Tree renderer ────────────────────────────────────────────────────── */

  function renderTree(nodes, fromDir, currentPath) {
    const ul = document.createElement("ul");
    ul.className = "public-sidebar__tree";

    for (const node of nodes) {
      const li = document.createElement("li");

      if (node.separator) {
        li.className = "public-sidebar__separator";
        li.setAttribute("role", "presentation");
        const hr = document.createElement("hr");
        hr.setAttribute("aria-hidden", "true");
        li.appendChild(hr);
      } else if (node.children && node.children.length) {
        const details = document.createElement("details");
        details.className = "public-sidebar__group";
        if (navHasActiveChild(node, currentPath)) details.open = true;

        const summary = document.createElement("summary");
        summary.className = "public-sidebar__summary";
        if (node.icon) {
          const iconSpan = document.createElement("span");
          iconSpan.setAttribute("aria-hidden", "true");
          iconSpan.textContent = node.icon + "  ";
          summary.appendChild(iconSpan);
        }
        summary.appendChild(document.createTextNode(node.label));
        details.appendChild(summary);
        details.appendChild(renderTree(node.children, fromDir, currentPath));
        li.appendChild(details);
      } else {
        const a = document.createElement("a");
        a.href = relHref(fromDir, node.path);
        a.textContent = node.label;
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

  /* ── Sidebar wordmark ─────────────────────────────────────────────────── */

  function buildWordmark(fromDir) {
    const a = document.createElement("a");
    a.href = relHref(fromDir, "public/index.html");
    a.className = "public-sidebar__wordmark";
    a.setAttribute("aria-label", "ETR Study API — home");

    const product = document.createElement("span");
    product.className = "public-sidebar__product";
    product.innerHTML = 'ETR <span class="public-sidebar__product-accent">Study API</span>';

    const tagline = document.createElement("span");
    tagline.className = "public-sidebar__tagline";
    tagline.textContent = "Developer Documentation";

    a.appendChild(product);
    a.appendChild(tagline);
    return a;
  }

  /* ── Desktop collapse toggle ──────────────────────────────────────────── */

  function readSidebarCollapsedPreference() {
    try {
      return window.localStorage.getItem(PUBLIC_SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function persistSidebarCollapsedPreference(isCollapsed) {
    try {
      window.localStorage.setItem(PUBLIC_SIDEBAR_COLLAPSED_STORAGE_KEY, isCollapsed ? "1" : "0");
    } catch {
      /* localStorage may be unavailable; toggle still works for the session */
    }
  }

  function ensureSidebarCollapseToggle(shell, sidebarHost) {
    if (!shell || !sidebarHost) return;
    const sidebar = shell.querySelector(".public-layout__sidebar");
    if (!sidebar) return;

    let toggle = sidebar.querySelector("[data-public-sidebar-toggle]");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "public-layout__sidebar-toggle";
      toggle.setAttribute("data-public-sidebar-toggle", "1");
      if (!sidebarHost.id) sidebarHost.id = "public-sidebar-mount";
      toggle.setAttribute("aria-controls", sidebarHost.id);
      sidebar.insertBefore(toggle, sidebar.firstChild);
    }

    const SVG_OPEN = '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="2" width="18" height="16" rx="2"/><line x1="7" y1="2" x2="7" y2="18"/><polyline points="11,7 14.5,10 11,13"/></svg>';
    const SVG_CLOSE = '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="2" width="18" height="16" rx="2"/><line x1="7" y1="2" x2="7" y2="18"/><polyline points="12,7 8.5,10 12,13"/></svg>';

    function applyCollapsedState(isCollapsed) {
      shell.classList.toggle("is-sidebar-collapsed", isCollapsed);
      toggle.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
      toggle.setAttribute("aria-label", isCollapsed ? "Show navigation" : "Hide navigation");
      toggle.innerHTML = isCollapsed
        ? SVG_OPEN
        : SVG_CLOSE + '<span class="public-layout__sidebar-toggle__label">Hide</span>';
    }

    let isCollapsed = readSidebarCollapsedPreference();
    applyCollapsedState(isCollapsed);
    toggle.addEventListener("click", () => {
      isCollapsed = !isCollapsed;
      applyCollapsedState(isCollapsed);
      persistSidebarCollapsedPreference(isCollapsed);
    });
  }

  /* ── Drawer (mobile) ─────────────────────────────────────────────────── */

  function ensureDrawer(shell, navTree) {
    let drawerRoot = document.getElementById("public-docs-drawer");
    if (!drawerRoot) {
      drawerRoot = document.createElement("div");
      drawerRoot.id = "public-docs-drawer";
      drawerRoot.className = "public-layout__drawer";
      drawerRoot.setAttribute("role", "dialog");
      drawerRoot.setAttribute("aria-modal", "true");
      drawerRoot.setAttribute("aria-labelledby", "public-docs-drawer-title");
      drawerRoot.setAttribute("hidden", "");

      const backdrop = document.createElement("button");
      backdrop.type = "button";
      backdrop.className = "public-layout__drawer-backdrop";
      backdrop.setAttribute("aria-label", "Close navigation menu");

      const panel = document.createElement("div");
      panel.className = "public-layout__drawer-panel";

      const header = document.createElement("div");
      header.className = "public-layout__drawer-header";

      const title = document.createElement("p");
      title.id = "public-docs-drawer-title";
      title.className = "public-layout__drawer-title";
      title.textContent = "Navigation";

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "public-layout__drawer-close";
      closeBtn.setAttribute("aria-label", "Close navigation menu");
      closeBtn.textContent = "Close";

      const body = document.createElement("div");
      body.className = "public-layout__drawer-body";

      header.appendChild(title);
      header.appendChild(closeBtn);
      panel.appendChild(header);
      panel.appendChild(body);
      drawerRoot.appendChild(backdrop);
      drawerRoot.appendChild(panel);
      document.body.appendChild(drawerRoot);

      function closeDrawer() {
        drawerRoot.classList.remove("is-open");
        drawerRoot.setAttribute("hidden", "");
        document.body.style.overflow = "";
      }

      function openDrawer() {
        const cloned = navTree.cloneNode(true);
        body.replaceChildren(cloned);
        drawerRoot.removeAttribute("hidden");
        drawerRoot.classList.add("is-open");
        document.body.style.overflow = "hidden";
        const firstFocusable = panel.querySelector("a, button, summary");
        if (firstFocusable) firstFocusable.focus();
      }

      backdrop.addEventListener("click", closeDrawer);
      closeBtn.addEventListener("click", closeDrawer);

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && drawerRoot.classList.contains("is-open")) closeDrawer();
      });

      /* Close drawer on link navigation */
      body.addEventListener("click", (e) => {
        const link = e.target && e.target.closest ? e.target.closest("a[href]") : null;
        if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
        const href = link.getAttribute("href");
        if (!href || href.startsWith("#")) return;
        e.preventDefault();
        closeDrawer();
        window.location.assign(link.href);
      });

      document.addEventListener("public-sidebar:open-drawer", openDrawer);
    }
  }

  function injectMenuButton() {
    const main = document.querySelector(".public-layout__main .container");
    if (!main) return;
    if (main.querySelector(".public-layout__menu-btn")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "public-layout__menu-btn";
    btn.setAttribute("aria-label", "Open navigation menu");
    btn.innerHTML = '<span aria-hidden="true">☰</span> Menu';
    btn.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("public-sidebar:open-drawer"));
    });

    const topNav = main.querySelector("#docs-top-nav");
    if (topNav) {
      topNav.insertAdjacentElement("afterend", btn);
    } else {
      main.prepend(btn);
    }
  }

  /* ── Mount ────────────────────────────────────────────────────────────── */

  function mount() {
    const host = document.getElementById("public-sidebar-mount");
    if (!host) return;

    const relPath = currentDocsRelPath();
    const fromDir = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";
    const shell = document.querySelector(".public-layout__shell");

    /* Wordmark */
    host.appendChild(buildWordmark(fromDir));

    /* Nav tree */
    const navWrapper = document.createElement("nav");
    navWrapper.className = "public-sidebar__nav";
    navWrapper.setAttribute("aria-label", "Public documentation");
    const tree = renderTree(PUBLIC_NAV, fromDir, relPath);
    navWrapper.appendChild(tree);
    host.appendChild(navWrapper);

    /* Footer link */
    const footer = document.createElement("div");
    footer.className = "public-sidebar__footer";
    const footerLink = document.createElement("a");
    footerLink.className = "public-sidebar__footer-link";
    footerLink.href = relHref(fromDir, "public/reference/api/index.html");
    footerLink.innerHTML = '<span aria-hidden="true">◎</span> Open API Explorer';
    footer.appendChild(footerLink);
    host.appendChild(footer);

    /* Scroll active item into view */
    requestAnimationFrame(() => {
      const active = host.querySelector("a.is-active");
      if (active && typeof active.scrollIntoView === "function") {
        active.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    });

    /* Desktop collapse toggle (persisted in localStorage) */
    ensureSidebarCollapseToggle(shell, host);

    /* Drawer + mobile menu button */
    const drawerMedia = window.matchMedia(`(max-width: ${DRAWER_MAX_WIDTH}px)`);
    if (drawerMedia.matches) {
      injectMenuButton();
    }
    ensureDrawer(shell, navWrapper.cloneNode(true));
    drawerMedia.addEventListener("change", () => {
      if (drawerMedia.matches) injectMenuButton();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
