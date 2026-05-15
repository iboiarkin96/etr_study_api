/* runtime/public/entry.js — single JS entry for the public portal.
   Same component graph as internal; sidebar reads nav-tree-public.json via data-nav-src. */

import { mountBreadcrumbs } from "../../ui-kit/components/breadcrumbs.js";
import { mountSidebar } from "../../ui-kit/components/sidebar.js";
import { mountDrawer } from "../../ui-kit/components/drawer.js";
import { mountTocFab } from "../../ui-kit/components/toc-fab.js";
import { mountThemeToggle } from "../../ui-kit/components/theme-toggle.js";
import { mountBugReport } from "../../ui-kit/components/bug-report.js";
import { mountReadingProgress } from "../../ui-kit/components/reading-progress.js";
import { mountModal } from "../../ui-kit/components/modal.js";
import { mountDiagramLightbox } from "../../ui-kit/components/diagram-lightbox.js";
import { mountSearch } from "../../ui-kit/components/search.js";
import { mountCode } from "../../ui-kit/components/code.js";
import { mountRocket } from "../../ui-kit/components/rocket.js";
import { mountToast } from "../../ui-kit/components/toast.js";
import { mountAuthorChip } from "../../ui-kit/components/author-chip.js";
import { mountHotkeys } from "../../ui-kit/components/hotkeys.js";

function boot() {
  mountToast();
  mountThemeToggle();
  mountBugReport();
  mountReadingProgress();
  mountAuthorChip();
  mountBreadcrumbs();
  mountSidebar();
  mountDrawer();
  mountTocFab();
  mountModal();
  mountDiagramLightbox();
  mountSearch();
  mountCode();
  mountRocket();
  mountHotkeys();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
