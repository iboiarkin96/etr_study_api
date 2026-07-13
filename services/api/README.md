# services/api — FastAPI service

Python 3.11 + FastAPI runtime exposing the `/api/v1` HTTP surface. Owns the persistent state (PostgreSQL 16, containerized — see [ADR 0037](../portal/internal/governance/adr/0037-postgres-runtime-database.html)); the API talks to Postgres over the compose network as `postgres:5432`.

## Contents

| Section | What you find |
| ------- | ------------- |
| [Quick start](#quick-start) | Install, migrate, run locally |
| [Environment](#environment) | `APP_ENV`, `.env`, profile files, telemetry path |
| [Local commands](#local-commands) | `make` targets that drive this service |
| [Container image](#container-image) | `docker build`, `docker run`, image conventions |
| [HTTP endpoints](#http-endpoints) | OpenAPI + Python module reference |
| [Cross-references](#cross-references) | Deeper handbook, ADRs, runbooks |

## Quick start

```bash
make venv && source .venv/bin/activate
make install
make env-init
make migrate
make run
```

`make setup` does the first three at once; `make run` gives you a local uvicorn with `--reload` (best for coding on the API), and `make up` (root) starts the full containerised stack — api + monitoring + portal — in one shot. The Makefile sits at the repo root; `make -C services/api <target>` is supported but currently delegates to the root for the shared gates.

## Environment

The app reads **`APP_ENV`** (`dev`, `qa`, or `prod`) — set it in **`.env`** or in the shell. **`GET /live`** echoes `app_env` so you can confirm the value quickly.

| Path | Role |
| ---- | ---- |
| `env/example` | Template you copy to `.env` (`make env-init`). **All variables, defaults, and meanings are documented only here.** |
| `env/dev`, `env/qa`, `env/prod` | Optional profile files merged on top of the base |
| `DATABASE_URL` | PostgreSQL DSN — the only DB knob the app reads (ADR 0037) |
| `var/postgres/` | Compose Postgres data directory (gitignored; persists across `docker compose down`) |

**Order of loading (last wins):** root `.env` → `env/<APP_ENV>` → optional `ENV_FILE`.

Tests use **`APP_ENV=qa`**. The legacy value **`APP_ENV=test`** is treated as **`qa`**.

Helpful: `make env-check`, `curl -s http://127.0.0.1:8000/live | jq`.

## Local commands

| Command | What it does |
| ------- | ------------ |
| `make run` | uvicorn with `--reload` + alembic upgrade head |
| `make migrate` | alembic upgrade head only |
| `make test` | pytest + coverage gate (≥ 90 %) |
| `make openapi-check` | Spec lint + breaking-change guard against baseline |
| `make contract-test` | Stricter: live spec must equal `openapi-baseline.json` |
| `make openapi-accept-changes` | Overwrite the baseline with the live spec |
| `make env-check` | Verify `.env` + DB connectivity |
| `make verify` | Full local gate (lint, mypy, openapi, contract, test, docs-check) |

The catalog of every `make` target is at [`internal/handbook/sa/authoring/make-commands-and-workflows.html`](../portal/internal/handbook/sa/authoring/make-commands-and-workflows.html).

## Container image

You do **not** need Docker for day-to-day coding — `make run` + tests + `make verify` cover that. The image is the deployment packaging step.

- **Prerequisites:** [Docker](https://docs.docker.com/get-docker/) if you build or run the image locally.
- **Build:** `docker build -t study-app-api:local services/api` (or `make -C services/api build`).
- **Run:** the container's `ENTRYPOINT` is `services/api/scripts/container_entrypoint.sh` — applies migrations, then `uvicorn` (no `--reload`). Dependencies are pinned by `services/api/requirements.txt`. Pass configuration with `-e` or via your platform's env mechanism (see `env/example`).
- **Guide:** [Docker image and container](../portal/internal/handbook/developer/0009-docker-image-and-container.html).
- **ADRs:** [0015](../portal/internal/governance/adr/0015-container-image.html) (image), [0021](../portal/internal/governance/adr/0021-continuous-delivery-github-actions-and-ghcr.html) (CI → GHCR).

The CI publishes to `ghcr.io/<repo>/api:<sha>` (per-service tag scheme since BL-065 Phase 4).

## HTTP endpoints

The full HTTP API (endpoints, schemas, examples) is documented as OpenAPI:

- Committed contract: [`services/portal/public/reference/api/openapi-baseline.json`](../portal/public/reference/api/openapi-baseline.json)
- Static browse-only Swagger UI: [`services/portal/public/reference/api/index.html`](../portal/public/reference/api/index.html)
- Python modules (pdoc): [`services/portal/internal/services/api/code-reference/index.html`](../portal/internal/services/api/code-reference/index.html)

## Cross-references

- **Architecture:** [`services/portal/internal/services/api/architecture.html`](../portal/internal/services/api/architecture.html)
- **Local development walkthrough:** [`services/portal/internal/handbook/sa/authoring/local-development.html`](../portal/internal/handbook/sa/authoring/local-development.html)
- **Runbooks:** [`services/portal/internal/services/api/runbooks.html`](../portal/internal/services/api/runbooks.html)
- **Observability stack:** see [`services/monitoring/README.md`](../monitoring/README.md)
- **Documentation portal:** see [`services/portal/README.md`](../portal/README.md)
- **Changelog:** [`services/api/CHANGELOG.md`](CHANGELOG.md)
