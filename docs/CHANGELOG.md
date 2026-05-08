# Documentation changelog

All notable changes to the **documentation tree** under `docs/` (and related doc-only policy files) are tracked here. This journal is separate from the repository root [`CHANGELOG.md`](../CHANGELOG.md), which focuses on product and API behavior (see [ADR 0013](adr/0013-changelog-and-release-notes.html)).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 2026-05-08

### Added

- **Hall of Contributors — premium gallery:** [`docs/internal/portal/people/index.html`](internal/portal/people/index.html) is a new dedicated page with a hero (eyebrow, gradient title, ownership tickers, layered avatar art), a top-maintainer **spotlight** card, group **strips** (PM / Backend / DevOps), and editorial **person cards** with hover gleam and a tonal left-edge signature. ~1163 new CSS lines under `.portal-hero` / `.portal-spotlight` / `.portal-strip` / `.portal-person` in [`docs/assets/internal-layout.css`](assets/internal-layout.css); ~315 JS lines under `renderPortalSpotlight` / `renderPortalPersonCard` / `paintPortalTickers` / `--portal-tone` palette / `PORTAL_SECTION_LABELS` in [`docs/assets/docs-internal-meta.js`](assets/docs-internal-meta.js). Mounts: `#portal-spotlight-mount`, `#portal-people-gallery-mount`, `[data-portal-ticker-target]`. Data contract: `window.__DOCS_PORTAL_DATA__.{people, maintainerPages}` (same source the lightweight `#portal-people-mount` on [`docs/internal/README.html`](internal/README.html) consumes). Per-person profile pages (`cursor`, `ivan-boyarkin`, `kirill-neustroev`) refreshed in the same pass. Spec: [`docs/internal/front/screens/docs-screen-portal-hall-of-contributors.html`](internal/front/screens/docs-screen-portal-hall-of-contributors.html).
- **Backlog hero + at-a-glance tickers:** [`docs/backlog/README.html`](backlog/README.html) adds a hero block (eyebrow, gradient accent, lead, `Roadmap` framing) with four `[data-backlog-ticker]` counters (To do / In progress / Blocked / Done) painted by [`docs/backlog/backlog.js`](backlog/backlog.js) on render. Cockpit cards now resolve owner avatars from `__DOCS_PORTAL_DATA__.people` (falling back to initials), render ETA mini-bars on a 0–7 day scale, and the confidence chip carries a `backlog-chip--confidence-{level}` modifier. ~993 lines added to [`docs/backlog/backlog.css`](backlog/backlog.css) for the hero and chip/avatar/mini-bar styles.
- **Backlog ticket-style cards:** [`docs/backlog/backlog.css`](backlog/backlog.css) — `.backlog-item` redesigned with priority-tinted left bar (P0 rose / P1 amber / P2 blue / P3 slate via `--priority-tone` per `[data-priority]`), priority-tinted hover lift, mono-uppercase `.priority-tag` badge, status-pill anchored top-right via grid `grid-template-areas: "priority . status" / "title title title"` on `<h2>`, and a soft `blocked` pulse animation (2.6s, respects `prefers-reduced-motion`). `Risk` / `Confidence` chips gained a leading colored dot indicator (red/amber/green for risk, inverted for confidence — high-confidence is green); the JS now writes the level-modifier on the confidence chip too.
- **Backlog cockpit polish:** [`docs/backlog/backlog.css`](backlog/backlog.css) — visual-only refresh of the filter strip (markup and IDs preserved so existing JS handlers keep working). Search input becomes a hero with leading 16px svg-mask icon and an `sr-only` label; `Quick filters` / `View` buttons collapse into pill-shaped segmented controls with full-pill `border-radius: 999px` track + ovaled cells, soft active "lift" shadow, and 240ms `cubic-bezier(0.22, 1, 0.36, 1)` transitions; `Detailed filters` `<details>` summary becomes a button-styled disclosure with mono-uppercase label and chevron rotation; `.backlog-active-filter-chip` gets an inline `×` removable indicator via `::after`; `.backlog-cockpit__new-task` becomes a primary accent-fill chip. Cockpit gradient/glass background dropped — the page hero above already states intent.
- **Backlog kanban board view:** [`docs/backlog/backlog.js`](backlog/backlog.js) `applyViewMode()` now branches `board ↔ list ↔ timeline`, building `.backlog-board-column` flex wrappers for board (one per status: To do / In progress / Blocked / Done / Rejected) and tearing them down on view switch. `buildBoardColumns()` distributes items by `[data-status]`; `refreshBoardColumnCounts()` updates per-column counts on every `applyFilter()`. Each column has a sticky `.backlog-board-column-header` with status-color dot + uppercase label + count badge, and an empty-state placeholder (`No tasks here.`) when zero visible items. CSS layout: outer `display: grid; grid-template-columns: repeat(5, minmax(260px, 1fr))` over `.backlog-board-column` flex stacks — independent per-column heights (CSS Grid rows are global, which caused empty space above shorter columns; flex per-column fixes that).
- **Backlog timeline view:** [`docs/backlog/backlog.js`](backlog/backlog.js) groups items into 6 ETA bands (`Now ≤1d`, `Soon 1–3d`, `Mid 3–5d`, `Later >5d`, `Blocked`, `Shipped`) via `timelineSegmentKeyForItem()` (status overrides ETA bucketing for blocked / done / rejected). Each band is a `.backlog-timeline-segment` with a left rail (tone dot + uppercase mono label + hint + count) and a right items column. Continuous neutral 1px axis line via pseudo-element on the parent (avoids per-segment mask clipping that previously cropped the first card and the topmost dot). Palette is a single-accent gradient (vivid → faded muted) for ETA bands so the axis doesn't compete with priority tags; reserved tones for blocked (amber) and shipped (green).
- **Backlog task details modal:** clicking the card title now opens a centered modal (`.backlog-task-modal`) with backdrop blur, scale-in animation, scrollable body, and an action footer (`Copy link` ghost + `Close` primary). `.backlog-heading-main` carries `role="button" tabindex="0"` plus `keydown` Enter/Space; `Escape`, backdrop click, and `✕` button all close the modal; on close, focus returns to the opener. The previous inline `Open details` / `Copy link` buttons and the `Priority: P0` chip in `.backlog-task-meta` are removed (priority is already shown by the colored badge in the top-left corner). Cloning the card's `.backlog-item-summary` / `.backlog-item-risk-confidence` / `.backlog-task-meta` / `.backlog-task-eta` / `.backlog-task-progress` / `.backlog-task-expanded` keeps the modal in lockstep with card content without DOM detachment. Tooltip clipping fixed by switching `.backlog-item` from `overflow: hidden` to `overflow: visible` and reshaping the corner `::before` gleam to fit inside the card (later removed entirely for a calmer look).
- **`--fs-display` token (landing-only display tier):** [`docs/assets/docs.css`](assets/docs.css) introduces `--fs-display: 4rem` as the **single sanctioned exception** to the canonical 8-tier ladder — reserved for the landing-page hero where the canonical h1 (1.6rem) would not read as a hero. Internal docs MUST NEVER use this token. [`docs/assets/home.css`](assets/home.css) `.home-hero__title` switches from `clamp(2.6rem, 5vw + 0.5rem, 4.2rem)` to `var(--fs-display)` so typography stays uniform across viewports per the mobile-contract invariant. The previous in-media `font-size` overrides for `.home-hero__title` and `.home-hero__terminal` are removed.
- **`no-artifact-files` pre-commit hook:** [`scripts/check_no_artifact_files.sh`](../scripts/check_no_artifact_files.sh) refuses to stage local CI / runtime artifacts (`.coverage`, `*.db`, `PR_BODY.md`, `changelog-llm-draft.md`) and prints the offending paths plus the unstaging hint. Wired into [`.pre-commit-config.yaml`](../.pre-commit-config.yaml) as `id: no-artifact-files`, `always_run: true`, `stages: [pre-commit]`. Closes the repository-hygiene finding from the 2026-05-07 portal bug audit (SEV-3 — stray files committed). Reference for runbook readers: [`docs/runbooks/0004-pre-commit-failing.html`](runbooks/0004-pre-commit-failing.html).
- **OpenAPI 4xx validation-error descriptions:** [`app/openapi/validation_error_openapi.py`](../app/openapi/validation_error_openapi.py) enriches `400` / `422` response descriptions across the generated OpenAPI schema, plumbed through `custom_openapi()` in [`app/main.py`](../app/main.py) alongside the existing `enrich_openapi_with_request_id`. Baseline regenerated via `make openapi-accept-changes` ([`docs/openapi/openapi-baseline.json`](openapi/openapi-baseline.json)). Closes audit finding `sev-2-oas-descriptions` (REST-API-assessment 2026-04-14, item 16).

### Changed

- **Bug audit 2026-05-07 — resolution sweep:** [`docs/audit/bugs/2026-05-07-portal-bug-audit.html`](audit/bugs/2026-05-07-portal-bug-audit.html) — every finding now carries an inline status row (`audit-finding__status` + `audit-status` chip, light/dark-themed inline so the audit stays self-contained). Outcome: **20 resolved + 1 bonus, 2 false positives**. Per-finding fix sites:
  - **SEV-1 — Regex lookbehind crashes Safari < 16.4** ([`docs/assets/docs-syntax.js`](assets/docs-syntax.js)): `(?<=\s)` (FLAGS, line 324 — bonus, missed by audit), `(?<=:\s*)` (YAML NUMBERS / BOOLS, lines 383–384), `(?<=:\s)` (HTTP header values, line 431) replaced with capture-group prefixes; tokenizer signatures simplified accordingly.
  - **SEV-2 — `font-size` inside width-conditional media** ([`docs/assets/docs.css`](assets/docs.css), [`docs/assets/home.css`](assets/home.css)): three `font-size` lines removed from `@media (max-width: 760px)` rules in `docs.css` (`.docs-quick-actions__list a/button`, `.docs-quick-actions__item-pill`, `.docs-quick-actions__item-keycap`); two `clamp()` / token lines removed from `home.css` (`.home-hero__title`, `.home-hero__terminal`). Canonical 8-tier ladder cascade restored — typography now uniform across desktop / tablet / mobile.
  - **SEV-2 — Non-canonical breakpoints (14 occurrences):** all folded into the canonical `≥1025 / 761–1024 / ≤760` tiers across [`docs/assets/docs.css`](assets/docs.css), [`docs/assets/home.css`](assets/home.css), [`docs/assets/internal-layout.css`](assets/internal-layout.css), [`docs/assets/docs-premium.css`](assets/docs-premium.css). Mappings: `900` → `1024`; `520` / `600` / `620` / `640` / `720` → `760`; `1200` → `1024` (`main.container--swagger`). Internal-docs sticky in-page TOC offset rule widened from `min-width: 901px` to `min-width: 761px` to track the new boundary.
  - **SEV-2 — Document-listener leak in [`docs/assets/docs-spec-status.js`](assets/docs-spec-status.js):** `bindOutsideClose` no longer attaches a fresh `pointerdown` / `keydown` pair per pill. New `openDetailsRegistry` `Set` plus `ensureDocumentListenersInstalled()` install one delegated pair for the page lifetime; the registry holds `{ details, summary }` entries iterated on each event.
  - **SEV-2 — Anchor anatomy missing IDs** ([`docs/internal/front/components/resume-and-back-to-top.html`](internal/front/components/resume-and-back-to-top.html)): `id="anatomy-banner"` and `id="anatomy-fab"` added to the matching list items so the anatomy callouts deep-link cleanly.
  - **SEV-2 — OpenAPI 4xx descriptions:** see Added (validation-error enrichment).
  - **SEV-2 — Search index uses raw `<title>` over `<h1>`** ([`scripts/build_docs_search_index.py`](../scripts/build_docs_search_index.py)): indexer now prefers `<h1>` with HTML-entity decoding; `docs/assets/search-index.json` regenerated (203 docs).
  - **SEV-2 — Initial-paint-blocking syntax highlight** ([`docs/assets/docs-syntax.js`](assets/docs-syntax.js)): added a `requestAnimationFrame` fallback before `setTimeout(0)` so highlighting yields to first paint on long pages even when `requestIdleCallback` is unavailable.
  - **SEV-3 — Mermaid CSS dead code** ([`docs/assets/docs.css`](assets/docs.css)): `.sys-diagram__canvas .mermaid` block removed (per [ADR 0020](adr/0020-c4-plantuml-diagram-style-and-conventions.html) — PlantUML only).
  - **SEV-3 — Theme `MutationObserver` leak** ([`docs/assets/home-landing.js`](assets/home-landing.js)): page-scoped `AbortController` (`pageController` / `pageSignal`) installed at module init, aborted on `pagehide`; theme `MutationObserver` registers `disconnect()` via `pageSignal.addEventListener("abort", …, { once: true })`.
  - **SEV-3 — Long-lived window / host listeners on home** ([`docs/assets/home-landing.js`](assets/home-landing.js)): every long-lived `addEventListener` now passes `{ signal: pageSignal }` (resize / scroll / pointermove / pointerleave); the first-visit intro overlay scopes its `keydown` and `skip click` listeners to a separate `introController` aborted by `closeIntro`.
  - **SEV-3 — Swallowed `localStorage` writes** ([`docs/assets/docs-nav.js`](assets/docs-nav.js)): `safeSetLocalStorage(key, value)` helper added with a one-shot `console.warn` on the first ITP / quota failure; both call sites in `enqueueDocsPromoToast` refactored to use it.
  - **SEV-3 — Inline `<script>` no-flash bootstrap unmarked:** all 167 inline `<script>` no-flash bootstraps now carry `/* no-flash theme bootstrap */` plus an inline comment in the empty-`catch` branch; [`scripts/inject_docs_theme_assets.py`](../scripts/inject_docs_theme_assets.py) emits the comment so future-injected pages stay annotated.
  - **SEV-3 — `docs/assets/` fragments not indexed** ([`scripts/build_docs_search_index.py`](../scripts/build_docs_search_index.py)): added an explicit comment documenting that `docs/assets/` holds component fragments and is intentionally excluded.
  - **SEV-3 — RFC template `<h1>` HTML entities** ([`docs/rfc/0000-template.html`](rfc/0000-template.html)): rewritten as `RFC <code>NNNN</code>: <code>title</code>`; search index now stores the decoded title.
  - **SEV-3 — `+N more` button listener leak** ([`docs/assets/docs-internal-meta.js`](assets/docs-internal-meta.js)): click handler uses `{ once: true }` so the listener tears down before the button is removed.
  - **SEV-3 — Stray repository files:** `PR_BODY.md`, `changelog-llm-draft.md`, `.coverage`, `study_app.db` removed; future drift refused by the new `no-artifact-files` pre-commit hook (above).
  - **SEV-4 — Deferred theme-toggle placement** ([`docs/assets/docs-nav.js`](assets/docs-nav.js)): added a two-pass-placement comment to `syncInternalThemeTogglePlacement` documenting why the deferred re-run is required (sticky sidebar height + custom-element upgrades). Removing the second call regressed placement on Safari.
  - **2 false positives** flagged on the audit page itself: `docs-palette-hint-dismissed` (the key IS written, via `enqueueDocsPromoToast`'s `storageKey` plumbing), `pip-audit` (already invoked in CI — `make verify` step `1/8`, `Makefile` L164–171).
- **Internal hub `<head>` + sections** ([`docs/internal/README.html`](internal/README.html), +431/-238 lines): rhythmic restructure aligning the hub with the new portal/people page (hero / Onboarding & Workflow / Architecture & API / Quality & ops / People & ownership), and the lightweight `#portal-people-mount` cards now derive `fromDir` from the current page so the same renderer paints both the hub and the gallery.
- **Docs reading mode preserves breadcrumbs** ([`docs/assets/docs.css`](assets/docs.css)): the reading-mode rule no longer hides `#docs-top-nav .docs-breadcrumbs` — breadcrumbs are the only quick way back up the hierarchy and never warrant being hidden alongside top-nav groups / search.
- **Docs hub mapping for `internal/portal/people`** ([`docs/assets/docs-nav.js`](assets/docs-nav.js)): `docsHubHrefForPrefix` now points the breadcrumb hub for `internal/portal/people` at the new `internal/portal/people/index.html` (replaces the previous `internal/README.html#team-onboarding` anchor).

### Fixed

- **Bash tokenizer FLAGS (bonus on top of SEV-1):** [`docs/assets/docs-syntax.js:324`](assets/docs-syntax.js) — third lookbehind regex literal (`(?<=\s)(-{1,2}[\w-]+)`) was missed by the bug audit but caught while applying the SEV-1 fix; now uses the same capture-group-prefix pattern as YAML / HTTP. Module-load failure on Safari < 16.4 fully closed.

## 2026-05-07

### Added

- **ADR 0028 — Monorepo with service boundaries (Proposed):** [`docs/adr/0028-monorepo-with-service-boundaries.html`](adr/0028-monorepo-with-service-boundaries.html) proposes a single-repository, service-rooted layout under `services/{api,portal,monitoring}` with a per-service `Dockerfile`, a root `docker-compose.yml`, and a CI matrix that builds and tests each service independently. Captures the architectural separation of API runtime, documentation portal, and monitoring stack without paying the multi-repo CI / version-skew / contract-sync tax. Alternatives section evaluates and rejects multi-repo + GitHub Organization, multi-repo + meta-repo with submodules, and a single-image / multiple-`CMD` shortcut. Migration appendix splits the change into four shippable phases (folder split → per-service Dockerfiles → root compose → CI matrix). Linked from [`docs/adr/README.html`](adr/README.html) (Workflow &amp; delivery section, full index, page history). Cross-refs: ADRs 0001, 0008, 0015, 0017, 0018, 0021, 0023.
- **ADR/RFC link-checker:** [`scripts/check_adr_rfc_links.py`](../scripts/check_adr_rfc_links.py) validates cross-references inside [`docs/adr/`](adr/) and [`docs/rfc/`](rfc/) at three levels — relative `href`/`src` targets exist on disk, in-page `href="#id"` matches a same-page `id="id"`, and cross-doc `href="path.html#id"` matches an `id="id"` inside the resolved target file. External schemes, `<code>`/`<pre>` bodies, and HTML comments are skipped. Wired into [`.pre-commit-config.yaml`](../.pre-commit-config.yaml) as the `check-adr-rfc-links` hook scoped to `^docs/(adr|rfc)/.*\.html$`. Replaces the previous spot-check approach (full matrix is sub-second on 34 pages).
- **Bug audit — 2026-05-07:** [`docs/audit/bugs/2026-05-07-portal-bug-audit.html`](audit/bugs/2026-05-07-portal-bug-audit.html) — read-only forensics across portal HTML/CSS/JS, OpenAPI baseline, ADR/RFC, client scripts, search index, and repository hygiene. 22 findings (SEV-1: 1, SEV-2: 8, SEV-3: 9, SEV-4: 4); leading categories are event-listener leaks (5), mobile-contract / font-ladder violations (3), and search-index drift (3). Linked from [`docs/audit/README.html`](audit/README.html) and [`docs/assets/internal-sidebar.js`](assets/internal-sidebar.js) under a new "Bug audit" group.

### Changed

- **OpenAPI loading state:** [`docs/openapi/index.html`](openapi/index.html) renders an `.openapi-skeleton` placeholder (sidebar list + main column bars/blocks) while the Scalar CDN bundle downloads and mounts; the existing theme-sync logic removes it when `.scalar-app` appears in the DOM. Matching styles live in [`docs/assets/docs.css`](assets/docs.css). Reduces the visible blank-page window on slow connections.

## 2026-05-06

### Added

- **Frontend typed-spec lint:** [`scripts/front_spec_lint.py`](../scripts/front_spec_lint.py) checks required `data-spec-section` blocks on internal pages with `data-spec-page` set to `component`, `foundation`, or `contract`, using section IDs from the templates under [`docs/internal/front/_shared/`](internal/front/_shared/) (`component-spec-template.html`, `foundation-spec-template.html`, `contract-spec-template.html`, [`spec-definition-of-done.html`](internal/front/_shared/spec-definition-of-done.html)). [`make docs-spec-check`](../Makefile) runs this script after the API `spec_lint.py` / `spec_consistency.py` pair.
- **Pattern: long-form reading aids:** [`docs/internal/front/patterns/long-form-reading-aids.html`](internal/front/patterns/long-form-reading-aids.html) — composed-reading pattern spec under the new **patterns** category.

### Changed

- **Internal frontend docs information architecture:** flattened `docs-frontend-*.html` filenames into category folders — [`docs/internal/front/foundations/`](internal/front/foundations/), [`contracts/`](internal/front/contracts/), [`components/`](internal/front/components/), [`screens/`](internal/front/screens/), [`patterns/`](internal/front/patterns/), and shared authoring under [`_shared/`](internal/front/_shared/) (including [`style-guide.html`](internal/front/_shared/style-guide.html), replacing the removed root [`documentation-style-guide.html`](internal/front/documentation-style-guide.html)). Hub and category roll-ups: [`docs/internal/front/README.html`](internal/front/README.html). Repository-wide relative links refreshed (ADRs, QA, developer/howto/runbooks, internal API pages, [`docs/assets/internal-sidebar.js`](assets/internal-sidebar.js), [`docs/assets/docs-portal-data.js`](assets/docs-portal-data.js), [`docs/assets/search-index.json`](assets/search-index.json)); maintainer and validation scripts updated where paths are pinned (`ensure_docs_maintainers.py`, `format_docs_html.py`, `repair_docs_html.py`, `validate_docs_*.py`).
- **Home hero — desktop-only decorative background:** [`docs/assets/home-webgl.js`](assets/home-webgl.js) raises `MIN_VIEWPORT_PX` to `1025` so the WebGL2 flowfield initialises on desktop only; [`docs/assets/home.css`](assets/home.css) adds `@media (max-width: 1024px) { .home-hero__bg { display: none; } }` to suppress the full decorative subtree (canvas, dot-grid, parallax orbs, static line-grid) on tablet and phone. Rationale: at narrow column widths the layered backgrounds combined into an off-white "card" framing the H1; the explicit non-desktop contract is now a plain hero section matching the rest of the page. [`docs/internal/front/screens/docs-screen-home-landing.html`](internal/front/screens/docs-screen-home-landing.html) hero-region section adds a WebGL flowfield bullet alongside dot-grid / orbs / line-grid and documents the desktop-only behaviour.
- **Home hero — sidebar-collapse resize fix:** [`docs/assets/home-webgl.js`](assets/home-webgl.js) observes `.home-hero` with `ResizeObserver` (not just `window.resize`). Toggling SHOW/HIDE MENU on desktop changes the hero's width without firing `window.resize`, leaving the WebGL drawing buffer at stale dimensions and an unrendered rectangle on the right; the observer now reflows the canvas on every host-size change.
- **Docs feedback FAB tooltip:** [`docs/assets/docs.css`](assets/docs.css) anchors the `[data-tooltip]` bubble for `.docs-report-bug-fab` to the button's right edge (`left: auto; right: 0`) and switches its width to `max-content`. The default centred tooltip overflowed the viewport because the FAB sits at `right: 1.25rem`; the new alignment keeps the pill within bounds with clean edges.
- **Docs pipeline / CI drift:** [`make docs-check`](../Makefile) compares `git diff` before and after [`docs-fix`](../Makefile), then restores the whole [`docs/pdoc/`](../pdoc/) tree from `HEAD` and re-runs [`scripts/build_docs_search_index.py`](../scripts/build_docs_search_index.py) so [`docs/assets/search-index.json`](assets/search-index.json) matches the on-disk tree (pdoc HTML and embedded lunr output otherwise differ across OS and runs). Repository root [`.python-version`](../.python-version) matches CI (`3.11`). [`scripts/normalize_pdoc_output.py`](../scripts/normalize_pdoc_output.py) re-serializes the embedded `docs` JSON with sorted keys where possible. [`scripts/validate_docs_design.py`](../scripts/validate_docs_design.py) skips scratch HTML under `internal/portal/people/*/notes/` (typically gitignored locally) and points Page history guidance at [`docs/internal/front/_shared/style-guide.html`](internal/front/_shared/style-guide.html).

### Fixed

- **Home hero — WebGL flowfield disappearing after a few seconds:** [`docs/assets/home-webgl.js`](assets/home-webgl.js) hardens the FPS guard. Previously the canvas would tear down ~2 s after init on desktop because (a) shader-compile and first-paint jank dragged the average below the floor, and (b) after a `visibilitychange` cycle `start()` reset `lastTs` but kept the pre-pause `frames` and `measureStart`, so a tiny frame count was divided over a huge wall-time gap and synthesised a near-zero FPS reading. Additionally, Yandex Browser's "energy efficiency" mode (and Safari Low Power) cap rAF at ~30Hz, so the original 42 fps floor tripped on machines where Chromium ran the same shader at 60 fps. The module now skips a `FPS_WARMUP_MS = 400` warmup before counting, drops frames whose `dt ≥ 100 ms` (browser-throttled rAF) and restarts the measurement window, resets `frames` / `measureStart` / `warmupStart` inside `start()` so a tab-hidden → visible cycle starts a fresh window, lowers `TARGET_FPS_FLOOR` from `42` → `30` to tolerate power-saving rAF throttling, and emits a `console.info` with the measured rate when the guard does trip (silent on the page) so future reports can be diagnosed without instrumentation.

## 2026-05-03

### Removed

- **Shared ADR/RFC lifecycle help:** removed `injectDocsLifecycleHelp` from [`docs/assets/docs-nav.js`](assets/docs-nav.js), empty `<details class="adr-weight-help">` / `<details class="rfc-weight-help">` hooks from ADR and RFC pages, and matching styles in [`docs/assets/docs.css`](assets/docs.css). Milestone guidance for authors remains in the **Status log** callout built by `renderAdrStatusLogAfter`.

## 2026-04-24

### Added

- **SDLC RACI matrix:** [`docs/internal/manager/sdlc-raci-matrix.html`](internal/manager/sdlc-raci-matrix.html) — hand-authored matrix with compact column hints via `data-tooltip` (no dotted glossary underline on triggers).
- **Frontend docs — tooltips and inline hints:** [`docs/internal/front/docs-frontend-tooltips.html`](internal/front/components/tooltips.html) — normative contract for **Pattern A** (`tabindex` + `data-tooltip` only, shared styles in [`docs/assets/docs.css`](assets/docs.css)) vs **Pattern B** (`.docs-tooltip` / `docs-tooltip--etr` for glossary terms), clipping notes for tables, and a contributor checklist. Linked from [`docs/internal/front/docs-frontend-ui-kit.html`](internal/front/foundations/ui-kit.html), [`docs/internal/front/docs-frontend-glossary.html`](internal/front/_shared/glossary.html), [`docs/assets/internal-sidebar.js`](assets/internal-sidebar.js), and [`docs/assets/docs-portal-data.js`](assets/docs-portal-data.js).

### Changed

- **`[data-tooltip]` styling:** consolidated in [`docs/assets/docs.css`](assets/docs.css) with downward overrides for scrollable tables and selected internal layouts so bubbles are not clipped; CSS comment references the tooltips guide. [`docs/backlog/backlog.css`](backlog/backlog.css) drops duplicated `[data-tooltip]` rules in favor of the shared sheet.
- **Inline hints markup:** documentation assessments under [`docs/audit/`](audit), [ADR 0011](adr/0011-slo-sla-error-budget.html), [RFC 0002](rfc/0002-docs-search-kpi-policy-and-slo.html), and [`docs/backlog/README.html`](backlog/README.html) table headers use `data-tooltip` for compact hints (ETR glossary spans keep `docs-tooltip docs-tooltip--etr` elsewhere).
- **Page feedback card:** [`docs/assets/docs-nav.js`](assets/docs-nav.js) builds feedback label spans with `data-tooltip` only (no `docs-tooltip` class).
- **Generated / navigation artifacts:** [`docs/assets/search-index.json`](assets/search-index.json) updated for new and renamed paths. Root [`README.md`](../README.md) repository tree lists `docs/internal/manager/`.

## 2026-04-23

### Changed

- **Internal API operation pages:** all files under [`docs/internal/api/**/operations/`](internal/api) now keep exactly one `<h1>` per page, with the endpoint heading (`METHOD /api/...`) placed at the top of `<main>` before shared top navigation mounts. This aligns operation docs with the documentation baseline checks and the QA page heading order.

- **Backlog docs page:** [`docs/backlog/README.html`](backlog/README.html), [`docs/backlog/backlog.js`](backlog/backlog.js), and [`docs/backlog/backlog.css`](backlog/backlog.css) were reworked for easier operations: quick-views-first layout, grouped + full task sections, unified task filtering in both sections, per-group count badges, top-10 preview with "Show more/Show less", empty state text for unmatched filters, and recalibrated estimate ranges for one senior developer with LLM support.

## 2026-04-22

### Added

- **Portal profile [Kirill Neustroev](internal/portal/people/kirill-neustroev/index.html)** (DevOps): machine-readable `data-person-*` on `<body>`, avatar `photo.png`, **Page history** baseline. Co-maintainer on [`docs/internal/api/errors.html`](internal/api/errors.html) via `data-maintainer-ids`.


### Changed

- **[`docs/audit/README.html`](audit/README.html):** new section **How to create assessments** (file naming such as `YYYY-MM-DD-topic-assessment.html`, folder choice under `docs/audit/docs/` or `docs/audit/api/`, title alignment, asset paths, ADR 0024 cross-links).

- **[`docs/audit/docs/README.html`](audit/docs/README.html):** assessment table lists the UI/UX report alongside earlier DX assessments.

- **Shared docs assets:** incremental updates to [`docs/assets/docs.css`](assets/docs.css), [`docs-theme.css`](assets/docs-theme.css), [`docs-nav.js`](assets/docs-nav.js), [`internal-sidebar.js`](assets/internal-sidebar.js), and [`docs-internal-meta.js`](assets/docs-internal-meta.js); portal profile tweaks for Cursor and Ivan Boyarkin; [`README.md`](../README.md), [`docs/index.html`](index.html), and selected internal pages (conspectus, methodology, backlog) refreshed in the same pass.

- **Generated artifacts:** [`docs/assets/docs-portal-data.js`](assets/docs-portal-data.js) and [`docs/assets/search-index.json`](assets/search-index.json) regenerated (`collect_docs_portal_data.py`, `build_docs_search_index.py`).

## 2026-04-21

### Added

- **Employee portal** under [`docs/internal/portal/`](internal/portal/README.html): hub and profile pages driven by `data-*` attributes; [`docs/assets/docs-portal-data.js`](assets/docs-portal-data.js) generated by [`scripts/collect_docs_portal_data.py`](../scripts/collect_docs_portal_data.py); client UI in [`docs/assets/docs-internal-meta.js`](assets/docs-internal-meta.js) (breadcrumbs for profile hubs, **Maintained pages** list with pagination, **Page editors**). Navigation entry in [`docs/assets/internal-sidebar.js`](assets/internal-sidebar.js); repository tree in root [`README.md`](../README.md) lists `docs/internal/portal/`.
- **Page history** on hand-written documentation pages: section `id="page-history"` (or assessment `id="5-page-history"`) with columns **Date | Change | Author**; [`scripts/ensure_docs_page_history.py`](../scripts/ensure_docs_page_history.py) for bulk inserts; [`scripts/link_page_history_authors.py`](../scripts/link_page_history_authors.py) links author names to portal profiles where applicable.
- **Default page editors** for hand-written HTML: [`scripts/apply_default_page_editor_to_docs.py`](../scripts/apply_default_page_editor_to_docs.py). Portal pages mount **in-page TOC** (`docs-inpage-toc-mount`) so `make docs-design-check` passes.

### Changed

- [`scripts/validate_docs_design.py`](../scripts/validate_docs_design.py): requires a **Page history** block (or the assessment equivalent) and existing top-nav / card / TOC rules.
- **Shared styling:** `.docs-page-meta` (avatars, editor list) and page-history author links in [`docs/assets/docs.css`](assets/docs.css); portal chrome and pager styles in [`docs/assets/internal-layout.css`](assets/internal-layout.css), including dark-theme background for the pager.
- [`docs/internal/front/documentation-style-guide.html`](internal/front/_shared/style-guide.html): documents page history and author linking.
- **`make docs-fix`:** new step runs `collect_docs_portal_data.py` before pdoc and search index ([`Makefile`](../Makefile)).
- **Premium docs UI polish:** top-nav links and command palette interactions in [`docs/assets/docs-nav.js`](assets/docs-nav.js), [`docs/assets/docs-site-nav.css`](assets/docs-site-nav.css), and [`docs/assets/docs.css`](assets/docs.css) now include consistent hover/focus motion, quick actions launcher, grouped command palette actions, and inline filtering.
- **Page editors UX:** [`docs/assets/docs-internal-meta.js`](assets/docs-internal-meta.js) now renders a compact avatar stack by default and exposes the full editor list behind a click-to-expand **Page editors** toggle.
- **Portal people cards:** [`docs/assets/internal-layout.css`](assets/internal-layout.css) and [`docs/assets/docs-internal-meta.js`](assets/docs-internal-meta.js) now use consistent card sizing, alphabetical sort inside groups, small group count badges, profile subtitle metadata, and matched avatar hover effects on both portal hub and profile pages.
- **Frontend contract documentation:** [`docs/internal/front/documentation-style-guide.html`](internal/front/_shared/style-guide.html) now includes a dedicated **Docs frontend contract** section that defines required mounts/attributes/scripts for shared docs UI features.
- **Skeleton loading states (demo visibility):** portal widgets in [`docs/assets/docs-internal-meta.js`](assets/docs-internal-meta.js) and [`docs/assets/docs.css`](assets/docs.css) now show skeleton placeholders for people and maintained pages with a minimum visible window (`SKELETON_MIN_VISIBLE_MS = 600`) for visual verification.

## 2026-04-18

### Added

- **Unified audit template and layout:** [`docs/audit/AUDIT_TEMPLATE.html`](docs/audit/AUDIT_TEMPLATE.html) — Overview (`id="overview"`, no `lead`), Table 2 with **Justification** column, `pre.audit-scoring-formula`, `table.audit-gap-table` (TODO / IN PROGRESS / DONE). Assessments live under [`docs/audit/docs/`](docs/audit/docs/README.html) (documentation DX) and [`docs/audit/api/`](docs/audit/api/README.html) (REST API). Canonical DX and API reports: [`2026-04-14-documentation-experience-assessment.html`](docs/audit/docs/2026-04-14-documentation-experience-assessment.html), [`2026-04-14-rest-api-assessment.html`](docs/audit/api/2026-04-14-rest-api-assessment.html). CSS: gap workflow colours and formula blocks in [`docs/assets/docs.css`](assets/docs.css); dark theme in [`docs/assets/docs-theme.css`](assets/docs-theme.css).

- **Dark theme** for hand-written documentation: [`docs/assets/docs-theme.css`](assets/docs-theme.css) (palette + overrides), loaded after [`docs/assets/docs.css`](assets/docs.css) on all pages that already linked `docs.css`.
- **Theme control** in [`docs/assets/docs-nav.js`](assets/docs-nav.js): cycles **Auto** (follows `prefers-color-scheme`) → **Light** → **Dark** → Auto; preference stored in `localStorage` (`docs-theme-preference`). A short synchronous script in each page `<head>` applies the stored choice before first paint to limit flash of the wrong theme.
- [`scripts/inject_docs_theme_assets.py`](../scripts/inject_docs_theme_assets.py): inserts the `docs-theme.css` `<link>` (after `docs.css`) and the early theme script into `docs/**/*.html` when adding or normalizing pages.
- **Shared ADR/RFC lifecycle help** in [`docs/assets/docs-nav.js`](assets/docs-nav.js): `injectDocsLifecycleHelp()` fills `<details data-docs-lifecycle="adr-short" | "rfc-short" | "adr-template">` from one versioned source (`DOCS_LIFECYCLE_HELP_SNIPPET_VERSION`); relative links use `relHref` so `docs/adr/` and `docs/rfc/` stay correct. ADR pages use class `adr-weight-help`, RFC pages `rfc-weight-help`; the [ADR template](adr/0000-template.html) uses `adr-template` for the full milestone table. Injected nodes carry `data-docs-lifecycle-version` for traceability.

### Changed

- **Assessments consolidated:** removed dated standalone files under `docs/audit/` root (`2026-04-14-*`, `2026-04-17-*`, `2026-04-18-*`); content merged into the `docs/` and `api/` trees above. [`docs/audit/README.html`](audit/README.html) and [ADR 0024](adr/0024-architecture-and-quality-assessment-documents.html) updated. Top nav label **Assessments** (was “API assessment reports”); breadcrumb hubs for `audit/docs` and `audit/api` in [`docs/assets/docs-nav.js`](assets/docs-nav.js).

- Shared styling refactored around **CSS custom properties** in [`docs/assets/docs.css`](assets/docs.css), [`docs/assets/docs-site-nav.css`](assets/docs-site-nav.css), [`docs/assets/internal-layout.css`](assets/internal-layout.css), and [`docs/backlog/backlog.css`](backlog/backlog.css) so light and dark themes stay consistent (navigation, search, tables, ADR steppers, backlog pills, internal sidebar, diagrams).
- **Top navigation:** removed the rotating conic **outline** treatment from the **⭐Backlog** pill so it matches other internal links; theme switcher sits in a dedicated top row (`.top-nav__theme-bar`) above the Internal / Code cards.
- **Motion:** slowed the animated **sidebar “SHOW MENU”** control border in [`docs/assets/internal-layout.css`](assets/internal-layout.css) and the **ADR “Current status”** pill rim in [`docs/assets/docs.css`](assets/docs.css) for calmer motion.
- **Responsive layout** in [`docs/assets/docs.css`](assets/docs.css): `img` / `svg` / `video` capped with `max-width: 100%`; narrower breakpoints (~520px / ~380px) adjust padding (including `env(safe-area-inset-*)`), headings, cards, and `pre`; **Back to top** uses safe-area insets; coarse-pointer media adds comfortable tap targets and `16px` search input text to reduce iOS zoom-on-focus.
- **Hub index tables:** [`docs/adr/README.html`](adr/README.html), [`docs/howto/README.html`](howto/README.html), [`docs/runbooks/README.html`](runbooks/README.html), [`docs/audit/README.html`](audit/README.html), [`docs/rfc/README.html`](rfc/README.html), and [`docs/developer/README.html`](developer/README.html) — document titles in the first column are the links; redundant **Open** columns removed. [`docs/internal/analysis/system-design.html`](internal/analysis/system-design.html) aligned where applicable.
- [ADR 0018](adr/0018-adr-lifecycle-ratification-and-badges.html): narrative references `renderLifecycleStatusBlocks` and notes RFC [`data-rfc-weight`](rfc/README.html) on `<main>`.
- **Plain language:** [`docs/internal/front/documentation-style-guide.html`](internal/front/_shared/style-guide.html#plain-language) now defines readability rules (short sentences, simple vocabulary where possible, ESL-friendly). Entry pages updated for simpler English: repository root [`README.md`](../README.md) and [`CONTRIBUTING.md`](../CONTRIBUTING.md), [`docs/index.html`](index.html), [`docs/howto/README.html`](howto/README.html), [`docs/audit/README.html`](audit/README.html). Older ADRs and long internal pages can follow the same guide in follow-up edits.
- **ADR plain-language pass:** [`docs/adr/`](adr/) — shorter, clearer wording across numbered ADRs (ratification blurbs, Context/Decision where edited), [`docs/assets/docs-nav.js`](assets/docs-nav.js) lifecycle help copy updated (`DOCS_LIFECYCLE_HELP_SNIPPET_VERSION` **2**). Very long ADRs (e.g. 0020, 0021 industry sections) can be tightened further in follow-up PRs.
- **RFC plain-language pass:** [`docs/rfc/README.html`](rfc/README.html), [`docs/rfc/0001-docs-search-implementation.html`](rfc/0001-docs-search-implementation.html) (also fixes local validation `<ol>` structure), [`docs/rfc/0002-docs-search-kpi-policy-and-slo.html`](rfc/0002-docs-search-kpi-policy-and-slo.html) — simpler English aligned with the documentation style guide.
- **Runbooks plain-language pass:** [`docs/runbooks/README.html`](runbooks/README.html) and all numbered runbooks (`0000`–`0010`) — shorter sentences and simpler vocabulary; [`docs/runbooks/0008-observability-scrape-failing.html`](runbooks/0008-observability-scrape-failing.html) gains a **Follow-up** section aligned with other runbooks.
- **Developer guides plain-language pass:** [`docs/developer/`](developer/) — simpler overviews and leads; clearer lists in requirements, schemas, business logic, and error-matrix guides; shorter Kibana/Elastic instructions in [`docs/developer/0007-local-development.html`](developer/0007-local-development.html); docs pipeline and Docker image pages tightened; **See also** links to the hub use anchor [`#developer-guides`](developer/README.html#developer-guides) (fixes redirect target vs [`docs/developer/README.html`](developer/README.html) section id).
- **Backlog plain-language pass:** [`docs/backlog/README.html`](backlog/README.html) — shorter intro (estimates vs ADR lifecycle), simpler legend and “how to update” steps, and tightened **Summary** / **Problem & value** text for backlog items.
- **Audit plain-language pass (superseded by 2026-04-18 layout):** earlier edits targeted the pre-restructure paths; current canonical assessments are under [`docs/audit/docs/`](audit/docs/README.html) and [`docs/audit/api/`](audit/api/README.html).

## 2026-04-17

### Added

- Shared favicon asset [`docs/assets/favicon.svg`](assets/favicon.svg) and favicon links across all documentation HTML pages under `docs/`.

### Changed

- Favicon handling is now automated for generated docs outputs:
  - [`scripts/render_docs_html.py`](../scripts/render_docs_html.py) injects favicon links for rendered markdown companion pages.
  - [`scripts/normalize_pdoc_output.py`](../scripts/normalize_pdoc_output.py) injects favicon links into pdoc-generated API reference pages under `docs/api/`.
  - [`scripts/inject_docs_favicon.py`](../scripts/inject_docs_favicon.py) provides a one-shot repo-wide backfill/normalization for docs HTML files missing a favicon tag.

## 2026-04-15

### Removed

- Legacy `docs/internal/user/index.html` (superseded by [`internal/api/user/index.html`](internal/api/user/index.html)); orphan assets `internal-doc-demo.css`, `internal-doc-nav.js`; unused `details.internal-doc-map` rules in [`docs/assets/docs.css`](assets/docs.css).

### Added

- [`docs/howto/README.html`](howto/README.html) — index for how-to guides.
- [`docs/howto/internal-service-docs-layout.html`](howto/internal-service-docs-layout.html) — directory layout for `docs/internal/`, shared chrome, and how to add or edit internal HTML pages (content moved from [`internal/STRUCTURE.md`](internal/STRUCTURE.md), which is now a short pointer).
- [`docs/howto/0004-how-to-add-post-contract.html`](howto/0004-how-to-add-post-contract.html) — beginner guide for `POST /api/v1/contract` (moved from [`developer/0004-how-to-add-post-contract.html`](developer/0004-how-to-add-post-contract.html); old URL redirects).

### Changed

- [`docs/internal/STRUCTURE.md`](internal/STRUCTURE.md) — now links to [`howto/internal-service-docs-layout.html`](howto/internal-service-docs-layout.html) instead of holding the full tree and steps inline.

- [`docs/assets/docs-nav.js`](assets/docs-nav.js): top nav item **How-to guides** (`howto/README.html`) and `activeTarget` for `howto/*` paths.

- `docs/internal/user-http-api.html` moved to [`docs/internal/api/user/user-http-api.html`](internal/api/user/user-http-api.html) (resource-scoped layout); sidebar and inbound links updated.

- Full User internal specification merged into [`docs/internal/api/user/index.html`](internal/api/user/index.html) (single entry point). [`docs/internal/api/user/user-http-api.html`](internal/api/user/user-http-api.html) is a redirect stub to `index.html` with hash preserved; per-method pages link to `../index.html#…`.

- [ADR 0025](adr/0025-external-and-internal-api-documentation.html): internal docs described as multi-page (`docs/internal/api/`, per-resource hub, [`STRUCTURE.md`](internal/STRUCTURE.md) / [how-to layout](howto/internal-service-docs-layout.html)).
- [ADR 0026](adr/0026-internal-service-documentation-as-source-of-truth.html): expanded with repository layout table, navigation ownership (`INTERNAL_SIDEBAR_NAV` in [`docs/assets/internal-sidebar.js`](assets/internal-sidebar.js)), contributor workflow, and ratification note (2026-04-15).

## 2026-04-14


### Added

- [ADR 0025](adr/0025-external-and-internal-api-documentation.html): external vs internal documentation — OpenAPI (`docs/openapi/`) as the sole normative HTTP contract for integrators; internal engineering narrative under `docs/internal/`; relationship table vs changelog, pdoc, Swagger views.

- [ADR 0026](adr/0026-internal-service-documentation-as-source-of-truth.html): internal service HTML as the authoritative engineering narrative for documented topics; scope (business rules, HTTP mapping via `operationId`, observability expectations, async boundaries); document history tables; index at [`docs/internal/README.html`](internal/README.html).

- [`docs/internal/README.html`](internal/README.html) — entry point for internal service docs (project + service overview); [`docs/internal/service-overview.html`](internal/service-overview.html) — redirect stub to the same page for old links.

- [`docs/internal/api/user/user-http-api.html`](internal/api/user/user-http-api.html) — internal specification for the User HTTP API (operations, idempotency, errors, logging, metrics, dependencies); lives under the User resource folder (see 2026-04-15 changelog).

- [`docs/internal/api/user/index.html`](internal/api/user/index.html) — User resource **internal hub** (contract links, method index). Per-endpoint pages under [`docs/internal/api/user/operations/`](internal/api/user/operations). How to extend `docs/internal/`: [`docs/howto/internal-service-docs-layout.html`](howto/internal-service-docs-layout.html) (see also [`internal/STRUCTURE.md`](internal/STRUCTURE.md)). Anchors on `user-http-api.html`: `#user-op-createUser`, `#user-op-getUserBySystemUserId`, `#user-op-updateUserBySystemUserId`, `#user-op-patchUserBySystemUserId`.

- [`docs/assets/docs-nav.js`](assets/docs-nav.js): top nav item **Internal (service)** and `activeTarget` for `internal/*` paths.

- Shared **assessment score** styling: `docs/assets/docs.css` defines `--audit-score-*` colours, `.audit-score-table` cell classes (`score-excellent`, `score-good`, `score-needs-attention`; `score-neutral` remains an alias), and `.audit-score-legend` / swatch layout. Canonical legend markup: [`docs/assets/audit-score-legend-fragment.html`](assets/audit-score-legend-fragment.html), injected by [`docs/assets/docs-nav.js`](assets/docs-nav.js) into `<div class="audit-score-legend-include" data-legend-id="…">` placeholders (see [ADR 0024](adr/0024-architecture-and-quality-assessment-documents.html#assessment-score-scale)). `SKIP_HTML_INDENT_NORMALIZE` in [`scripts/format_docs_html.py`](../scripts/format_docs_html.py) includes the fragment file.

- [ADR 0024](adr/0024-architecture-and-quality-assessment-documents.html): architecture and quality **assessment** documents — `docs/audit/` location, `YYYY-MM-DD-topic-assessment.html` naming, canonical HTML sections (lead metadata, Table 1 reference practices, Table 2 mapping/scores, narrative findings, mitigation, checklist, document history), goals, process (when to refresh, ownership, `docs/CHANGELOG.md`), relationship to ADRs/runbooks, alternatives, links to existing assessments, and a note on `SKIP_HTML_INDENT_NORMALIZE` in [`scripts/format_docs_html.py`](../scripts/format_docs_html.py).

- [`scripts/format_docs_html.py`](../scripts/format_docs_html.py): optional skip list `SKIP_HTML_INDENT_NORMALIZE` so the line-based indenter does not corrupt long HTML pages with multiline list items (ADR 0024 registered).

- [Developer guide 0010](developer/0010-make-commands-and-workflows.html): Make commands and workflows — PlantUML sources under [`docs/uml/make/`](uml/make/) (rendered PNGs via `make docs-fix`), composite pipeline and run/observability figures, tables of atomic targets by theme, if-then onboarding scenarios; linked from [docs index](index.html), [developer README](developer/README.html), [CONTRIBUTING](../CONTRIBUTING.md), [ADR 0008](adr/0008-make-command-taxonomy-and-workflow-entrypoints.html), [developers docs](developer/README.html), and [local development](developer/0007-local-development.html).

### Changed

- [ADR 0024](adr/0024-architecture-and-quality-assessment-documents.html): rewritten around a single **published assessment backbone** (ordered list: lead/TOC, scope/methodology, Table 1, Table 2 + injected legend, scoring summary, gaps 5.1–5.3, mitigation, optional beyond-baseline, checklist, document history); merged former implementation/validation into **Rollout and validation**; shorter alternatives; anchor `#published-assessment-backbone` replaces the old canonical-sections template list.

- [API assessment](audit/api/2026-04-14-rest-api-assessment.html): §8 actionable checklist, §9 document history, TOC entries for sections 7–9 (aligned with ADR 0024).

- [DX assessment](audit/docs/2026-04-14-documentation-experience-assessment.html): same section order as the API assessment; Table 2 anchor `table-2-study-app-scores`; invalid nesting and duplicate blocks removed.

- [ADR 0024](adr/0024-architecture-and-quality-assessment-documents.html): **Industry context and applicability** — how common large-org practices (RFC/launch/security/portal) relate to this repo’s lightweight rubric; **PET scale** and when low scores mean deferral, not failure; backbone now expects an industry/PET subsection under scope/methodology.

- [API assessment](audit/api/2026-04-14-rest-api-assessment.html): §1.6 industry/PET; restored §8 checklist and §9 document history (TOC).

- [DX assessment](audit/docs/2026-04-14-documentation-experience-assessment.html): §1.5 industry/PET; restored §7 checklist; Table 1 intro fixed; [audit index](audit/README.html) — “not a FAANG gate” card.

## <= 2026-04-12

### Changed

- [ADR 0019](adr/0019-python-dependency-security-pip-audit-and-pinning-policy.html): implementation marked **Done** (`data-adr-weight="7"`). [Backlog item-4](backlog/README.html#item-4) marked **Done**; `Makefile` **`verify-ci`** now includes **`deps-audit`** (engineering-practices table synced).

- [ADR 0022](adr/0022-embedded-swagger-ui-openapi-sandbox.html) superseded: browser validation cancelled; `openapi/openapi-explorer.html` is OpenAPI (test), Swagger browse-only; task on hold. Removed `openapi-live.html` (use app `/docs` for Try it out).

- All numbered ADRs (`0001`–`0017`): replaced legacy **Status** badge blocks with `data-adr-weight="7"` on `<main>` and a **Ratification** note for pre–ADR-0018 adoption; UI status comes from `docs/assets/docs-nav.js` per [ADR 0018](adr/0018-adr-lifecycle-ratification-and-badges.html). [ADR 0018](adr/0018-adr-lifecycle-ratification-and-badges.html) and [ADR 0019](adr/0019-python-dependency-security-pip-audit-and-pinning-policy.html) include the collapsible weight help from the [ADR template](adr/0000-template.html).

- ADR template: weight instructions in a collapsible `<details class="adr-weight-help">` (styles in `docs/assets/docs.css`); `data-adr-weight` default for new drafts is `-1` (not `9`, which clamped to `7`).

- ADR **Status log**: one attribute on `<main>` — `data-adr-weight` (−1…7); **current status** and the linear 8-step log derive from that value. [ADR template](adr/0000-template.html), [ADR 0018](adr/0018-adr-lifecycle-ratification-and-badges.html), `docs/assets/docs-nav.js`, `docs/assets/docs.css`.

- API reference generation: `scripts/normalize_pdoc_output.py` strips unstable `at 0x…` fragments from pdoc HTML so `make docs-check` stays reproducible; pdoc generation in `make docs-fix` runs with `PYTHONHASHSEED=0`.

- PlantUML under `docs/uml/`: architecture and sequence `.puml` sources include the shared style; rendered SVGs in `docs/uml/rendered/` updated to match ([ADR 0020](adr/0020-c4-plantuml-diagram-style-and-conventions.html)).

- Docs pipeline and contributor entrypoints: `scripts/regenerate_docs.py`, `scripts/sync_docs.py`, `Makefile`, `CONTRIBUTING.md`, and `.github/ISSUE_TEMPLATE/adr_discussion.md` aligned with ADR lifecycle, UML rendering, and synced HTML companions (`docs/developer/README.html`, `docs/internal/analysis/system-design.html`, `docs/backlog/README.html`, `docs/runbooks/README.html`, `docs/developer/0008-docs-pipeline.html`).


### Added

- [ADR 0021](adr/0021-continuous-delivery-github-actions-and-ghcr.html): continuous delivery via GitHub Actions — build <code>Dockerfile</code>, push to GHCR after CI, beginner-oriented context (CI vs CD), scope, and references; developer guide <a href="developer/0009-docker-image-and-container.html">0009</a> links to registry automation.

- [ADR 0019](adr/0019-python-dependency-security-pip-audit-and-pinning-policy.html): Python dependency security—`requirements.txt` as exact pin, `pip-audit`, Make/CI expectations, severity handling, and exception process (implements backlog policy; `make deps-audit` / CI wiring tracked there).

- Documentation changelog (`docs/CHANGELOG.md`) and ADR lifecycle policy ([ADR 0018](adr/0018-adr-lifecycle-ratification-and-badges.html)): Issue discussion with `[ADR]` title, ratification via Issue + PR, `data-adr-weight`, and `docs/CHANGELOG.md` update expectations.

- [ADR 0020](adr/0020-c4-plantuml-diagram-style-and-conventions.html): C4 views, PlantUML layout and naming conventions, and a shared diagram style via `docs/uml/include/style.puml` (with `docs/uml/README.txt` for authors).
