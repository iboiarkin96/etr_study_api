# <abbr title="Extract–Transform–Retrieve">ETR</abbr> Study App

A FastAPI service plus a Docs-as-Code portal, laid out as a service-rooted monorepo. Every concern that ships independently lives under `services/<svc>/`; cross-cutting helper scripts live under `tools/`.

## Where to look

| You want to …                                                                    | Go to                                                                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Run the API locally, build the container image, browse OpenAPI                   | [`services/api/README.md`](services/api/README.md)                                               |
| Bring up Prometheus / Grafana / Blackbox, or the optional ES + Kibana logs stack | [`services/monitoring/README.md`](services/monitoring/README.md)                                 |
| Edit documentation, regenerate the portal, run docs gates                        | [`services/portal/README.md`](services/portal/README.md)                                         |
| Understand the UI Kit / Pagefind / favicon layout                                | [`services/frontend/portal/CHANGELOG.md`](services/frontend/portal/CHANGELOG.md)                 |
| Read about architectural decisions                                               | [`services/portal/internal/governance/adr/`](services/portal/internal/governance/adr/index.html) |

## Quick start

```bash
make setup   # .venv + deps + .env (first-time only)
make up      # start EVERYTHING — api (with migrations), monitoring, portal
```

`make up` prints all URLs at the end (API :8000, Portal :8080, Grafana :3010, Prometheus :9090, Blackbox :9115). Stop with `make down`; inspect with `make status` / `make logs`. See [`services/api/README.md`](services/api/README.md) for environment variables, container image, and HTTP endpoint details.

## Local make targets at a glance

The Makefile sits at the repo root and orchestrates the gates that apply across services.

| Command                            | Where it lives                                        | What it does                              |
| ---------------------------------- | ----------------------------------------------------- | ----------------------------------------- |
| `make up` / `make down`            | root                                                  | one-shot start/stop of the whole stack    |
| `make logs` / `make status`        | root                                                  | tail docker logs / show state + endpoints |
| `make fix`                         | root                                                  | format + lint auto-fix + docs autogen     |
| `make check`                       | root                                                  | lint + types + openapi + contract + tests |
| `make verify`                      | root                                                  | the full pre-push gate                    |
| `make -C services/api run`         | api                                                   | uvicorn dev server (local, --reload)      |
| `make -C services/portal docs-fix` | portal                                                | docs autogen pipeline                     |
| `make -C services/monitoring up`   | monitoring                                            | observability standalone                  |

Full inventory: [`internal/handbook/sa/authoring/make-commands-and-workflows.html`](services/portal/internal/handbook/sa/authoring/make-commands-and-workflows.html).

## Repository layout

<!-- BEGIN:REPO_LAYOUT -->
```text
study_app/
└── services/  # Service-rooted layout per ADR 0028
    ├── api/  # Python API service (FastAPI)
    │   ├── alembic/  # Migration environment
    │   │   └── versions/  # Migration scripts
    │   ├── app/  # Application package
    │   │   ├── api/  # HTTP layer
    │   │   ├── core/  # Settings, DB session
    │   │   ├── domain/
    │   │   ├── errors/
    │   │   ├── models/  # ORM models
    │   │   ├── openapi/
    │   │   ├── repositories/  # Data-access layer
    │   │   ├── schemas/  # Pydantic request/response models
    │   │   ├── services/  # Business logic
    │   │   └── validation/
    │   └── scripts/
    ├── frontend/  # Frontend artifacts (portal, future admin / dashboard)
    │   └── portal/  # Static documentation portal — public + internal IA
    │       └── assets_v2/
    ├── monitoring/  # Prometheus, Grafana, Filebeat configs + compose stacks
    │   ├── filebeat/  # Filebeat → Elasticsearch (local logging stack)
    │   ├── grafana/  # Dashboards and provisioning
    │   │   ├── dashboards/
    │   │   └── provisioning/
    │   └── prometheus/  # Scrape config, rules, Blackbox
    │       └── rules/
    └── portal/
        ├── internal/
        │   ├── blog/
        │   ├── catalog/
        │   ├── explanation/
        │   ├── governance/
        │   ├── handbook/
        │   ├── how-to/
        │   ├── onboarding/
        │   ├── operating-model/
        │   ├── reference/
        │   ├── services/
        │   ├── team/
        │   └── tutorials/
        ├── public/
        │   ├── explanation/
        │   ├── how-to/
        │   ├── reference/
        │   └── tutorials/
        └── ui-kit/
            └── pages/
```
<!-- END:REPO_LAYOUT -->

## Changelog

- **Behaviour & API:** [`CHANGELOG.md`](CHANGELOG.md) (this directory).
- **Documentation content:** [`services/portal/CHANGELOG.md`](services/portal/CHANGELOG.md).
- **Frontend kit:** [`services/frontend/portal/CHANGELOG.md`](services/frontend/portal/CHANGELOG.md).
- **Per-service:** [`services/api/CHANGELOG.md`](services/api/CHANGELOG.md), [`services/monitoring/CHANGELOG.md`](services/monitoring/CHANGELOG.md).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT.
