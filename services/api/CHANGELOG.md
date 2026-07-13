# services/api — Changelog

Per-service changelog for the Python FastAPI service. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); the root `CHANGELOG.md` keeps
the cross-cutting headline entries.

## 2026-07-12 — Runtime DB: SQLite → containerized PostgreSQL 16 (ADR 0037 / BL-067)

- **Runtime database swapped.** SQLite is gone from the runtime path. The API
  reads a single new env var — `DATABASE_URL` (PostgreSQL DSN, driver
  `psycopg` v3) — and talks to a `postgres:16-alpine` service in the root
  `docker-compose.yml`. See [ADR 0037](../portal/internal/governance/adr/0037-postgres-runtime-database.html).
- **Compose topology.** New `postgres` service with `pg_isready` healthcheck
  and a host-mounted volume at `var/postgres/` (gitignored). The `api` service
  gains `depends_on: {postgres: {condition: service_healthy}}`; the old
  `./var/api:/data` mount and `SQLITE_DB_PATH` env are removed.
- **Alembic on Postgres.** `alembic.ini` default DSN and `alembic/env.py`
  flipped to `settings.database_url`. Migration `20260712_0002` edited in
  place: the three `sa.JSON()` columns (`conspectuses.cue_sheet`,
  `conspectuses.bullets`, `conspectus_events.payload`) are now
  `postgresql.JSONB()`. In-place edit is safe here — the migration was
  shipped one commit earlier on this same feature branch and has never run
  against Postgres.
- **Model matches.** `app/models/core/conspectus.py`: `JSON` → `JSONB` on the
  same three columns; `JSONB` imported from `sqlalchemy.dialects.postgresql`.
- **Engine.** `app/core/database.py` no longer passes `check_same_thread=False`
  (SQLite-only quirk); adds `pool_pre_ping=True` so restarts of the compose
  Postgres do not surface as stale-connection errors on the first request.
- **Config.** `Settings.sqlite_db_path` + `sqlite_url` property removed;
  `Settings.database_url` added. `get_settings()` requires a PostgreSQL DSN
  and rejects anything else at startup.
- **Container entrypoint.** `services/api/scripts/container_entrypoint.sh`
  drops `SQLITE_DB_PATH` defaulting + `mkdir` for the DB parent; adds a
  `pg_isready` wait loop (30 s ceiling) as a defensive backstop for the
  compose healthcheck. Then `alembic upgrade head` → `uvicorn`, unchanged.
- **Tests on testcontainers-python.** `tests/conftest.py` boots a
  session-scope `PostgresContainer` (`postgres:16-alpine`, driver `psycopg`),
  sets `DATABASE_URL` before `app` import, and switches per-test cleanup to
  a single `TRUNCATE … RESTART IDENTITY CASCADE` — faster and it resets the
  serial sequences so `id` assertions stay stable. `tests/core/test_config_profiles.py`
  drops its `SQLITE_DB_PATH` fixture.
- **Dependencies.** `services/api/requirements.txt` gains `psycopg[binary]==3.2.10`
  and `testcontainers[postgres]==4.14.2`.
- **Env profiles.** `env/example`, `env/dev`, `env/qa`, `env/prod` replace
  `SQLITE_DB_PATH` with `DATABASE_URL` (+ `POSTGRES_USER/PASSWORD/DB/PORT`
  in the example for compose bootstrap).
- **Governance.** New backlog task [BL-067](../portal/internal/governance/backlog/index.html);
  new [ADR 0037](../portal/internal/governance/adr/0037-postgres-runtime-database.html);
  [ADR 0015](../portal/internal/governance/adr/0015-container-image.html)
  carries a partial-supersession banner + history row for its «SQLite +
  single replica» clause. Catalog: SQLite chip/tag/stack removed from
  `datastore/catalog-info.yaml` and `api/catalog-info.yaml`.

**Behaviour:** HTTP contract unchanged. Schema unchanged (JSONB is a
storage-level swap invisible to Pydantic). Boot order changes — Postgres
must be up before the API accepts traffic; compose's `depends_on.condition:
service_healthy` handles this automatically.

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
