# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 2026-06-06 — Portal IA Variant C (service-catalog-first) + catalog lens-pages

#### Governance

- **ADR 0032 ratified** (`Proposed → Accepted`, same-day) — service-catalog-first IA modelled on Spotify Backstage. Seven decisions (D1–D7): service is the first-class entity; cross-cutting craft lives in `handbook/`; Diátaxis is a metadata attribute (`data-page-type`), not a folder; role hubs aggregate via tags; one canonical URL per page; the `dev` role token is normalised to `swe`; every page carries a closed `data-*` metadata schema. Three alternatives rejected: Variant A (role-at-spine — sidebar growth ceiling per RFC 0006), Variant B (Diátaxis-at-spine — defers the service-catalog refactor), tag-only retrofit. Eight-wave migration ships in this PR.
- **ADR 0031 amended** with a path-rename note — every reference to `foundations/reference/<discipline>/` reads as `handbook/<discipline>/` after W1. The D1–D5 canon (Explanation under handbook, 7-lens chip vocabulary, mandatory «What to read next» closer, contract-vs-coverage split, closed lens set) carries over unchanged.

#### Information architecture — 8 waves

- **W1 · `foundations/` → `handbook/` split** (50 file moves). All 24 SA-canon pages, 17 templates, 8 authoring how-tos, and `reader-personas.html` relocated to `handbook/`. 110 inbound files swept. Breadcrumbs rewritten («Internal > Foundations > Reference > SA > X» → «Internal > Handbook > X»).
- **W1+ · `handbook/sa/` consolidation** (55 file moves). After the initial split SA-content was scattered between `handbook/` root and subfolders; nested everything role-specific under `handbook/sa/` (24 canon pages + `templates/` + `authoring/`) for consistency with `handbook/swe/`, `qa/`, `sre/`. New `handbook/index.html` is a proper handbook-root landing with tiles for SA / SWE / QA / SRE / Manager + topic dirs.
- **W2 · runbooks & postmortems dispersal**. 10 runbooks moved from `how-to/incidents/runbooks/` to per-service `services/<svc>/runbooks/` (5 service-tied: api×2 + portal×3) and `handbook/sre/runbooks/` (3 cross-service: logging-failing, quality-check-failing, error-budget-exhaustion). 3 postmortems dispersed to `services/{api,portal,datastore}/postmortems/`. 5 new index landings created. Numeric prefixes preserved in H1 titles.
- **W3 · `explanation/` consolidation + `dev` → `swe` rename**. 14 explanation essays moved to `handbook/{swe,qa,sre}/`. `tutorials/dev/` → `tutorials/swe/`, `team/roles/dev/` → `team/roles/swe/` (33 file rename via `git mv`). 3 new handbook role landings (`swe/index.html`, `qa/index.html`, `sre/index.html`).
- **W4 · `reference/` top-level → `handbook/`**. 21 cross-cutting reference pages moved: `data/` (6 tables), `qa/` (4 + 5 checklists), `security/threat-model`, `manager/sdlc-raci-matrix`, `uml/` (whole tree), `glossary.html`, `capacity-snapshot.html`. `reference/service/make-commands.html` → `handbook/authoring/make-commands.html`.
- **W5 · `how-to/` remaining**. 10 procedural pages split: `docs-pipeline.html` → `services/portal/how-to/`, `internal-service-docs-layout.html` → `handbook/authoring/`, `qa/*` → `handbook/qa/`, `service/*` → `handbook/authoring/`. New `services/portal/how-to/index.html` landing.
- **W6 · metadata sweep** (411 pages). New body attributes per ADR 0032 D7: `data-service` (inferred from path), `data-role` (inferred from path), `data-lifecycle="published"`, `data-updated="2026-06-06"`. Authoring guidance updated; `scripts/sweep_roles.py` added as the path-based inference tool.
- **W7 · `catalog/` lens-pages** — new generator + new tree:
  - `scripts/build_catalog.py` (650 lines) — single-pass scanner reads `data-*` from every page body, produces 11 lens-pages: `catalog/by-quadrant/{tutorial,how-to,reference,explanation}.html`, `by-service/{api,portal,datastore,monitoring,ui-kit}.html`, `by-topic/{runbooks,postmortems,tests,on-call}.html`, `recent.html`, `index.html`.
  - **View switcher** (By group / Table) and **dual filter chips** (Group + Role) on every lens page. Page-local glue script honours URL hash state (`#group=api&role=sre` deep-links to a specific slice; chip-click updates hash).
  - **Cross-role token** — pages with empty `data-role` get synthetic `data-roles="cross-role"` so they're filterable from the UI.
  - **`catalog/index.html` hero** matches the canonical `home-hero home-hero--section` pattern (eyebrow + h1 + tagline + tickers); 4 sections: By quadrant · By service · By topic · Recent.
- **W8 · nav-tree restructure + landing polish**.
  - Top-level sections collapsed from 9 to 6: `Onboarding · Services · Handbook · Team · Governance · Catalog`. Obsolete Diátaxis-as-folder nodes deleted (Tutorials / How-to / Reference / Explanation).
  - `Services` subtree now exposes `runbooks/` + `postmortems/` automatically via `render_service_descriptors.py` (added to `DIATAXIS_SUBDIRS` tuple).
  - `Handbook` subtree expanded to 9 children: SA / SWE / QA / SRE / Data / Security / Manager / UML / Reader personas.
  - `Catalog` subtree exposes by-quadrant + by-service + by-topic + Recently updated.
  - Top-level `index.html` Operations row pinned to 3 tiles per row; new dedicated `Catalog` lp-pillar added next to Services.

#### Catalog generator and metadata

- **`scripts/build_catalog.py` new** — autogenerates 11 lens-pages from page metadata; idempotent and run from `make docs-fix`. Includes view switcher and dual group/role filter wiring with URL-hash state.
- **`scripts/sweep_roles.py` new** — infers `data-role` from path (e.g. `team/roles/sre/*` → `sre`, `handbook/sre/*` → `sre`, `services/<svc>/runbooks/*` → `sre`, `governance/audits/api/*` → `architect swe`). Multi-role permitted (space-separated).
- **`scripts/render_service_descriptors.py` extended** — `DIATAXIS_SUBDIRS` tuple now includes `runbooks` and `postmortems` so per-service runbook/postmortem folders auto-appear in sidebar without manual nav-tree edits. The sidebar is now self-restoring: new physical file = automatic nav entry on next `make docs-check`.
- **`services/datastore/catalog-info.yaml` new** — Backstage `apiVersion: backstage.io/v1alpha1, kind: Component` descriptor for the datastore service. Marker block `<!-- catalog:start id="entity-card" -->` added to `services/datastore/index.html` so `render_service_descriptors.py` can replace the entity card region.

#### Documentation craft

- **`handbook/sa/authoring/add-a-page.html` expanded** — new Step 3b «Set the metadata tags (mandatory)» documents the closed sets for all five `data-*` attributes with examples and a concrete SRE-runbook snippet. The Verify section is rewritten as an 11-point pre-merge checklist including catalog regeneration, role pill verification, and a one-liner sanity check (`python3 scripts/build_catalog.py && make docs-fix && make docs-check`).
- **`onboarding/index.html` extended** — new «Map of the portal — where things live» section with 6 tiles (one per top-level section) and a 6-question choice rule («where does a new page go?») with concrete folder targets. Closes the «I don't know where to put X» loop for new contributors.
- **`team/people/ivan-boyarkin/blog/*.html` retagged** — two blog posts moved from `data-page-type="explanation"` to `data-page-type="blog"` (outside Diátaxis). Catalog by-quadrant lenses no longer pick them up; they remain in `recent.html`.

#### Cleanup

- **`services/portal/internal/foundations/` deleted** — leftover thin role landings (`reference/{dev,qa,sre}/index.html`) plus the old `foundations/index.html` removed once their content was absorbed by `handbook/`.
- **`services/portal/internal/reference/` deleted** — top-level Diátaxis quadrant folder dropped after W4 moved its contents to `handbook/`. Last remaining artefact was a stale `reference/uml/input-hashes.json` cache file (live copy already at `handbook/uml/input-hashes.json`).
- **116 redirect stubs removed** — `<meta http-equiv="refresh">` stubs at old paths cleaned out after the inbound-link sweeps stabilised. External bookmarks pointing at moved URLs will 404 cleanly rather than chaining through stubs.

#### UI fixes (catalog)

- **Pill overflow fix on catalog cards.** Cards in the catalog now use a dedicated `.cat-card` layout: pills row sits on top, title below, body lede last. Replaces the inherited `.docs-card__head` flex-row layout which let long pill chains escape the right edge of narrow cards. CSS: `flex-wrap: wrap` on the chip row, `min-width: 0` + `text-overflow: ellipsis` on individual pills so multi-role / long service names degrade gracefully.
- **Toolbar filters stacked vertically.** Three filter rows (Group · Role · View) now lay out column-by-column instead of side-by-side; labels gain `min-width: 56px` for visual column alignment.
- **Sidebar group-header consistency.** `catalog-by-quadrant`, `catalog-by-service`, `catalog-by-topic` nodes now omit `href` so `sidebar.js` renders them as `.docs-sidebar__group` (uppercase mono) instead of `.docs-sidebar__link` (sentence case) — visually uniform with the `Recently updated` leaf below.

#### Type-check

- **`scripts/build_catalog.py` mypy fix** — `quad_counts: dict[str, int] = defaultdict(int)` and `svc_counts: dict[str, int] = defaultdict(int)` annotated explicitly. `defaultdict(int)` alone is opaque to mypy.

### 2026-05-26 — Make pipeline restored for the UI Kit v3 portal

#### Security

- **Three CVE-driven dependency bumps in `requirements.txt`:**
  - `idna 3.11 → 3.15` (CVE-2026-45409 — DoS via crafted `idna.encode()` input).
  - `urllib3 2.6.3 → 2.7.0` (PYSEC-2026-141 — cross-origin redirect leaks `Authorization`; PYSEC-2026-142 — decompression DoS).
  - `starlette 1.0.0 → 1.0.1` (PYSEC-2026-161 — Host-header path injection).
- **`pip` in `.venv` bumped 26.0.1 → 26.1.1** (CVE-2026-3219 — tar-vs-ZIP confusion; CVE-2026-6357 — self-update import-order race). Surfaced by the new local-mode pip-audit pass.

#### Changed

- **`make deps-audit` pivots to local-mode** ([`Makefile`](Makefile)): runs `pip-audit -l` against the live `.venv` instead of `pip-audit -r requirements.txt`, which spawns a temp venv whose `ensurepip` bootstrap hangs indefinitely on Python 3.14. Local mode is ~20× faster (~3 s vs. ~55 s), stricter (catches tooling like pip itself), and immune to the hang. ADR 0019 scope unchanged.
- **`make docs-fix` is now idempotent** — second consecutive run is a true no-op (was rewriting 600+ files on every cycle). Two root causes fixed:
  - [`scripts/repair_docs_html.py`](scripts/repair_docs_html.py): html5lib serialize was inserting one extra blank line before `</body></html>` on every parse-serialize round-trip. Collapse `\n{3,}` → `\n\n` before `</body>` so the pipeline converges.
  - [`scripts/format_docs_html.py`](scripts/format_docs_html.py): stop stripping page-local `<style>` overlays — those are intentional per-page kit complements (page-hero gradients, quad-card grids, radar lane backgrounds) and aren't worth promoting into the shared kit. The strip caused 32 pages to lose their CSS while the HTML still referenced the classes.
- **`make docs-fix` step list:** added `[6/10] render service catalog (YAML → HTML)` between `format` and `ensure-maintainers` so format/repair touches don't drift the catalog HTML downstream of `catalog-render-check`.
- **`format_docs_html.py` v3 detection widened** to recognise `ui-kit/**` showcase pages (was `internal/**` only). Showcase pages now keep their `entry.css` link instead of being force-fed the legacy `docs.css` + `docs-nav.js` stack.
- **Script-side path literals updated** for the post-IA-restructure tree — fixes `check_path_literals` failures across:
  - [`scripts/collect_docs_portal_data.py`](scripts/collect_docs_portal_data.py): profiles base path `internal/portal/people` → `internal/team/people`.
  - [`scripts/normalize_pdoc_output.py`](scripts/normalize_pdoc_output.py): `DOCS_ASSETS` corrected to `services/frontend/portal/assets`.
  - [`scripts/validate_docs_feedback.py`](scripts/validate_docs_feedback.py): `governance/audit/` → `governance/audits/`.
  - [`scripts/spec_lint.py`](scripts/spec_lint.py) + [`scripts/spec_consistency.py`](scripts/spec_consistency.py): glob and `ERROR_CATALOG` paths updated to `internal/services/api/reference/**`.
  - [`scripts/sync_docs.py`](scripts/sync_docs.py): drop the two HTML-target sync blocks for deleted pages (`internal/analysis/system-design.html`, `internal/handbook/howto/0003-make-commands-inventory.html`); point the errors-page sync at `internal/services/api/reference/errors.html`.
- **`scripts/spec_lint.py` understands the UI Kit v3 shape:** accepts `<footer class="docs-history">` in place of the legacy `<section id="page-history">`, skips the `docs-spec-status.js` script-link requirement on `body.docs-shell` pages (the kit doesn't ship that runtime), and matches the kit's `<pre class="docs-code"><span class="docs-code__lang">…</span><code>…</code></pre>` block shape so the example-block regex stops false-failing on properly-formatted code samples.
- **`scripts/validate_docs_design.py` frozen-paths updated** — `internal/roles/*/radar.html` → `internal/team/roles/*/radar.html`, notes-detection now matches `internal/team/people/<person>/notes/`, and `internal/index.html` is now treated as a router landing (no `<section id="page-history">` requirement).
- **`scripts/validate_docs_html.py` + `repair_docs_html.py` skip pdoc output** under `internal/services/api/code-reference/` — html5lib's `<wbr>` void-tag handling otherwise re-serialized the generator-owned HTML as broken.
- **`scripts/check_path_literals.py` heuristic extended:** add `tmp/var/build/dist` to the gitignored-output-dir allowlist and `ia_manifest.csv` to the known generated basenames so `ia_migrate.py`'s default output path stops false-failing.
- **`scripts/render_service_descriptors.py` typing fix** (`node: dict[str, object]`) to keep mypy clean after the recent ruff format reflow.
- **`.pre-commit-config.yaml` mypy hook** now declares `types-PyYAML==6.0.12.20260518` in `additional_dependencies` — pre-commit's isolated env doesn't see the project `.venv`'s site-packages, so the yaml stubs need declaring locally.

#### Removed

- **Five retired scripts deleted** (none wired into any Make target or pre-commit hook):
  - `scripts/audit_add_justification_column.py` — one-shot Justification-column migration, already applied.
  - `scripts/audit_front_docs_links.py` — `services/portal/internal/front/` was absorbed into the Diataxis tree; coverage now provided by `scripts/check_asset_refs.py`.
  - `scripts/capture_screen_specs.py` — referenced deleted `internal/front/screens/assets`.
  - `scripts/generate_token_gallery.py` — referenced deleted `internal/front/docs-frontend-token-gallery.html`.
  - `scripts/minify_portal_css.py` — conflicts with the "portal CSS must stay human-readable" rule; the `make minify-css` / `make minify-css-check` targets are dropped from the `Makefile`.
- **230 lines of dead handbook-table helpers in `scripts/sync_docs.py`** — `_handbook_doc_entries`, `_render_handbook_rows_html`, `_HANDBOOK_*` constants, `_should_include_handbook_doc`, `_doc_sort_key`, `_extract_html_title`, `_render_endpoints_html`, `_render_makefile_html` — none had call sites after the handbook target pages were deleted from the IA.

#### Fixed

- **924 malformed `<a class="docs-history__author" … data-variant="sm"</a>` tags repaired across 473 pages.** The start-tag `>` had been stripped by a prior buggy script pass, breaking HTML5 parsing. Bodies left empty (the kit's `author-chip.js` injects content on mount).
- **70+ broken cross-doc anchors unwrapped** (`href="X">text</a>` → `text`) for refs pointing at deleted pages (`internal/explanation/system-design.html`, `internal/sre/{severity,dora}.html`, `internal/governance/rfc/0004-service-catalog.html`, etc.); 23 surgical depth fixes (off-by-one `../`) in `internal/reference/front/{contracts,patterns,screens}/*`; rename `diataxis-v2.html` → `diataxis.html`; dir-rewrite `internal/roles/` → `internal/team/roles/` in UI Kit showcase. `check_asset_refs` now passes across 8515 references.
- **Page-local `<style>` overlays restored** on 32 pages where the broken `format_docs_html.py` had stripped them on prior runs while the page HTML still referenced the classes (`foundations/index.html`, `onboarding/index.html`, `services/datastore/index.html`, `governance/{adr,audits,rfc}/index.html`, 17 `handbook/*.html`, three radar/landing pages, etc.). Source recovered from `git HEAD`; spliced in immediately after the canonical `entry.css` / `docs.css` `<link>`.
- **A11y heading hierarchy** — ~20 pages had `h1 → h3` or `h2 → h4` skips. Fixes by class:
  - **CTA cards** in `reference/{dev,qa,foundations-reference}/index.html`: `<h3>` → `<h2>` + matching CSS selector update so visual size stays the same.
  - **UI Kit index pages** (`foundations/index.html`, `components/index.html`, `templates/index.html`, `templates/ops-cockpit.html`): top-level `.docs-card__title` `<h3>` → `<h2>`.
  - **Leading-card-before-h2 pages** (`templates/ops-runbook.html` "Escalation"; `templates/doc-howto.html` "Prerequisites"): `<h3>` → `<h2>`.
  - **Six role radars** (`team/roles/{architect,dev,manager,qa,sa,sre}/radar.html`): Legend / Summary / 5-groups `<h3>` → `<h2>`.
  - **`entity-card.html` showcase** had 6× `<h1>` (1 page + 5 example cards); example cards demoted to `<h2>`.
  - **ADR 0022 "Superseded" status pill** was a stray `<h3>` outside the heading hierarchy; converted to `<span class="docs-card__title">`.
  - **`reader-personas.html` / `topology.html` / 2026-05-24 principal-triad-docs audit**: `<h4>` rows under their immediate `<h2>` promoted to `<h3>`.
- **Illegal `--` inside HTML5 comments stripped** from `ui-kit/pages/templates/ops-cockpit.html` and `governance/audits/index.html` (`<!-- /.cockpit-view--board -->`-style closing markers were causing html5lib parse errors). The JS doesn't depend on them.
- **Hub slimming:** `reference/dev/index.html` and `handbook/qa/index.html` slimmed to hero + radar CTA only (the practice/checklist content now lives on the role radars and per-practice pages). Stale TOC items + unused CSS dropped; both pages mirror each other's shape.
- **Lens-chip "How this page reads" legend → tooltip migration:** the bulky collapsible legend was deleted from 18 handbook pages; lens definitions now live on the chips themselves (auto-attached by the new [`services/frontend/portal/assets_v2/ui-kit/components/lens-chip.js`](services/frontend/portal/assets_v2/ui-kit/components/lens-chip.js), rendered by the shared `tooltip.js` runtime on hover/focus). `ui-kit/components/reading-guide.{js,css}` deleted; entry CSS/JS imports updated.
- **2 unused CSS var references resolved** — `var(--mono)` → `var(--font-mono)` in `catalog-layout.css`; `var(--font-size-sm)` → `var(--fs-meta)` in `home.css`.

#### Tests

- **`tests/api/v1/test_docs_search_telemetry_api.py`** — `test_docs_search_telemetry_metrics_reports_query_counts` had hard-coded April-2026 timestamps. The metrics endpoint clamps the rolling window to 30 days; the test rotted as today drifted past that boundary. Replaced with `time.time()`-derived timestamps so the test stays correct over time.

### Added

- **Portal CSS minifier + Make targets:** new [`scripts/minify_portal_css.py`](scripts/minify_portal_css.py) (paren-aware, idempotent — preserves `calc(...)` / `var(...)` arithmetic and `/*! ... */` legal comments) plus `make minify-css` and `make minify-css-check` targets in [`Makefile`](Makefile). Originally applied across every stylesheet under `services/frontend/portal/assets/`; reverted on 2026-05-09 for [`docs.css`](services/frontend/portal/assets/docs.css), [`public-layout.css`](services/frontend/portal/assets/public-layout.css), and [`internal-layout.css`](services/frontend/portal/assets/internal-layout.css), which are now committed in formatted form so they can be reviewed and edited directly. The minifier and Make targets remain available as opt-in build-time tools.
- **Three repository-hygiene checkers** for path-rot detection after the `services/{frontend,portal}` split:
  - [`scripts/check_asset_refs.py`](scripts/check_asset_refs.py) — walks `href`/`src`/`poster`/`data-src` and CSS `url(...)` references; fails on dangling relative paths.
  - [`scripts/check_css_vars.py`](scripts/check_css_vars.py) — every `var(--name)` without a fallback must resolve to a `--name:` declaration somewhere across `*.css` / inline `style=` / JS `setProperty` sources.
  - [`scripts/check_path_literals.py`](scripts/check_path_literals.py) — AST-walks `scripts/*.py` for `ROOT / "literal"` chains and asserts the resolved path exists (with an output-artifact heuristic for write targets).
- **`make pre-commit-validate` target:** runs the three checkers above plus `make verify`; pairs with the existing `/pre-commit-validate` slash command for non-trivial diffs.
- **UI/UX audit stream:** new directory [`services/portal/internal/governance/audit/ui-ux/`](services/portal/internal/governance/audit/ui-ux/) with its own `index.html` and three assessments (`2026-04-23`, `2026-04-24`, `2026-05-09-ui-ux-consistency-assessment.html`). The audit landing page [`services/portal/internal/governance/audit/index.html`](services/portal/internal/governance/audit/index.html) now splits DX and UI/UX into separate sections (`#dx`, `#ui-ux`, `#api`, `#bug-audit`).
- **Frontend token gallery page:** [`services/portal/internal/front/docs-frontend-token-gallery.html`](services/portal/internal/front/docs-frontend-token-gallery.html) generated from [`scripts/generate_token_gallery.py`](scripts/generate_token_gallery.py) (visual reference for design tokens used across the portal).
- **Standalone docs search runtime:** [`services/frontend/portal/assets/docs-search.js`](services/frontend/portal/assets/docs-search.js) extracted as a separate module so the public portal can ship the search UI without pulling internal navigation scripts.
- **Token-driven shared portal shell `docs-shell.css` (Commit 1 of public/internal layout unification):** new [`services/frontend/portal/assets/docs-shell.css`](services/frontend/portal/assets/docs-shell.css) defines the single source of truth for shell geometry shared by `body.public-layout` and `body.internal-layout`. Per-portal differences expressed as 14 CSS custom properties (`--shell-max-width`, `--shell-pad`, `--shell-pad-mobile`, `--sidebar-width`, `--sidebar-collapsed-width`, `--sidebar-bg`, `--sidebar-pad`, `--sidebar-mobile-pad`, `--sidebar-mobile-display`, `--sidebar-z`, `--main-pad-left`, `--container-max-width`, `--container-margin-inline`, `--container-pad`). Loaded automatically via the existing `@import` chain in [`services/frontend/portal/assets/docs.css`](services/frontend/portal/assets/docs.css). Geometry rules removed from [`public-layout.css`](services/frontend/portal/assets/public-layout.css) and [`internal-layout.css`](services/frontend/portal/assets/internal-layout.css) (~190 duplicated lines collapsed). Full per-rule rationale in [`services/portal/CHANGELOG.md`](services/portal/CHANGELOG.md#2026-05-09).
- **ADR 0030 — Portal shell token contract (Proposed):** [`services/portal/internal/governance/adr/0030-portal-shell-token-contract.html`](services/portal/internal/governance/adr/0030-portal-shell-token-contract.html) ratifies the architecture introduced by the Commit 1/Commit 2 layout-unification pair: `docs-shell.css` is the single source of shell geometry; per-portal differences are CSS custom properties on the body class (the fourteen-token contract); identity-only styles stay in `public-layout.css` / `internal-layout.css`. Codifies the authoring rules (geometry selectors live once, no branching by selector, wide widgets opt out at the widget) and the workflow for adding a third portal. Linked from the Documentation &amp; diagrams section and full index of [`services/portal/internal/governance/adr/index.html`](services/portal/internal/governance/adr/index.html).

### Changed

- **Portal router landing redesign:** [`services/portal/index.html`](services/portal/index.html) restyled around a `portal-router` shell — flashlight theme toggle button, hero `portal-router__title`, and refreshed copy. Old `docs-top-nav` mount and inline `card` wrapper retired in favour of the dedicated layout. Follow-up (2026-05-09): the residual `#docs-top-nav` mount and `docs-nav.js` import were dropped from the landing, since the choice page does not need a search bar or wordmark before a portal is picked. Details: [`services/portal/CHANGELOG.md`](services/portal/CHANGELOG.md#2026-05-09).
- **UI/UX assessments relocated:** removed `services/portal/internal/governance/audit/docs/2026-04-23-ui-ux-assessment.html` and `…/2026-04-24-ui-ux-assessment.html` (moved under the new `ui-ux/` stream); cross-references updated in `audit/index.html` and the 2026-05-01 documentation-experience assessment.
- **Internal sidebar polish:** small wiring fix in [`services/frontend/portal/assets/internal-sidebar.js`](services/frontend/portal/assets/internal-sidebar.js) and [`docs-nav.js`](services/frontend/portal/assets/docs-nav.js).

- **Standalone public developer portal sidebar:** new [`services/frontend/portal/assets/public-layout.css`](services/frontend/portal/assets/public-layout.css) (grid layout, sticky sidebar, mobile drawer) and [`services/frontend/portal/assets/public-sidebar.js`](services/frontend/portal/assets/public-sidebar.js) (public-only nav tree: Tutorials / How-to / Reference / Explanation, wordmark, active-page highlight). All 16 public pages under `services/portal/public/` updated to use the new layout; internal scripts (`docs-portal-data.js`, `docs-internal-meta.js`) removed from public pages so the portal is self-contained and publishable independently.

- **OpenAPI 4xx validation-error descriptions:** new module [`app/openapi/validation_error_openapi.py`](app/openapi/validation_error_openapi.py) enriches `400` / `422` response descriptions on every operation in the generated OpenAPI schema. Wired into `custom_openapi()` in [`app/main.py`](app/main.py) alongside the existing request-id enricher; baseline regenerated under [`services/portal/openapi/openapi-baseline.json`](services/portal/openapi/openapi-baseline.json). Closes audit finding `sev-2-oas-descriptions` from the 2026-04-14 REST-API assessment. Details: [`services/portal/CHANGELOG.md`](services/portal/CHANGELOG.md#2026-05-08).
- **`no-artifact-files` pre-commit hook:** [`scripts/check_no_artifact_files.sh`](scripts/check_no_artifact_files.sh) refuses to stage local CI / runtime artifacts (`.coverage`, `*.db`, `PR_BODY.md`, `changelog-llm-draft.md`); wired into [`.pre-commit-config.yaml`](.pre-commit-config.yaml) as `id: no-artifact-files` (`always_run: true`, `stages: [pre-commit]`). Closes the SEV-3 repository-hygiene finding from the 2026-05-07 portal bug audit.
- **Employee portal:** profile for **Kirill Neustroev** (DevOps) under `services/portal/internal/portal/people/kirill-neustroev/`; his person id is included in `data-maintainer-ids` on the internal error catalog page (`services/portal/internal/api/errors.html`).


### Fixed

- **Diagram lightbox — listener leak fixed** (2026-05-09): [`services/frontend/portal/assets/docs-diagram-lightbox.js`](services/frontend/portal/assets/docs-diagram-lightbox.js) — global `window.mousemove`/`window.mouseup`/`document.keydown` listeners are now registered through a per-`open()` `AbortController` and released on `close()` (previously they lived for the entire page lifetime, including pages with no UML diagrams). Lightbox UI is also created lazily on first open. Closes F-01 from the 2026-05-09 portal bug audit. Details: [`services/portal/CHANGELOG.md`](services/portal/CHANGELOG.md#2026-05-09).
- **Internal layout — drawer Menu button no longer pinned to the H1** (2026-05-09): [`services/frontend/portal/assets/docs-nav.js`](services/frontend/portal/assets/docs-nav.js) `mountInternalDrawerMenuButton()` now mounts the `Menu` pill as a standalone block immediately after `#docs-top-nav` (mirroring `injectMenuButton()` in [`public-sidebar.js`](services/frontend/portal/assets/public-sidebar.js)) instead of wrapping the H1 in a flex row alongside it; `syncInternalThemeTogglePlacement()` was decoupled and only creates the `.internal-layout__page-title-row` (H1 + theme toggle) when the H1 is a direct child of `main`. Fixes hero-driven pages like [`internal/governance/backlog/index.html`](services/portal/internal/governance/backlog/index.html) where the previous logic anchored the button deep inside `.backlog-hero__copy`. CSS in [`internal-layout.css`](services/frontend/portal/assets/internal-layout.css) updated for standalone-block use (`display: inline-flex; margin-bottom: 20px`); component reference in [`internal/front/foundations/css-architecture.html`](services/portal/internal/front/foundations/css-architecture.html) updated. Details: [`services/portal/CHANGELOG.md`](services/portal/CHANGELOG.md#2026-05-09).
- **18 broken internal links** across 12 documentation files: corrected path traversal errors in `services/portal/internal/handbook/qa/playbooks/` (checklist paths one level too deep), `services/portal/internal/governance/audit/` (wrong `AUDIT_TEMPLATE.html` depth in sub-indexes, stale `services/portal/` prefix in `audit/index.html`, non-existent `bug-audit/` dir reference), `services/portal/internal/catalog/api/data/users.html` (pdoc link to non-existent `models/core/user.html` — now points to `models.html`), cross-references between `internal/manager/sdlc-raci-matrix.html` ↔ `internal/portal/people/ivan-boyarkin/notes/sa-growth.html`, and ADR 0027 filename in `audit/docs/2026-05-01-documentation-experience-assessment.html`.
- **Accessibility:** heading jump `h1 → h3` in `services/portal/internal/sre/postmortems/index.html` corrected to `h1 → h2`; `make docs-a11y-check` passes clean.

### Changed

- **Personal notes translated to English:** `services/portal/internal/portal/people/ivan-boyarkin/notes/week-calendar-2026-05-07.html` and `sa-growth.html` (1508-line SA competency tracker, 67 competency rows) converted from Russian to English; `lang="ru"` → `lang="en"`.
- **Python script formatting:** 10 scripts under `scripts/` reformatted by Black (`make format-fix`); `make format-check` now passes without errors.
- **Documentation artifacts:** refreshed generated docs outputs (`services/portal/internal/governance/audit/index.html`, `services/portal/internal/governance/audit/bugs/2026-05-07-portal-bug-audit.html`, `services/portal/openapi/index.html`, `services/frontend/portal/assets/docs-portal-data.js`, `services/frontend/portal/assets/search-index.json`) after running the full services/portal/verify pipeline so repository state matches formatter/repair/indexer outputs and CI checks remain reproducible.

- **Documentation:** internal frontend docs under `services/portal/internal/front/` were reorganized into foundations, contracts, components, screens, patterns, and `_shared` authoring folders; added typed-spec templates, [`scripts/front_spec_lint.py`](scripts/front_spec_lint.py), and wired it into `make docs-spec-check`. Details: [`services/portal/CHANGELOG.md`](services/portal/CHANGELOG.md#2026-05-06).

- **Documentation:** unified hand-authored inline hints on `data-tooltip` (shared `docs.css` rules), added SDLC RACI matrix under `services/portal/internal/manager/`, and a normative frontend guide for tooltips at `services/portal/internal/front/components/tooltips.html`. Details: [`services/portal/CHANGELOG.md`](services/portal/CHANGELOG.md#2026-04-24).

- **Documentation:** internal employee portal (`services/portal/internal/portal/`), generated portal data in `services/frontend/portal/assets/docs-portal-data.js`, page history sections and validation on hand-written HTML, and related scripts (`collect_docs_portal_data.py`, `ensure_docs_page_history.py`, and helpers). Details: [`services/portal/CHANGELOG.md`](services/portal/CHANGELOG.md#2026-04-21).

- **Docs UI:** follow-up polish to shared styles and chrome (`services/frontend/portal/assets/docs.css`, `docs-theme.css`, `docs-nav.js`, `internal-sidebar.js`, `docs-internal-meta.js`) and portal profile pages; regenerated `docs-portal-data.js` and client-side `search-index.json` to match maintained pages and the new assessment.

- Documentation HTML pages now use a shared favicon (`services/frontend/portal/assets/favicon.svg`), including `services/portal/openapi/openapi-explorer.html`, with generation/backfill scripts keeping favicon links consistent across regenerated docs output.

- **Backlog UX overhaul:** `services/portal/internal/governance/backlog/index.html`, `services/portal/internal/governance/backlog/backlog.js`, and `services/portal/internal/governance/backlog/backlog.css` now provide a simplified backlog workflow with normalized tags/priorities/statuses, reordered top sections, synchronized filtering across grouped and full task views, per-group counters, "show more" paging in group lists, empty-filter state messaging, and recalibrated estimate ranges in each task card.

### Removed

- Sample multi-file deployment manifests, the env-to-manifest render script, and the matching Make targets. Documentation and ADR 0015 now describe the Docker image only; see `services/portal/internal/handbook/developer/0009-docker-image-and-container.html`.

### Security

- Bumped `Mako` from `1.3.10` to `1.3.12` in [`requirements.txt`](requirements.txt) to clear [CVE-2026-44307](https://nvd.nist.gov/vuln/detail/CVE-2026-44307): on Windows, a URI using backslash traversal (e.g. `\..\..\secret.txt`) bypassed the directory-traversal check in `Template.__init__` and the `posixpath`-based normalization in `TemplateLookup.get_template()`, allowing reads of files outside the configured template directory. Mako is a transitive dependency of `alembic` in this project (no in-repo template lookups), so production exposure is limited; the bump unblocks `make deps-audit` / `make verify` in CI.

## [1.1.1] — 2026-04-17

### Added

- Client-side docs search implementation package:
  - index builder `scripts/build_docs_search_index.py`,
  - generated artifact `services/frontend/portal/assets/search-index.json`,
  - ranking/runtime UI integration in `services/frontend/portal/assets/docs-nav.js`,
  - ADR `services/portal/internal/governance/adr/0027-client-side-docs-search-index-and-ranking.html`.


- Docs-search telemetry ingestion and aggregation:
  - store module `app/core/docs_search_telemetry.py`,
  - API schema `app/schemas/telemetry.py`,
  - ingest endpoint `POST /internal/telemetry/docs-search`,
  - metrics endpoint `GET /internal/telemetry/docs-search/metrics`.

- RFC documentation area for implementation-level specs:
  - `services/portal/internal/governance/rfc/index.html`,
  - `services/portal/internal/governance/rfc/0001-docs-search-implementation.html`.

- Formal accessibility workflow: `.github/workflows/a11y-formal-checks.yml`.

### Changed

- Internal and top navigation updated to include ADR/RFC entry points and stable links from docs home and internal pages.

- Local docs-search troubleshooting and validation guidance expanded in developer docs (`services/portal/internal/handbook/developer/0007-local-development.html`), including CORS/preflight and SQLite verification steps.

## [1.1.1] — 2026-04-12

### Added

- ADR 0017: branch naming (`feature/`, `fix/`, `services/portal/`, `chore/`, `refactor/`), `main` as integration branch, release tags `v*.*.*`, and hotfix forward-port guidance.

- ADR 0020: C4 views, PlantUML conventions, shared diagram style (`services/portal/internal/uml/include/style.puml`), and `services/portal/internal/uml/README.txt` for authors.

- [ADR 0021](services/portal/internal/governance/adr/0021-continuous-delivery-github-actions-and-ghcr.html): continuous delivery of the container image (GitHub Actions → GHCR), CI vs CD, scope, and why runtime secrets stay outside the workflow.

- GitHub Actions: **CD** job **`publish-image`** builds the [`Dockerfile`](Dockerfile) and pushes to **GHCR** (`ghcr.io/<owner>/<repo>`) on successful **`quality`** (and **`changelog`** when that job runs) after push to **`main`** / **`master`** or **`v*`** tags. Uses the default **`GITHUB_TOKEN`** (`packages: write`); image tags include **short SHA**, **`latest`** on the default branch, and **semver** labels on version tags.

- **Embedded Swagger UI:** [services/portal/openapi/openapi-explorer.html](services/portal/openapi/openapi-explorer.html) loads the committed OpenAPI snapshot (`services/portal/openapi/openapi-baseline.json`) with **Try it out**; top nav link **Swagger UI**; linked from docs index, developer index, and README.

- **Structured logging and optional local Elasticsearch:** NDJSON (`LOG_FORMAT=json`, or leave unset — application default is **json**), `LOG_SERVICE_NAME`, `X-Request-Id` middleware, `docker-compose.logging.yml` (Elasticsearch, Kibana, Filebeat), `make logging-up` / `logging-down` / `logging-smoke` / `logging-reset` / `logging-es-query`, and [ADR 0023](services/portal/internal/governance/adr/0023-structured-logging-and-local-elasticsearch.html). `trace_id` / `span_id` are reserved in JSON logs for future OpenTelemetry.

- **X-Request-Id in browsers and Swagger:** `CORS_EXPOSE_HEADERS` (default includes `X-Request-Id`) so cross-origin clients can read the correlation header; OpenAPI documents optional request header and response `X-Request-Id` on every operation for Swagger UI **Try it out**.

- **Logging defaults for correlation:** `LOG_FORMAT` defaults to **json** (NDJSON with top-level `request_id`); `env/dev` sets `LOG_FORMAT` + `CORS_EXPOSE_HEADERS`; Uvicorn runs with **`--no-access-log`** so duplicate `uvicorn.access` lines (without `request_id`) are not written—HTTP traces use `app.main` `request_done` only.

- **Kibana / Elasticsearch:** Documented data view index pattern **`*study-app-logs*`** (not only `study-app-logs-*`) so Discover includes `.ds-study-app-logs-*` backing indices; Filebeat sets **`setup.template.type: legacy`** for classic daily index names on new data.

- **Dependency security (backlog item-4):** `pip-audit` was already pinned and run in CI; **`make verify-ci`** now runs **`make deps-audit`** first so local pre-push matches the **`quality`** job (`deps-audit` then **`make verify`**). Backlog [item-4](services/portal/internal/governance/backlog/index.html#item-4) marked **Done**; [ADR 0019](services/portal/internal/governance/adr/0019-python-dependency-security-pip-audit-and-pinning-policy.html) implementation status set to **Done** (`data-adr-weight="7"`).

### Changed

- PlantUML in `services/portal/internal/uml/`: diagram sources and rendered SVGs updated; shared style via `services/portal/internal/uml/include/style.puml` ([ADR 0020](services/portal/internal/governance/adr/0020-c4-plantuml-diagram-style-and-conventions.html)).

- Documentation pipeline and contributor touchpoints: `scripts/regenerate_docs.py`, `scripts/sync_docs.py`, `Makefile`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/adr_discussion.md`, and synced HTML pages (e.g. engineering practices, system design, backlog, runbooks, developer docs) brought in line with ADR lifecycle and UML generation.

- **OpenAPI (test):** **`services/portal/openapi/openapi-explorer.html`** — Swagger UI against `openapi-baseline.json` for browsing only (**Try it out** disabled). Browser-side Ajv validation and **`services/frontend/portal/assets/openapi-sandbox.js`** removed. **[ADR 0022](services/portal/internal/governance/adr/0022-embedded-swagger-ui-openapi-sandbox.html)** marked superseded; validation approach on hold. **`services/portal/openapi-live.html`** removed (use app **`/docs`** for Try it out). README and indexes updated.

- **CORS (`env/example`):** comment clarifies static `services/portal/openapi/openapi-explorer.html` does not call the API; origins for `:8765` remain for browser access to the API from the same docs origin (e.g. FastAPI `/docs`).

## [1.1.1] — 2026-04-11

### Added

- ADR 0014: dead-code hygiene (Ruff F401/RUF100, Vulture, `make dead-code-check`, weekly workflow).
- ADR document `services/portal/internal/governance/adr/0013-changelog-and-release-notes.html` outlining changelog and release‑notes policy.
- New script `scripts/llm_client.py` providing an LLM client interface.
- New script `scripts/llm_ping.py` for health‑checking the LLM service.
- `Dockerfile`, `.dockerignore`, and `scripts/container_entrypoint.sh` for reproducible container builds.
- README and developer guide clarify that Docker is optional for daily development, and outline how real-world deploys typically use a registry and target environment.
- Developer guide for the container image and ADR 0015 (container image).
- Makefile targets `docker-build`, `container-start` (same entrypoint script as Docker).
- ADR 0016 (Google-style Python docstrings, alignment with `make api-docs` / pdoc), developer index entry, and `.cursor/rules/python-docstrings.mdc` for editor guidance; expanded module docstrings across `app/`.

### Changed

- GitHub Actions quality job runs `make verify` (applies `docs-fix` on the runner) instead of `make verify-ci` / `docs-check`, avoiding false failures when generated docs drift from `HEAD`.
- Updated `CONTRIBUTING.md` with new contribution guidelines.
- Minor adjustments to `Makefile` for build and test targets.
- Updated `requirements.txt` to include dependencies required by the new LLM scripts.
- Refactored `scripts/changelog_draft.py` to integrate LLM generation logic and improve draft creation.
- `CHANGELOG.md`, `README.md`, and `CONTRIBUTING.md` updated for container workflows and discovery of new docs.
- `services/portal/internal/governance/adr/index.html` and `services/portal/internal/handbook/developer/index.html` link to ADR 0015 and the Docker image developer guide.
- `env/example`, `requirements.txt`, and `.gitignore` adjusted for new tooling and generated paths.
- `scripts/format_docs_html.py` and `scripts/sync_docs.py` updated alongside the documentation pipeline.
- `services/portal/internal/handbook/developer/0008-docs-pipeline.html` updated (versioning notes, pdoc output path `services/portal/api/`, optional CI).
- `scripts/changelog_draft.py` feeds commit messages, name-status paths, and a stronger system prompt so LLM changelog drafts reflect substance rather than diff stats only.


## [1.1.0] — 2026-04-10

### Added

- `PUT /api/v1/user/{system_user_id}` — full replacement of mutable profile fields with `Idempotency-Key` and validation codes `USER_014`–`USER_024`.
- `PATCH /api/v1/user/{system_user_id}` — partial update with `Idempotency-Key`; empty body returns `USER_PATCH_BODY_EMPTY` (`USER_102`); idempotency scope uses path prefix `PATCH /api/v1/user/...` (distinct from `PUT`).
- Changelog practice (ADR 0013), optional `scripts/changelog_draft.py`, and CI changelog gate for user-facing paths.

### Changed

- API / OpenAPI version **1.1.0** (see `app/main.py`).
