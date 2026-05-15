/* runtime/internal/entry.js — single JS entry for the internal portal.
   Mounts every ui-kit component against document. Components own their own slots. */

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
import { mountToc } from "../../ui-kit/components/toc.js";
import { mountToast } from "../../ui-kit/components/toast.js";
import { mountAuthorChip } from "../../ui-kit/components/author-chip.js";
import { initStatusTimeline } from "../../ui-kit/components/status-timeline.js";
import { mountEndpointCards } from "../../ui-kit/components/endpoint-card.js";
import { mountViewSwitcher } from "../../ui-kit/components/view-switcher.js";
import { mountSparklines } from "../../ui-kit/components/sparkline.js";
import { mountFilterChips } from "../../ui-kit/components/filter-chips.js";
import { mountTerminalCard } from "../../ui-kit/components/terminal-card.js";
import { mountDesignCanvasCard } from "../../ui-kit/components/design-canvas-card.js";
import { mountLiveTickers } from "../../ui-kit/components/live-tickers.js";
import { mountTextDecrypt, mountVariableWeight } from "../../ui-kit/components/text-decrypt.js";
import { mountHotkeys } from "../../ui-kit/components/hotkeys.js";

function boot() {
  mountToast();
  mountThemeToggle();
  mountBugReport();
  mountReadingProgress();
  mountAuthorChip();
  initStatusTimeline();
  mountEndpointCards();
  mountSparklines();
  mountViewSwitcher();
  mountFilterChips();
  mountTerminalCard();
  mountDesignCanvasCard();
  mountLiveTickers();
  mountTextDecrypt();
  mountVariableWeight();
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
  // Hotkeys last — they reach into other components via DOM selectors.
  mountHotkeys();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
