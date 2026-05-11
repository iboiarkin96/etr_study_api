"use strict";

/**
 * Public portal sidebar — config + nav data; behavior comes from docs-sidebar.js.
 * Serves services/portal/public/** pages exclusively — no internal links.
 */
(function () {
  /* ── Navigation tree ──────────────────────────────────────────────────── */

  const PUBLIC_NAV = [

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

  /* ── Wordmark + footer (public-only chrome, injected via hooks) ──────── */

  function buildWordmark(fromDir, relHref) {
    return window.DocsSidebarBootstrap.buildWordmark({
      fromDir,
      relHref,
      homeHref: "public/index.html",
      ariaLabel: "ETR Study API — home",
      productHtml: 'ETR <span class="public-sidebar__product-accent">Study API</span>',
      tagline: "Developer Documentation",
      classPrefix: "public-sidebar",
    });
  }

  function buildFooter(fromDir, relHref) {
    const footer = document.createElement("div");
    footer.className = "public-sidebar__footer";
    const link = document.createElement("a");
    link.className = "public-sidebar__footer-link";
    link.href = relHref(fromDir, "public/reference/api/index.html");
    link.innerHTML = '<span aria-hidden="true">◎</span> Open API Explorer';
    footer.appendChild(link);
    return footer;
  }

  /* ── Config ───────────────────────────────────────────────────────────── */

  const CONFIG = {
    navData: PUBLIC_NAV,
    treePrefix: "public-sidebar",
    layoutPrefix: "public-layout",
    mountId: "public-sidebar-mount",
    sidebarSelector: ".public-layout__sidebar",
    shellSelector: ".public-layout__shell",
    storageKey: "docs.public.sidebar.collapsed",
    navAriaLabel: "Public documentation",
    defaultRelPath: "public/index.html",
    docsRootFirstSegments: ["public", "internal", "index.html"],
    supportsIcons: true,
    supportsLabelHtml: false,
    activeScrollBlock: "center",
    collapseToggle: {
      hideHostOnCollapse: false,
      toggleLabelText: "Hide",
      tooltipOnCollapse: true,
      dataAttr: "data-public-sidebar-toggle",
    },
    drawer: {
      id: "public-docs-drawer",
      title: "Navigation",
      inlineScrollLock: true,
      drawerModeShellClass: "is-drawer-mode",
      toggleEventName: "public-sidebar:toggle-drawer",
      openEventName: "public-sidebar:open-drawer",
      stateEventName: "public-sidebar:drawer-state",
      focusRestore: true,
      menuButton: {
        containerSelector: ".public-layout__main .container",
        btnClass: "public-layout__menu-btn",
        btnHtml: '<span aria-hidden="true">☰</span> Menu',
        beforeNode: "#docs-top-nav",
        dispatchEventName: "public-sidebar:open-drawer",
      },
    },
    beforeRenderTree(ctx) {
      const { host, fromDir } = ctx;
      const { relHref } = window.DocsSidebar.pathUtils;
      host.appendChild(buildWordmark(fromDir, relHref));
    },
    afterRenderTree(ctx) {
      const { host, fromDir } = ctx;
      const { relHref } = window.DocsSidebar.pathUtils;
      host.appendChild(buildFooter(fromDir, relHref));
    },
  };

  /* ── Bootstrap: ensure sidebar-bootstrap.js is loaded, then init. ──────
   * Identical 18-line pattern in internal-sidebar.js — the only variants
   * are SCRIPT_BASENAME and LABEL. All shared helpers live in
   * sidebar-bootstrap.js (deriveAssetsBaseDir, ensureRuntimeLoaded, init).
   */
  (function bootstrapPublicSidebar() {
    const SCRIPT_BASENAME = "public-sidebar.js";
    const LABEL = "public-sidebar";

    function go() {
      window.DocsSidebarBootstrap.init({
        config: CONFIG,
        scriptBasename: SCRIPT_BASENAME,
        label: LABEL,
      });
    }
    if (window.DocsSidebarBootstrap) { go(); return; }

    const tags = document.querySelectorAll('script[src*="' + SCRIPT_BASENAME + '"]');
    if (!tags.length) return;
    const src = tags[tags.length - 1].src;
    const baseDir = src.slice(0, src.lastIndexOf("/") + 1);

    let loader = document.querySelector('script[data-docs-sidebar-bootstrap="1"]');
    if (!loader) {
      loader = document.createElement("script");
      loader.src = baseDir + "sidebar-bootstrap.js";
      loader.dataset.docsSidebarBootstrap = "1";
      document.head.appendChild(loader);
    }
    loader.addEventListener("load", go);
    loader.addEventListener("error", () => {
      // eslint-disable-next-line no-console
      console.error("[" + LABEL + "] failed to load sidebar-bootstrap");
    });
  })();
})();
