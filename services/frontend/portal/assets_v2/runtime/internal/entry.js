/* runtime/internal/entry.js — single JS entry for the internal portal.
   Mounts every ui-kit component against document. Components own their own slots. */

import { mountBreadcrumbs } from "../../ui-kit/components/breadcrumbs.js";
import { mountSidebar } from "../../ui-kit/components/sidebar.js";
import { mountDrawer } from "../../ui-kit/components/drawer.js";
import { mountTocFab } from "../../ui-kit/components/toc-fab.js";
import { mountThemeToggle } from "../../ui-kit/components/theme-toggle.js";
import { mountBugReport } from "../../ui-kit/components/bug-report.js";
import { mountFeedbackWidget } from "../../ui-kit/components/feedback-widget.js";
import { mountEditOnGithub } from "../../ui-kit/components/edit-on-github.js";
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
import { mountNotesFilter } from "../../ui-kit/components/notes-filter.js";
import { mountBacklogCockpit } from "../../ui-kit/components/backlog-cockpit.js";
import { mountTerminalCard } from "../../ui-kit/components/terminal-card.js";
import { mountDesignCanvasCard } from "../../ui-kit/components/design-canvas-card.js";
import { mountLiveTickers } from "../../ui-kit/components/live-tickers.js";
import { mountTextDecrypt, mountVariableWeight } from "../../ui-kit/components/text-decrypt.js";
import { mountHotkeys } from "../../ui-kit/components/hotkeys.js";
import { mountSiteFooter } from "../../ui-kit/components/site-footer.js";
import { mountFooterHistory } from "../../ui-kit/components/footer-history.js";
import { mountAuroraRail } from "../../ui-kit/components/aurora-rail.js";
import { mountLensChip } from "../../ui-kit/components/lens-chip.js";
import { mountInteractiveChecklist } from "../../ui-kit/components/interactive-checklist.js";
import { mountPathTimeline } from "../../ui-kit/components/path-timeline.js";

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
  // Both edit-on-github and feedback-widget land inside <main> right BEFORE
  // <footer.docs-history>. They must mount before mountFooterHistory wraps
  // the history block in <details>, otherwise the two would be hidden
  // inside the collapsed history block.
  mountEditOnGithub();
  mountFeedbackWidget();
  mountReadingProgress();
  // Wrap the page-end <footer.docs-history> in a <details> for collapsing.
  // Must run before mountAuthorChip so the chips inside history rows pick up.
  mountFooterHistory();
  mountAuthorChip();
  initStatusTimeline();
  mountEndpointCards();
  mountSparklines();
  mountRadars();
  mountViewSwitcher();
  mountFilterChips();
  mountMultiFilterChips();
  // Notes filter listens on `multifilterchange` — mount AFTER
  // multi-filter-chips so it sees the initial state, and reads the URL
  // hash on first paint for deep-links like #group=documentation.
  mountNotesFilter();
  // Backlog cockpit is async (fetches JSON); fire-and-forget. Mounts only
  // when [data-component="backlog-cockpit"] is present on the page.
  mountBacklogCockpit();
  mountTerminalCard();
  mountDesignCanvasCard();
  mountLiveTickers();
  mountTextDecrypt();
  mountVariableWeight();
  // Lens-chip mounts before the tooltip runtime so the tooltip mount pass
  // sees the data-tooltip attributes it injects on every .lens-chip.
  mountLensChip();
  mountInteractiveChecklist();
  mountBreadcrumbs();
  // Drawer first: it can auto-create a drawer that contains a sidebar slot.
  // mountSidebar() then renders BOTH the main sidebar and the drawer's copy.
  mountDrawer();
  mountSidebar();
  mountTocFab();
  mountToc();
  mountModal();
  // Path-timeline mounts AFTER mountModal so the close/backdrop bindings
  // are in place when a path modal is opened via picker tile or hash.
  mountPathTimeline();
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
