# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- **services/api:** bumped `starlette` 1.0.1 → 1.3.1 to close four CVEs
  flagged by `pip-audit`:
  - CVE-2026-48818 — Windows SSRF in `StaticFiles` via UNC paths (fix ≥ 1.1.0).
  - CVE-2026-48817 — `HTTPEndpoint` dispatches arbitrary attributes for
    non-standard HTTP verbs when `methods=` is omitted (fix ≥ 1.1.0).
  - CVE-2026-54283 — `request.form()` ignores `max_fields` / `max_part_size`
    on `application/x-www-form-urlencoded` bodies; sub-10 MB payload can
    block the event loop or force unbounded allocation. DoS without auth
    (fix ≥ 1.3.1).
  - CVE-2026-54282 — `request.url` reconstruction lets a malformed path
    move the authority boundary, making `request.url.hostname` attacker-
    controlled in middleware / 404-handlers (fix ≥ 1.3.0).

  FastAPI 0.135.3 runs cleanly against starlette 1.3.1 — verified by
  `make -C services/api verify` (deps-audit + openapi + contract + tests
  at 91 % coverage).

### Added

- **API-first onboarding:** full four-quadrant Diátaxis pack for the API-first
  workflow under `services/portal/internal/handbook/sa/` — tutorial
  (`tutorial/api-first.html`), how-to (`authoring/apply-api-first.html`),
  reference (`reference/api-first-toolchain.html`), explanation
  (`explanation/from-yaml-to-mock.html`). ADR 0036 is the policy anchor;
  `api-analytics-epic.html` is the 14-endpoint decomposition roadmap.
- **OpenAPI fragment canon (ADR 0036):** two side-by-side canon trees under
  `services/portal/internal/services/api/openapi/` — `test/` for smoke
  endpoints (createCourse, getCourse, getUser, updateUser) that tutorial +
  examples reference, and `etr_study_app/` for the real production canon.
  First back-fill fragment: `etr_study_app/fragments/user/createUser.yaml`,
  mirroring the shipped FastAPI `createUser` handler with all headers,
  request/response schemas, and 400/401/409/413/422/429 examples that match
  the Pydantic + `ApiErrorResponse` shapes.
- **Tooling — validator + spec-driven mock (Python-only):**
  `tools/governance/validate_openapi.py` validates every fragment, resolves
  cross-file `$ref`, emits per-tree `fragments-index.json` +
  `merged-spec.json` (downgraded to OpenAPI 3.0.3 for Connexion
  compatibility). `tools/api/mock_server.py` fans out one Connexion + Flask
  mock per discovered canon (test → :8001, product canons → :8002+ in
  alphabetical order); auto-reload via `watchfiles`; dynamic overlay + RFC
  7240 `Prefer:` header for selecting documented examples; body validation
  reshapes 400 into the documented `ErrorBody` envelope.
- **Make targets — universal, convention-based:** `make api-check` (all
  canons or `make api-check user` for one resource across every canon that
  has it), `make api-mock` (fan-out to every canon). No `TREE=` / `FILE=` /
  `DIR=` variables — «canon = any directory under `openapi/*/fragments/`»,
  ports assigned by convention (`test=8001`, others `8002+` alphabetically).
- **UI Kit — `.try-it-out` component:** spotlight CTA on every API spec page
  and the API-spec template — three cards (built-in mock UI, portal
  preview, canon fragment) with a live health probe that pings each mock's
  `/openapi.json` every 8 s and shows `ready` / `not running` / `checking`.
  Styles in `ui-kit/components/api-spec-structure.css`; probe in the new
  `ui-kit/components/try-it-out.js`.
- **`x-build-history: code-first` provenance tag** on the first back-fill
  fragment (`createUser.yaml`), plus `x-portal-spec` link to the paired
  human view. Both pages coexist per ADR 0036 D6.

### Changed

- **ci:** `changelog` job in `.github/workflows/ci.yml` now runs on PRs into
  `staging` (and pushes to `staging`), not only into `main`/`master`. Closes
  the gap where a `services/api/` change could land on staging without a
  CHANGELOG entry and only surface at the `staging → main` PR.
- **Merger:** `regenerate_merged_spec()` downgrades OpenAPI 3.1 idioms to
  3.0-compatible shapes (`type: [string, "null"]` → `type: string` +
  `nullable: true`; Schema-level plural `examples` → singular `example`).
  Fragments stay 3.1 on disk; conversion is only in the build output.
- **Portal spec page — `post-api-v1-user.html`:** new spotlight «Try it out»
  block between endpoint-hero and Metadata (replaces the two dl rows that
  quietly linked the fragment). History entry documents the back-fill.
- **Docs — API-first mock lifecycle:** tutorial Phase 5, how-to Step 3,
  reference Layer 3 table, and explanation §4 all updated for the fan-out
  reality — every canon on its own port, `Ctrl-C` stops all, built-in
  Swagger UI at `/ui/`, root URL returns 404 by design.
- **`services/api/requirements.txt`:** added Connexion + Flask + Uvicorn
  extras and `watchfiles` as pinned dependencies of the mock.

### Removed

- **Handbook — `team/101/` sandbox:** the `«101 series»` framing was
  demoted; a single article is an Explanation, not a series. Content moved
  to `handbook/sa/explanation/from-yaml-to-mock.html` and the `team/101/`
  tree deleted.

### Removed

- **operating-model:** retired four sub-pages now subsumed by the rest of the
  section — `domain-model.html`, `cross-service-workflows.html`,
  `information-architecture.html`, `whats-new-in-how-we-work.html`. The
  paired meta-log coupling gate (`check_meta_changes_logged` pre-commit hook
  + script reference) is disabled.

### Changed

- **operating-model hub** (`services/portal/internal/operating-model/index.html`)
  trimmed to three sections — Start here (one SVG mental anchor),
  What to read (four reference pages in author-order), and Starting a new
  page (single outbound pill to handbook templates). Mixed-genre «five
  rules» and duplicated Quick answers / tour CTAs removed.
- **operating-model · quality-gates-map** D-section rebuilt from a
  five-column table into numbered cards with bullets; meta-log row dropped
  from Table A and the two feed-coupling cells in Table C blanked.
- **operating-model · history footers** added to all six remaining
  sub-pages (canonical `docs-history` block).
- **services/portal · entity card + dependencies page** updated to show
  Pagefind as a build-time and runtime dependency (ADR 0033 already
  switched the search engine; the catalog descriptor hadn't caught up).
