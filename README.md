# Study App API

FastAPI service for Study App domain workflows. Long-form documentation: [system analysis](docs/system-analysis.html), [engineering practices](docs/engineering-practices.html).

## Quick start

```bash
make venv && source .venv/bin/activate
make install
make env-init
make migrate
make run
```

- API docs (Swagger): [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Full stack (API + Docker observability): `make run-project` instead of `make run` (see below).

---

## Observability (local)

Stack: **Prometheus**, **Grafana**, **Blackbox exporter** (`docker-compose.observability.yml`). Prometheus scrapes the API via `host.docker.internal:8000` (see `ops/prometheus/prometheus.tpl.yml` → rendered `ops/prometheus/prometheus.yml`).

### Default URLs

| What | URL | Notes |
| ---- | --- | ----- |
| API | [http://127.0.0.1:8000](http://127.0.0.1:8000) | `APP_HOST` / `APP_PORT` |
| Liveness / readiness / metrics | `/live`, `/ready`, `/metrics` | |
| Prometheus UI | [http://127.0.0.1:9090](http://127.0.0.1:9090) | [Targets](http://127.0.0.1:9090/targets) |
| Grafana | [http://127.0.0.1:3001](http://127.0.0.1:3001) | maps host **3001** → container 3000; login `admin` / `admin` |
| Blackbox exporter | [http://127.0.0.1:9115](http://127.0.0.1:9115) | probe metrics for Prometheus |
| Dashboard (imported) | [Study App Observability](http://127.0.0.1:3001/d/study-app-observability/study-app-observability?orgId=1) | Grafana |

Override host/port labels for docs and smoke checks: `OBS_API_*`, `OBS_PROM_*`, `OBS_GRAF_*` (see `env/example`).

### How to run it

1. Start the API: `make run` (or use `make run-project` to bring up Docker observability and then the API in one flow).
2. If the API is already running: `make observability-up` (renders Prometheus config, starts Compose).
3. Check `/live`, `/ready`, and `/metrics` (e.g. `curl -s http://127.0.0.1:8000/live`).
4. When finished: `make observability-down`. Optional link check: `make observability-smoke`.

More detail (ports, Blackbox, stopping containers): [Local development](docs/developer/0007-local-development.html). Architecture and SLO/error-budget context: [ADR 0009](docs/adr/0009-health-readiness-and-observability.html), [ADR 0011](docs/adr/0011-slo-sla-error-budget.html).

### Metrics useful in Prometheus / Grafana

Examples: `http_requests_total`, `http_request_duration_seconds_bucket`, `db_operation_duration_seconds_bucket`. Use the Grafana dashboard above for charts; in Prometheus UI use **Graph** and paste PromQL (e.g. `sum(rate(http_requests_total[1m]))` for overall RPS).

---

## Environment (`APP_ENV`)

The process reads **`APP_ENV`** (`dev`, `qa`, `prod`). Set it in **`.env`** or the host environment. **`GET /live`** includes `"app_env"` for a quick check.

| Path | Role |
| ---- | ---- |
| `env/example` | Committed template — copy to `.env` (`make env-init`) |
| `env/dev`, `env/qa`, `env/prod` | Optional profile overrides (merged automatically) |

**Load order (later wins):** root `.env` → `env/<APP_ENV>` → optional `ENV_FILE`.
Tests use **`APP_ENV=qa`**. Legacy `APP_ENV=test` is mapped to **`qa`**.

Useful: `make env-check`, `curl -s http://127.0.0.1:8000/live | jq`.

---

## Documentation

| Topic | Link |
| ----- | ---- |
| Contributing (verify, docs, OpenAPI, ADRs) | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Engineering practices & handbook | [engineering-practices.html](docs/engineering-practices.html) |
| System analysis & error matrix | [system-analysis.html](docs/system-analysis.html) |
| Developer guides (requirements, contracts, load testing, local dev) | [docs/developer/README.html](docs/developer/README.html) |
| ADRs | [docs/adr/README.html](docs/adr/README.html) |
| Runbooks | [docs/runbooks/README.html](docs/runbooks/README.html) |

Daily workflow: prefer `make` targets (`make help`). Common flows: `make fix`, `make verify`, `make release-check`. Before commit: `make pre-commit-check`. Docs sync: `make docs-fix`; verify: `make docs-check`.

---

## Repository layout

<!-- BEGIN:REPO_LAYOUT -->
```text
study_app/
├── app/  # Application package
│   ├── api/  # HTTP layer
│   │   └── v1/  # v1 routers
│   ├── core/  # Settings, DB session
│   ├── errors/
│   ├── models/  # ORM models
│   │   ├── core/  # Core domain entities
│   │   └── reference/  # Reference / lookup entities
│   ├── openapi/
│   │   └── examples/
│   ├── repositories/  # Data-access layer
│   ├── schemas/  # Pydantic request/response models
│   ├── services/  # Business logic
│   └── validation/
├── alembic/  # Migration environment
│   └── versions/  # Migration scripts
├── docs/  # HTML docs & UML sources
│   ├── adr/
│   ├── assets/
│   ├── backlog/
│   ├── developer/  # Developer guides and onboarding
│   ├── openapi/
│   ├── runbooks/  # Operational troubleshooting guides
│   └── uml/  # PlantUML diagrams
│       ├── architecture/
│       ├── rendered/  # Rendered PNGs
│       └── sequences/  # Sequence diagram sources
└── scripts/  # Dev & CI helper scripts
```
<!-- END:REPO_LAYOUT -->

---

## Environment variables (from `env/example`)

<!-- BEGIN:CONFIG_TABLE -->
| Variable | Description | Example |
| -------- | ----------- | ------- |
| `APP_NAME` | Title shown in OpenAPI | `"Study App API"` |
| `APP_ENV` | Logical environment label | `dev` |
| `APP_HOST` | Bind address for Uvicorn | `127.0.0.1` |
| `APP_PORT` | Listen port | `8000` |
| `SQLITE_DB_PATH` | SQLite database file (relative or absolute path) | `study_app.db` |
| `LOG_DIR` | Directory where app logs are written | `logs` |
| `LOG_FILE_NAME` | Application log filename | `app.log` |
| `LOG_LEVEL` | Root log level | `INFO` |
| `CORS_ALLOW_ORIGINS` | Allowed browser origins (CSV) | `http://127.0.0.1:3000,http://localhost:3000` |
| `CORS_ALLOW_METHODS` | Allowed CORS methods (CSV) | `GET,POST,PUT,PATCH,DELETE,OPTIONS` |
| `CORS_ALLOW_HEADERS` | Allowed CORS headers (CSV) | `Authorization,Content-Type,X-API-Key` |
| `CORS_ALLOW_CREDENTIALS` | Whether CORS credentials are allowed | `false` |
| `API_BODY_MAX_BYTES` | Maximum request body size in bytes | `1048576` |
| `API_RATE_LIMIT_REQUESTS` | Requests per window for one client+path | `60` |
| `API_RATE_LIMIT_WINDOW_SECONDS` | Rate-limit window in seconds | `60` |
| `API_AUTH_STRATEGY` | Auth mode (`mock_api_key` or `disabled`) | `mock_api_key` |
| `API_MOCK_API_KEY` | Mock API key value for local/dev | `local-dev-key` |
| `API_AUTH_HEADER` | Header name used for API key auth | `X-API-Key` |
| `API_PROTECTED_PREFIX` | URL prefix where auth/rate-limit are enforced | `/api/v1` |
| `LOADTEST_DEFAULT_TOTAL_REQUESTS` |  | `100` |
| `LOADTEST_DEFAULT_DELAY_MS` |  | `0` |
| `METRICS_ENABLED` |  | `true` |
| `METRICS_PATH` |  | `/metrics` |
| `READINESS_DB_TIMEOUT_MS` |  | `250` |
| `METRICS_BUCKETS_HTTP` |  | `0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2.5,5` |
| `METRICS_BUCKETS_DB` |  | `0.001,0.0025,0.005,0.01,0.025,0.05,0.1,0.25` |
| `OBS_API_HOST` |  | `127.0.0.1` |
| `OBS_API_PORT` |  | `8000` |
| `OBS_PROM_HOST` |  | `127.0.0.1` |
| `OBS_PROM_PORT` |  | `9090` |
| `OBS_GRAF_HOST` |  | `127.0.0.1` |
| `OBS_GRAF_PORT` |  | `3001` |
| `PROMETHEUS_PORT` |  | `9090` |
| `GRAFANA_PORT` |  | `3001` |
| `PROMETHEUS_SCRAPE_TARGET` |  | `host.docker.internal:8000` |
| `PROMETHEUS_READY_PROBE_URL` |  | `http://host.docker.internal:8000/ready` |
| `BLACKBOX_EXPORTER_PORT` |  | `9115` |
| `GRAFANA_ADMIN_USER` |  | `admin` |
| `GRAFANA_ADMIN_PASSWORD` |  | `admin` |
<!-- END:CONFIG_TABLE -->

---

## HTTP endpoints

<!-- BEGIN:HTTP_ENDPOINTS -->
| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/api/v1/user` | Create user |
| `GET` | `/api/v1/user/{system_user_id}` | Get user by system_user_id |
| `GET` | `/docs` | Custom Swagger Ui |
| `GET` | `/live` | Liveness probe |
| `GET` | `/metrics` | Metrics Endpoint |
| `GET` | `/ready` | Readiness probe |
<!-- END:HTTP_ENDPOINTS -->

---

## License

MIT
