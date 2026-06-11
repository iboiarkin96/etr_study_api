# services/api — Changelog

Per-service changelog for the Python FastAPI service. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); the root `CHANGELOG.md` keeps
the cross-cutting headline entries.

## 2026-06-10 — tools/ consolidation + telemetry DB split restored

- **Tooling moved to `tools/api/`.** API-side helpers `openapi_governance` and
  `check_es_request_id` moved from `services/api/scripts/` into `tools/api/`.
  `services/api/scripts/` now keeps only `container_entrypoint.sh` (the only
  artefact that ships inside the container image). See repo-wide tools layout
  in the root `CHANGELOG.md`.
- **Telemetry DB lives separately again.** `docs_search_events` data goes back
  to its own SQLite file at `var/tech/telemetry.db` (was briefly combined into
  `var/api/study_app.db` during BL-065 cleanup). New env var
  `TELEMETRY_SQLITE_DB_PATH` (defaults to `var/tech/telemetry.db`); main app
  DB stays at `SQLITE_DB_PATH=var/api/study_app.db`. Keeps high-volume
  append-only telemetry traffic off the API's transactional WAL.
  `DocsSearchTelemetryStore.clear_all()` added for test-only deterministic
  cleanup (tests previously went through `SessionLocal()` which is bound to
  the main DB engine).

## 2026-06-09 — BL-065 / ADR 0028 Phase 1–4 landed

- **Folder split (Phase 1).** Moved `app/`, `alembic/`, `alembic.ini`,
  `Dockerfile`, `requirements.txt`, `.dockerignore`, and
  `scripts/container_entrypoint.sh` into this folder so the API service
  becomes self-contained under `services/api/`. CI Docker build context
  switched from repo root to `./services/api`. Dockerfile body unchanged.
- **Path-anchor rewrites.** `app/core/config.py` `ROOT` discovery handles
  both the host layout (`parents[4]` at the repo root) and the container
  layout (`parents[2]` at `/app`); explicit `STUDY_APP_ROOT` env override
  wins over either. `Settings.sqlite_url`, `_resolve_log_path`, and
  `DocsSearchTelemetryStore.__init__` now anchor relative paths at `ROOT`
  instead of `Path.cwd()` so `make run` cd'ing into `services/api/`
  doesn't silently create stray DBs/logs.
- **Runtime DB consolidation.** `study_app.db` moved out of the repo root
  into `var/api/study_app.db` (gitignored). Default in `env/dev`,
  `env/example`, and `services/api/alembic.ini` updated.
- **Per-service tooling (Phase 2 thin).** New `services/api/Makefile` with
  `verify`, `test`, `lint-check`, `type-check`, `run`, `migrate`, `build`,
  `openapi-check` entries. Service-specific helper scripts collected under
  `services/api/scripts/` (`openapi_governance`, `check_es_request_id`,
  `audit_add_justification_column`); cross-cutting `changelog_gate`/`llm_*`/
  `check_pr_body`/`check_no_artifact_files`/`sync_pr_body`/`pr_open`/
  `check_asset_refs`/`check_css_vars`/`check_path_literals` moved into
  `_shared/scripts/` (master plan C5).
- **CI matrix (Phase 4).** GHCR image tag scheme now `ghcr.io/<repo>/api:<sha>`
  (legacy `ghcr.io/<repo>:<sha>` shipped alongside for one release).
  Per-service quality matrix slot `api` runs `make -C services/api verify`.
- **Boundary checker (master C11).** `_shared/scripts/check_service_imports.py`
  AST-walker enforces «no cross-service Python imports». Wired as the
  `check-service-imports` pre-commit local hook.

**Behaviour:** none changed. HTTP contract, image, DB schema, SLO surface
identical. Package not renamed (`from app.…` still works via
`pythonpath = ["services/api"]`); rename to `api` deferred to a separate
branch (master plan C7).
