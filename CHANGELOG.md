# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **services/api — auth simplification (ADR 0038):** dropped the
  `API_AUTH_STRATEGY` switch (only `mock_api_key` was ever wired) and renamed
  `API_MOCK_API_KEY` → `API_AUTH_KEY`. The middleware collapses to a single
  header-key compare; qa/prod invariant flips from «strategy ≠ disabled» to
  «key ≠ default». `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` added to config
  for the Telegram Mini App bot half; CORS extended with the Vite dev origin
  (`http://localhost:5173`). Telegram `initData` → JWT and the
  `users.telegram_*` identity migration are deferred to the multi-user epic.
  Amends ADR 0005 (auth-strategy clause) and ADR 0010 (qa/prod guard row).
- **services/api — POST /api/v1/user returns 422 instead of 500 on unknown
  system:** new `USER_103 USER_CREATE_SYSTEM_NOT_FOUND` (business, 422); a
  preflight `SELECT system_uuid FROM systems` in `UserService.create` catches
  the FK mismatch before the driver does. Global `IntegrityError` handler
  maps any remaining FK/unique/check violation to 422 with the new common
  code `COMMON_422 PERSISTENCE_INTEGRITY_VIOLATION`; driver details are
  logged, not surfaced.
- **tools/docs — pdoc regeneration pinned to CI's Python 3.11:** the
  interpreter used for the pdoc subprocess is now resolved via
  `PDOC_PYTHON` env override or a `python3.11` on `PATH` that has `pdoc`
  importable. When neither is available the regen step is a no-op instead
  of a silent version-mismatch rewrite — CI keeps the canonical output, and
  local `make docs-check` stops producing pdoc HTML files that «flicker»
  in and out of the working tree on every verify pass.

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
- **services/api — Conspectus, Schedule, Error-log endpoints (12 total)**
  matching the internal specs at
  `services/portal/internal/services/api/reference/`. Conspectus CRUD +
  history + due-list + `POST .../actions/review`; Schedule
  `/summary` + `/preview`; Error-log `POST` + `GET`. State machine for
  the ETR review ladder in `app/domain/scheduling.py` (pure logic, no
  ORM); optimistic concurrency on `review` via
  `expected_schedule_revision`; cursor pagination on list + history;
  soft-delete of `conspectus` nulls `learning_errors.conspectus_uuid`
  so errors survive their parent; deterministic Fisher-Yates shuffle
  seeded by `(random_seed, current-minute)` for `preview`. Shared
  `IdempotencyGuard` (`app/api/v1/_idempotency.py`) removes ~150 lines
  of duplicated guard/replay/save boilerplate across five write
  endpoints. 43 stable validation codes (`CONS_*`, `ERR_*`, `SCHED_*`)
  with per-endpoint `(field, error_type) → StableError` mapping in
  `app/validation/dispatch.py`; fallback is `COMMON_000`.
- **Alembic — one migration for the new domain:**
  `20260712_0002_add_conspectus_schedule_errorlog.py` creates six
  tables (`conspectuses`, `conspectus_schedules`, `conspectus_events`,
  `conspectus_review_logs`, `learning_errors`, `schedule_policies`)
  and seeds `schedule_policies`. Edited in place to use
  `postgresql.JSONB()` for `cue_sheet`, `bullets`, `payload` (see
  ADR 0037 below) — safe because the migration was shipped on this
  same feature branch and has never run against Postgres.
- **infra — one-shot `make up` / `make down` (root):** brings up
  api + monitoring + portal in a single command; `alembic upgrade head`
  runs on api-container start; `make down-volumes` also drops the
  Postgres data directory. Replaces the split `stack-up` / `stack-down`
  verbs.
- **tools/docs — `atomic_io.write_if_changed()`:** byte-level compare-
  and-skip wrapper used by every autogen tool
  (`build_catalog.py`, `normalize_pdoc_output.py`, `repair_docs_html.py`);
  IDE / git-status no longer flashes files that end up byte-identical
  after `docs-check`.
- **tools/docs — `regenerate_pdoc.py`:** small orchestrator that hashes
  every `services/api/app/**.py` source file and only re-runs `pdoc` +
  `normalize` when the digest changed. Cached digest under
  `services/portal/internal/services/api/code-reference/.pdoc-input-hashes.json`
  (gitignored). Cuts a no-change `docs-fix` run from ~15 s to ~50 ms
  and lets `docs-check` drop its old `git checkout` post-step.

### Changed

- **services/api / infra — runtime DB is now containerized
  PostgreSQL 16 (ADR 0037 / BL-067).** `Settings.database_url` is the
  only DB knob; SQLite (`Settings.sqlite_db_path`, `sqlite_url`,
  `SQLITE_DB_PATH` env) is gone from the app. Engine drops
  `check_same_thread=False`, adds `pool_pre_ping=True` so
  compose-Postgres restarts don't surface as stale-connection
  errors. `docker-compose.yml` grows a `postgres:16-alpine` service
  with a `pg_isready` healthcheck + host-mounted `var/postgres/`
  (gitignored); the `api` service gains
  `depends_on: {postgres: {condition: service_healthy}}`; container
  entrypoint drops the SQLite `mkdir` and adds a `pg_isready` wait-
  loop as a defensive backstop. Env profiles (`env/example`,
  `env/dev`, `env/qa`, `env/prod`) replace `SQLITE_DB_PATH` with
  `DATABASE_URL` + `POSTGRES_USER/PASSWORD/DB/PORT` bootstrap vars.
- **services/api — tests on testcontainers-python:** `tests/conftest.py`
  boots a session-scoped `PostgresContainer` (`postgres:16-alpine`,
  driver `psycopg`), sets `DATABASE_URL` before importing app
  modules, and switches per-test cleanup to a single
  `TRUNCATE … RESTART IDENTITY CASCADE` — one round-trip and every
  serial (`conspectus_events.id` etc.) resets to 1 so assertions on
  generated IDs stay stable.
- **services/api — dependencies:** added `psycopg[binary]==3.2.10`
  and `testcontainers[postgres]==4.14.2` to `services/api/requirements.txt`.
- **ADR 0015 — partial supersession:** the «SQLite + single replica»
  clause is superseded by ADR 0037; ADR 0015 stays Accepted for its
  packaging-artifact scope. Banner + pointer pill + history row
  added in place.
- **catalog — SQLite chips removed:** the `SQLite` chip / tag / stack
  line drops out of `services/api/catalog-info.yaml` and
  `services/datastore/catalog-info.yaml`; replaced with a single
  `postgres` chip using a new `plug` SVG icon in
  `render_service_descriptors.py`.

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
- **services/api — docs-search telemetry sink** (`app/core/docs_search_telemetry.py`,
  `app/schemas/telemetry.py`, the two `/internal/telemetry/docs-search*`
  endpoints, and both matching test modules). The sink stored to its
  own SQLite at `var/tech/telemetry.db`; with SQLite gone from the
  runtime image (ADR 0037) the surface retires cleanly. RFC 0002
  (`governance/rfc/0002-docs-search-kpi-policy-and-slo.html`) is
  removed; ADRs 0027 + 0033 note the retirement.
- **runtime — SQLite as the app database.** `SQLITE_DB_PATH` env,
  `Settings.sqlite_db_path`, `Settings.sqlite_url`, and the
  SQLite-only `check_same_thread=False` engine flag are removed. The
  `./var/api:/data` mount in compose is gone. Old `stack-up` /
  `stack-down` Make verbs replaced by `make up` / `make down` /
  `make down-volumes`.

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
