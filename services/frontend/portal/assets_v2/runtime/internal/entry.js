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
import { mountSyntaxHighlight } from "../../ui-kit/components/syntax-highlight.js";
import { mountRocket } from "../../ui-kit/components/rocket.js";
import { mountToc } from "../../ui-kit/components/toc.js";
import { mountToast } from "../../ui-kit/components/toast.js";
import { mountTooltip } from "../../ui-kit/components/tooltip.js";
import { mountAuthorChip } from "../../ui-kit/components/author-chip.js";
import { initStatusTimeline } from "../../ui-kit/components/status-timeline.js";
import { mountEndpointCards } from "../../ui-kit/components/endpoint-card.js";
import { mountViewSwitcher } from "../../ui-kit/components/view-switcher.js";
import { mountSparklines } from "../../ui-kit/components/sparkline.js";
import { mountRadars } from "../../ui-kit/components/radar.js";
import { mountFilterChips } from "../../ui-kit/components/filter-chips.js";
import { mountMultiFilterChips } from "../../ui-kit/components/multi-filter-chips.js";
import { mountBacklogCockpit } from "../../ui-kit/components/backlog-cockpit.js";
import { mountTerminalCard } from "../../ui-kit/components/terminal-card.js";
import { mountDesignCanvasCard } from "../../ui-kit/components/design-canvas-card.js";
import { mountLiveTickers } from "../../ui-kit/components/live-tickers.js";
import { mountTextDecrypt, mountVariableWeight } from "../../ui-kit/components/text-decrypt.js";
import { mountHotkeys } from "../../ui-kit/components/hotkeys.js";
import { mountSiteFooter } from "../../ui-kit/components/site-footer.js";
import { mountAuroraRail } from "../../ui-kit/components/aurora-rail.js";

function boot() {
  mountToast();
  mountThemeToggle();
  // Aurora rail mounts BEFORE the footer so the rail's placeRail() can
  // insert directly before .site-footer (which mountSiteFooter then
  // creates immediately after). The opposite order also works because
  // placeRail falls back to appending to .docs-shell, but ordering this
  // way keeps the DOM clean on first paint.
  mountAuroraRail();
  // Render the footer before bug-report so the footer's
  // [data-bug-report-open] link gets bound by mountBugReport's first pass.
  mountSiteFooter();
  mountBugReport();
  mountReadingProgress();
  mountAuthorChip();
  initStatusTimeline();
  mountEndpointCards();
  mountSparklines();
  mountRadars();
  mountViewSwitcher();
  mountFilterChips();
  mountMultiFilterChips();
  // Backlog cockpit is async (fetches JSON); fire-and-forget. Mounts only
  // when [data-component="backlog-cockpit"] is present on the page.
  mountBacklogCockpit();
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
  mountSyntaxHighlight();
  mountRocket();
  // Hotkeys last — they reach into other components via DOM selectors.
  mountHotkeys();
  // Tooltip after everything else so it sees triggers injected by other mounts.
  mountTooltip();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
