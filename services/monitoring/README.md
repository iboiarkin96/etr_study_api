# services/monitoring — Observability stack

Prometheus + Grafana + Blackbox exporter for metrics; optional Elasticsearch + Kibana + Filebeat for structured-log search. All shipped via Docker Compose; nothing runs on the host directly.

## Contents

| Section | What you find |
| ------- | ------------- |
| [Quick start](#quick-start) | Bring the stack up locally |
| [Default URLs](#default-urls) | Prom, Grafana, Blackbox, ES, Kibana |
| [Make targets](#make-targets) | `make stack-*`, `make logging-*` |
| [Logs stack](#logs-stack-optional-elasticsearch--kibana--filebeat) | NDJSON logs in Kibana |
| [Metrics](#metrics-in-prometheus--grafana) | PromQL examples |
| [Cross-references](#cross-references) | ADRs, runbooks |

## Quick start

```bash
make stack-up                      # api + prometheus + grafana + blackbox
docker compose ps                  # what's running
make stack-down                    # stop (volumes preserved)
make stack-down-volumes            # stop and wipe persistent volumes
```

Or run the observability stack standalone (without bringing up the API):

```bash
docker compose -f services/monitoring/docker-compose.observability.yml up -d
# … work …
docker compose -f services/monitoring/docker-compose.observability.yml down
```

## Default URLs

| What | URL | Notes |
| ---- | --- | ----- |
| Prometheus UI | <http://127.0.0.1:9090> | [Targets](http://127.0.0.1:9090/targets) |
| Grafana | <http://127.0.0.1:3001> | Host port **3001** → container 3000; login `admin` / `admin` |
| Blackbox exporter | <http://127.0.0.1:9115> | Probe metrics for Prometheus |
| Dashboard (imported) | [ETR Study API Observability](http://127.0.0.1:3001/d/study-app-observability/study-app-observability?orgId=1) | Grafana |

Override host/port labels for docs and smoke checks: `OBS_API_*`, `OBS_PROM_*`, `OBS_GRAF_*` (see `env/example`).

Prometheus scrapes the API at `host.docker.internal:8000` (template at `services/monitoring/prometheus/prometheus.tpl.yml` → rendered to `prometheus.yml` by `tools/monitoring/render_prometheus_config.py` / `make -C services/monitoring render-prometheus`).

## Make targets

| Command | What it does |
| ------- | ------------ |
| `make stack-up` | api + observability via root `docker-compose.yml` |
| `make stack-down` | stop, preserve persistent volumes |
| `make stack-down-volumes` | stop + wipe prom/grafana data volumes |
| `make stack-logs` | tail logs from all stack services |
| `make logging-up` | bring up the optional ES + Kibana + Filebeat stack (heavy) |
| `make logging-down` | stop the logging stack |
| `make -C services/monitoring render-prometheus` | re-render `prometheus.yml` from the template using current env values |

## Logs stack (optional Elasticsearch + Kibana + Filebeat)

For **NDJSON** logs and local **search**, set `LOG_FORMAT=json` and `LOG_SERVICE_NAME` (see `env/example`; **json is the default** if `LOG_FORMAT` is unset). Uvicorn's extra access log is off (`--no-access-log`). Correlation uses **`request_id`** in *request_done* lines in `app.main`. Every response sends **`X-Request-Id`**; JSON lines include `request_id`. `trace_id` / `span_id` are reserved (null until OpenTelemetry is added).

| What | URL | Notes |
| ---- | --- | ----- |
| Elasticsearch | <http://127.0.0.1:9200> | REST API; indices `study-app-logs-*` |
| Kibana | <http://127.0.0.1:5601> | Data view pattern **`*study-app-logs*`** (wildcards both sides — otherwise Discover misses `.ds-study-app-logs-*` streams) |

**Steps:** `make logging-up` brings the stack up. Run the API on the host with `LOG_FORMAT=json` writing to `./logs` (mounted read-only into Filebeat). **~2 GiB RAM** for ES + Kibana. Stop with `make logging-down`. Details: [ADR 0023](../portal/internal/governance/adr/0023-structured-logging-and-local-elasticsearch.html).

## Metrics in Prometheus / Grafana

Common series: `http_requests_total`, `http_request_duration_seconds_bucket`, `db_operation_duration_seconds_bucket`. Use the Grafana dashboard above for charts; in Prometheus use **Graph** and PromQL (e.g. `sum(rate(http_requests_total[1m]))` for RPS).

## Cross-references

- **Architecture:** [`services/portal/internal/services/monitoring/architecture.html`](../portal/internal/services/monitoring/architecture.html)
- **Runbooks:** [`services/portal/internal/services/monitoring/runbooks/scrape-failing.html`](../portal/internal/services/monitoring/runbooks/scrape-failing.html)
- **ADRs:** [0009](../portal/internal/governance/adr/0009-health-readiness-and-observability.html) (health/readiness), [0011](../portal/internal/governance/adr/0011-slo-sla-error-budget.html) (SLO/error budget), [0023](../portal/internal/governance/adr/0023-structured-logging-and-local-elasticsearch.html) (logging)
- **API service:** see [`services/api/README.md`](../api/README.md)
- **Changelog:** [`services/monitoring/CHANGELOG.md`](CHANGELOG.md)
