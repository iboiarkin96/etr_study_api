/* runtime/internal/entry.js — single JS entry for the internal portal.
   Mounts every ui-kit component against document. Components own their own slots. */

import { mountBreadcrumbs } from "../../ui-kit/components/breadcrumbs.js";
import { mountSidebar } from "../../ui-kit/components/sidebar.js";
import { mountDrawer } from "../../ui-kit/components/drawer.js";
import { mountTocFab } from "../../ui-kit/components/toc-fab.js";
import { mountThemeToggle } from "../../ui-kit/components/theme-toggle.js";
import { mountModal } from "../../ui-kit/components/modal.js";
import { mountDiagramLightbox } from "../../ui-kit/components/diagram-lightbox.js";
import { mountSearch } from "../../ui-kit/components/search.js";
import { mountCode } from "../../ui-kit/components/code.js";
import { mountRocket } from "../../ui-kit/components/rocket.js";
import { mountToc } from "../../ui-kit/components/toc.js";

function boot() {
  mountThemeToggle();
  mountBreadcrumbs();
  // Drawer first: it can auto-create a drawer that contains a sidebar slot.
  // mountSidebar() then renders BOTH the main sidebar and the drawer's copy.
  mountDrawer();
  mountSidebar();
  mountTocFab();
  mountToc();
  mountModal();
  mountDiagramLightbox();
  mountSearch();
  mountCode();
  mountRocket();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
