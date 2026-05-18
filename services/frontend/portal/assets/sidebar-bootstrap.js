"use strict";

/**
 * Sidebar bootstrap — shared lazy-loader, mount sequencer, and entry point.
 *
 * Used by internal-sidebar.js and public-sidebar.js. Each portal sidebar file
 * provides a CONFIG (nav data + DOM hooks) and its own script basename for
 * asset-base discovery; this module:
 *   1. Lazy-loads docs-sidebar.js (the runtime) if window.DocsSidebar is missing.
 *   2. Waits for DOMContentLoaded if needed.
 *   3. Invokes window.DocsSidebar.createSidebar(config).mount().
 *
 * Public API on window.DocsSidebarBootstrap:
 *   init({ config, scriptBasename, label?, baseDir? })
 *       — single entry point used by portal sidebars. Resolves the asset base
 *         dir (from baseDir or by scanning <script src>), ensures the runtime
 *         is loaded, and boots the sidebar. Idempotent.
 *   deriveAssetsBaseDir(scriptBasename)
 *       — utility that returns the URL prefix where assets live, derived from
 *         the last <script src> ending in scriptBasename. Returns null if not
 *         found.
 *   ensureRuntimeLoaded(baseDir, callback, label?)
 *       — lazy-loads docs-sidebar.js once; calls callback when runtime ready.
 *   boot({ config, baseDir, label })
 *       — legacy entry point (kept for backwards compatibility); init() now
 *         handles asset-base discovery so callers don't have to.
 *   buildWordmark(opts)
 *       — shared helper for portal-branded wordmarks above the nav tree.
 */
(function () {
  function deriveAssetsBaseDir(scriptBasename) {
    if (!scriptBasename) return null;
    const tags = document.querySelectorAll('script[src*="' + scriptBasename + '"]');
    if (!tags.length) return null;
    const src = tags[tags.length - 1].src;
    return src.slice(0, src.lastIndexOf("/") + 1);
  }

  function ensureRuntimeLoaded(baseDir, callback, label) {
    if (window.DocsSidebar) {
      callback();
      return;
    }
    let loader = document.querySelector('script[data-docs-sidebar-runtime="1"]');
    if (!loader) {
      loader = document.createElement("script");
      loader.src = baseDir + "docs-sidebar.js";
      loader.dataset.docsSidebarRuntime = "1";
      document.head.appendChild(loader);
    }
    loader.addEventListener("load", () => callback());
    loader.addEventListener("error", () => {
      // eslint-disable-next-line no-console
      console.error("[" + (label || "docs-sidebar") + "] failed to load shared runtime");
    });
  }

  function boot(opts) {
    const { config, baseDir, label } = opts;
    const run = () => ensureRuntimeLoaded(baseDir, () => {
      window.DocsSidebar.createSidebar(config).mount();
    }, label);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
  }

  function init(opts) {
    const { config, scriptBasename, label } = opts;
    const baseDir = opts.baseDir || deriveAssetsBaseDir(scriptBasename);
    if (!baseDir) return;
    boot({ config, baseDir, label: label || scriptBasename || "docs-sidebar" });
  }

  /**
   * Build a sidebar wordmark element (branding block above the nav tree).
   *
   * opts:
   *   fromDir      — current page directory (passed via ctx in sidebar hooks)
   *   relHref      — path resolver from DocsSidebar.pathUtils
   *   homeHref     — docs-root-relative path for the home link (e.g. "public/index.html")
   *   ariaLabel    — accessible label on the <a> element
   *   productHtml  — inner HTML for the product name span (may include accent <span>)
   *   tagline      — plain-text tagline string
   *   classPrefix  — BEM block prefix for generated class names (e.g. "public-sidebar")
   */
  function buildWordmark(opts) {
    const { fromDir, relHref, homeHref, ariaLabel, productHtml, tagline, classPrefix } = opts;
    const a = document.createElement("a");
    a.href = relHref(fromDir, homeHref);
    a.className = classPrefix + "__wordmark";
    a.setAttribute("aria-label", ariaLabel);

    const product = document.createElement("span");
    product.className = classPrefix + "__product";
    product.innerHTML = productHtml;

    const taglineEl = document.createElement("span");
    taglineEl.className = classPrefix + "__tagline";
    taglineEl.textContent = tagline;

    a.appendChild(product);
    a.appendChild(taglineEl);
    return a;
  }

  window.DocsSidebarBootstrap = {
    init,
    deriveAssetsBaseDir,
    ensureRuntimeLoaded,
    boot,
    buildWordmark,
  };
})();
