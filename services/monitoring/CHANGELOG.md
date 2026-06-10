# services/monitoring — Changelog

Per-service changelog for the observability stack (Prometheus, Grafana,
Blackbox-exporter; optional ELK for logs).

## 2026-06-10 — tools/ consolidation

- **Helpers moved to `tools/monitoring/`.** `render_prometheus_config`,
  `check_observability_links`, `check_logging_links` moved from
  `services/monitoring/scripts/` into `tools/monitoring/`.
  `services/monitoring/scripts/` directory removed (was empty after the move).
  `services/monitoring/Makefile` `render-prometheus` target updated.

## 2026-06-09 — BL-065 / ADR 0028 Phase 1–4 landed

- **Folder split (Phase 1).** Moved `ops/prometheus/`, `ops/grafana/`,
  `ops/filebeat/` into this folder; both compose files
  (`docker-compose.observability.yml` + `docker-compose.logging.yml`) moved
  here from the repo root. Volume mount paths inside the compose files
  rewritten: `./ops/prometheus/...` → `./prometheus/...`,
  `./logs` (in logging.yml) → `../../logs` so the host repo-root `logs/`
  remains the single source of truth visible to Filebeat.
- **Per-service tooling (Phase 2 thin).** New `services/monitoring/Makefile`
  with `up`, `down`, `up-volumes`, `logging-up`, `logging-down`, `logs`,
  `render-prometheus`. Service-specific helpers under
  `services/monitoring/scripts/` (`render_prometheus_config`,
  `check_observability_links`, `check_logging_links`).
- **Root orchestrator (Phase 3).** New `/docker-compose.yml` `include:`'s
  this folder's `docker-compose.observability.yml` so a single
  `docker compose up -d` brings up the API alongside Prometheus + Grafana +
  Blackbox. The per-service compose remains standalone-runnable.
- **CI matrix (Phase 4).** `quality (monitoring)` job runs `docker compose
  config --quiet` against both composes; `compose-smoke` job additionally
  runs `docker build --check services/api` and parses the root compose.

**Behaviour:** observability stack URLs unchanged (Prometheus :9090,
Grafana :3001, Blackbox :9115, Elasticsearch :9200, Kibana :5601).
