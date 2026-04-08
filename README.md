# Study App API

REST API for user creation and related domain logic. Built with **FastAPI**, **SQLAlchemy 2**, **Alembic**, and **SQLite**, with configuration from environment variables and request/response validation via **Pydantic v2**.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Running the server](#running-the-server)
- [API documentation (Swagger)](#api-documentation-swagger)
- [HTTP endpoints](#http-endpoints)
- [Non-functional requirements](#non-functional-requirements)
- [Error matrix](#error-matrix)
- [Development guide](#development-guide)
- [Make-first local workflow (mandatory)](#make-first-local-workflow-mandatory)
- [Code formatting and linting](#code-formatting-and-linting)
- [Testing policy (mandatory)](#testing-policy-mandatory)
- [Logging policy (mandatory)](#logging-policy-mandatory)
- [API versioning policy (mandatory)](#api-versioning-policy-mandatory)
- [Database and migrations](#database-and-migrations)
- [Project documentation (HTML & UML)](#project-documentation-html--uml)
- [Docs as Code workflow](#docs-as-code-workflow)
- [Documentation generation workflow](#documentation-generation-workflow)
- [Makefile reference](#makefile-reference)
- [Git](#git)

---

## Features

- Environment-based config (`.env` + `python-dotenv`)
- Layered structure: routers → services → repositories → ORM models
- Alembic migrations for schema evolution
- OpenAPI / Swagger UI out of the box
- Pydantic validation on API payloads

---

## Tech stack

| Layer        | Technology                          |
| ------------ | ----------------------------------- |
| Web framework| FastAPI                             |
| ASGI server  | Uvicorn                             |
| ORM          | SQLAlchemy 2.x                      |
| Migrations   | Alembic                             |
| Database     | SQLite (file path from env)         |
| Validation   | Pydantic v2                         |
| HTTP client (dev) | httpx (for TestClient)       |

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
│   └── services/  # Business logic
├── alembic/  # Migration environment
│   └── versions/  # Migration scripts
├── docs/  # HTML docs & UML sources
│   ├── adr/
│   └── uml/  # PlantUML diagrams
│       ├── architecture/
│       ├── rendered/  # Rendered PNGs
│       └── sequences/  # Sequence diagram sources
└── scripts/  # Dev & CI helper scripts
```
<!-- END:REPO_LAYOUT -->

---

## Prerequisites

- **Python** 3.11 or newer (tested with 3.14)
- **make** (required for local development workflows in this project)

---

## Getting started

1. Clone the repository (or open the project folder).
2. Create and activate a virtual environment

```bash
make venv
source .venv/bin/activate
```

3. Install dependencies

```bash
make install
```

4. Configure environment

```bash
cp .env.example .env
# Edit .env: especially SQLITE_DB_PATH, APP_HOST, APP_PORT
```

5. Apply database migrations

```bash
make migrate
```

6. Start the API

```bash
make run
```

The server reads `APP_HOST` and `APP_PORT` from `.env` (see [Configuration](#configuration)).

---

## Configuration

Variables are loaded from `.env` in the project root (see `app/core/config.py`).

<!-- BEGIN:CONFIG_TABLE -->
| Variable | Description | Example |
| -------- | ----------- | ------- |
| `APP_NAME` | Title shown in OpenAPI | `Study App API` |
| `APP_ENV` | Logical environment label | `local` |
| `APP_HOST` | Bind address for Uvicorn | `127.0.0.1` |
| `APP_PORT` | Listen port | `8000` |
| `SQLITE_DB_PATH` | SQLite database file (relative or absolute path) | `study_app.db` |
| `LOG_DIR` |  | `logs` |
| `LOG_FILE_NAME` |  | `app.log` |
| `LOG_LEVEL` |  | `INFO` |
<!-- END:CONFIG_TABLE -->

> **Security:** do not commit `.env` with secrets. The repository includes `.env.example` only. Local `*.db` files are listed in `.gitignore`.

Logging variables:
- `LOG_DIR` - directory where runtime logs are stored (default: `logs`).
- `LOG_FILE_NAME` - active log file name (default: `app.log`).
- `LOG_LEVEL` - minimum log level for file output (default: `INFO`).

---

## API documentation (Swagger)

After the server is up:

| Resource    | URL |
| ----------- | --- |
| **Swagger UI** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) (use your `APP_HOST`/`APP_PORT` if different) |
| **ReDoc**      | [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc) |

Interactive docs include request schemas, response models, and validation rules generated from Pydantic.

---

## HTTP endpoints

<!-- BEGIN:HTTP_ENDPOINTS -->
| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/api/v1/user` | Create user |
| `GET` | `/health` | Health check |
<!-- END:HTTP_ENDPOINTS -->

---

## Non-functional requirements

These requirements are mandatory for implementation and release decisions.

| Category | Requirement |
| -------- | ----------- |
| Performance | Typical API requests should complete in under 300 ms with local DB and light load; avoid N+1 and excessive serialization in hot paths. |
| Reliability | Write operations are transactional, rollback on failure is mandatory, and error responses must follow stable contracts. |
| Maintainability | Layering stays explicit (router -> service -> repository); endpoint behavior is covered by automated tests. |
| Extensibility | New interfaces/channels are added through adapters without rewriting business logic core. |
| API contract governance | OpenAPI schemas/examples/error contracts are public API; evolution is additive, no silent breaking changes. |
| Validation consistency | All external input is validated at API boundary and normalized into code-based error payloads. |
| Security baseline | Secrets are never committed; deployment uses environment-managed secrets. |
| Observability readiness | Logs and error payloads are structured enough for diagnosis and support. |
| Release quality gate | Deployment requires successful `make pre-deploy` pipeline. |
| Documentation governance | README and `docs/index.html` are updated together; generated sections remain sync-safe. |

Reference:
- Human-readable architecture/requirements page: `docs/index.html` (section "Non-Functional Requirements").

---

## Error matrix

This repository uses a code-based error contract.  
Error Matrix documents the **approach and extension rules**, not an exhaustive list of every code.

### Error contract (project standard)

- **Business errors (`4xx`)** return:
  - `{"code":"...","key":"...","message":"...","source":"business"}`
- **Validation errors (`422`)** return:
  - `{"error_type":"validation_error","endpoint":"...","errors":[...]}`
  - each item in `errors[]`: `code`, `key`, `message`, `field`, `source`, `details`

### Where error matrix lives

- **Validation code catalog:** `app/errors/validation.py`
- **OpenAPI error examples:** `app/openapi/examples/errors.py`
- **Error schemas (contract):** `app/schemas/errors.py`
- **Endpoint declarations (`responses`):** `app/api/v1/*.py`
- **Human-readable matrix summary:** this `README.md` and `docs/index.html`

### How to extend matrix safely

1. Add new code mapping in `app/errors/validation.py` (or endpoint-specific mapper).
2. Add/update OpenAPI examples in `app/openapi/examples/errors.py`.
3. Ensure endpoint `responses={...}` references correct models/examples.
4. Update summary in `README.md` and `docs/index.html`.
5. Do not change semantic meaning of existing `code`/`key` pairs.

---

## Development guide

### 1) Project philosophy
- API contract is the product: request/response/error schemas are always current and versioned by code.
- Documentation is part of delivery: endpoint behavior and docs evolve in the same change.
- One source of truth per concern: validation mapping, examples, and schemas are centralized.

### 2) Validation standards (general)
- Validate all external input at API boundary (Pydantic schemas/types/validators).
- Keep business/service layer free from duplicate shape validation.
- Normalize validation failures into stable error codes and keys.
- Return errors in a consistent machine-readable contract.

### 3) Error-code governance
- `code` + `key` are immutable public contract.
- Additive evolution only: add new codes, do not repurpose old ones.
- Keep fallback code path for unmapped validation failures.
- Every new endpoint should define explicit error `responses` in Swagger.

### 4) Documentation discipline
- OpenAPI (`/docs`) must match runtime behavior and examples.
- Update matrix summary when adding new error families/endpoints.
- Keep docs concise: list approach and extension rules; full code catalog stays in source files.

### 5) Scalability checklist
- New endpoint has request/response schemas, examples, and error responses.
- Validation mapper covers endpoint-specific error family.
- Error examples are present and readable in Swagger.
- Tests exist for at least one happy-path and one failure-path per endpoint.
- No endpoint change is considered done without tests.
- Pre-deploy quality gate (`make pre-deploy`) passes before any deployment action.
- `make sync-docs` runs cleanly and does not overwrite manual sections unexpectedly.

---

## Make-first local workflow (mandatory)

This project uses a strict **Make-first** local workflow:

- Run local operations through `make` targets only (`run`, `test`, `sync-docs`, `lint-check`, `type-check`, `pre-deploy`, etc.).
- Avoid ad-hoc direct commands in daily flow (`pytest`, `ruff`, `mypy`, custom scripts) unless you are debugging a target itself.
- Keep command behavior consistent for all developers by using the same Makefile entrypoints.

Checks are intentionally split into two levels:

- Before commit: `make pre-commit-check` (fast local filter from `.pre-commit-config.yaml`).
- Before PR/deploy: `make quality-check` and `make pre-deploy` (full project quality gate).

Recommended flow:

```bash
# one-time setup
make venv
make install

# daily development loop
make format
make lint-check
make type-check
make test
make sync-docs

# before release/deploy
make pre-deploy
```

---

## Code formatting and linting

This project follows a "fast feedback, consistent style" approach:

- **Formatting:** `ruff format` (single canonical formatter).
- **Linting:** `ruff check` for correctness, import order, and common bug patterns.
- **Type checks:** `mypy` baseline for static type safety.
- **Local hook automation:** `pre-commit` runs checks before commit.

Configuration files:

- `pyproject.toml` - `ruff`, `mypy` settings.
- `.pre-commit-config.yaml` - pre-commit hooks.

Recommended daily workflow:

```bash
make format
make lint-check
make type-check
make test
```

Before commit:

```bash
make pre-commit-install   # one-time per clone
make pre-commit-check
```

Rule: keep both commands. `pre-commit-check` is a fast pre-commit filter, while `quality-check` is a broader pre-PR gate.

Before PR/deploy:

```bash
make quality-check
make pre-deploy
```

Optional simplification:
- You can add alias `make verify` -> `make quality-check` for naming convenience.
- Keep `make pre-commit-check` anyway for faster feedback before each commit.

Terminal UX notes:
- Colored status output is enabled by default.
- Use `NO_COLOR=1` for plain output (useful in CI logs), e.g. `NO_COLOR=1 make pre-deploy`.

Policy:
- PRs should not include formatting noise unrelated to feature changes.
- New code should pass lint/type checks without adding broad ignores.
- If a rule is too strict, adjust config centrally instead of bypassing per-file where possible.

---

## Testing policy (mandatory)

Tests are a release gate in this project.

- Every API change must include tests; changes without tests are considered incomplete.
- For each endpoint, keep at least:
  - one success scenario test,
  - one validation/business failure scenario test.
- Keep tests deterministic and isolated (independent DB state per test run).

Commands:

```bash
make test
make test-one path=tests/api/v1/test_user_create.py
make quality-check
make pre-deploy
make deploy DEPLOY_CMD="echo Deploying to staging"
```

Pre-deploy gate (`make pre-deploy`) runs mandatory sequence:
1. Environment check (`make env-check`)
2. Full quality gate (`make quality-check`)

Deployment wrapper:
- `make deploy DEPLOY_CMD="..."` always runs `make pre-deploy` first.
- Actual deployment is delegated to `DEPLOY_CMD` so infra-specific steps stay configurable.

Current baseline:
- API tests live in `tests/`.
- Example endpoint coverage is implemented for `POST /api/v1/user`.

---

## Logging policy (mandatory)

Logging is centralized and file-based by default for local environments:

- Standard setup is configured in `app/core/logging.py` and initialized from `app/main.py`.
- Runtime logs are written to `logs/app.log` (configurable via `.env`: `LOG_DIR`, `LOG_FILE_NAME`, `LOG_LEVEL`).
- Request lifecycle is logged consistently (method, path, status, elapsed time).
- Validation and business-flow events are logged in API/service layers for traceability.
- Log files are local artifacts and are excluded from Git (`logs/`, `*.log`).

Quick check:

```bash
make run
# then inspect logs/app.log in another terminal/editor
```

---

## API versioning policy (mandatory)

Public API contract is versioned by path prefix and governed by strict compatibility rules.

### Version model

- Major API version lives in URL prefix (current: `/api/v1/...`).
- `v1` is stable: only backward-compatible changes are allowed.
- Breaking changes are introduced only in a new major version (for example `/api/v2/...`).

### Breaking changes (not allowed inside same major)

- Removing or renaming endpoints, fields, or enum values.
- Changing type or semantic meaning of existing fields.
- Changing requiredness of existing request fields (`optional -> required`).
- Changing semantic meaning of existing error `code` / `key`.

### Allowed non-breaking changes in `v1`

- Adding new endpoints.
- Adding new optional request/response fields.
- Adding new error codes without changing existing ones.
- Improving docs/examples without runtime contract change.

### Deprecation window and migration

- Any deprecated contract must have a migration window of at least 90 days (or 2 release cycles, whichever is longer).
- Deprecated behavior should be documented in `README.md`, `docs/index.html`, and ADR notes.
- If header-based deprecation is introduced, use:
  - `Deprecation: true`
  - `Sunset: <date>`
  - `Link: <migration-guide>; rel="deprecation"`

### Compatibility rules

- Existing behavior must remain valid for current major clients.
- Error contract is immutable for existing codes: `code` + `key` semantics are never repurposed.
- Contract evolution is additive by default.

### Delivery checklist for contract changes

- Update router `responses`, schemas, and OpenAPI examples.
- Add or update tests for compatibility and migration paths.
- Run `make pre-deploy` and `make sync-docs`.
- Record major policy/contract decisions in ADR.

---

## Project documentation (HTML & UML)

- Human-readable requirements and diagrams: open **`docs/index.html`** in a browser.
- PlantUML sources live under `docs/uml/`:
  - `docs/uml/architecture/*.puml` - C4 architecture views
  - `docs/uml/sequences/*.puml` - sequence diagrams
- Rendered PNGs are stored in `docs/uml/rendered/`.
- To regenerate diagrams and sync docs in one command:

  ```bash
  make sync-docs
  ```

---

## Docs as Code workflow

Documentation is treated as a first-class artifact, same as source code.

### Source-of-truth model

- Business and transport behavior: `app/`
- Error code mapping: `app/errors/validation.py`
- OpenAPI examples: `app/openapi/examples/`
- UML source diagrams: `docs/uml/**/*.puml`
- Engineering decisions (ADR): `docs/adr/*.md`
- Generated docs sections: marker blocks in `README.md` and `docs/index.html`

### Daily usage

```bash
# during development
make test
make sync-docs

# before PR / deploy
make pre-deploy
```

### Docs quality checks

`make sync-docs` is the single docs command and performs:
- UML regeneration (`scripts/regenerate_docs.py`);
- marker-based docs synchronization (`scripts/sync_docs.py`).

If it fails, run:

```bash
make sync-docs
```

### PR rule

- API changes are incomplete without:
  - tests,
  - updated OpenAPI contracts/examples,
  - synchronized docs (`make sync-docs`).

---

## Documentation generation workflow

Documentation generation is unified under one command: `make sync-docs`.

What it does:
1. Regenerates UML diagrams from `docs/uml/**/*.puml` into `docs/uml/rendered/*.png`.
2. Synchronizes marker-based sections in `README.md` and `docs/index.html` from code sources.

Code sources for sync:
- `Makefile` (command reference)
- `app.main` routes (HTTP endpoints)
- `.env.example` (configuration table)
- repository directory structure

Recommended update sequence after architecture/API/doc changes:

```bash
make sync-docs
```

Important:
- Edit only content **outside** auto-generated marker blocks if you want manual text to persist.
- Marker blocks are managed by scripts and may be overwritten on the next sync.

---

## Makefile reference

<!-- BEGIN:MAKEFILE_REF -->
| Command | Purpose |
| ------- | ------- |
| `make quality-check` | # local quality gate |
| `make sync-docs` | # single docs pipeline (render + sync) |
| `make pre-deploy` | # release gate before deploy |
| `make deploy DEPLOY_CMD='…'` | # run deploy after gate |
| `make venv` | Create virtual environment |
| `make install` | Install dependencies |
| `make requirements` | Auto-generate requirements.txt from .venv |
| `make run` | Start FastAPI dev server |
| `make migrate` | Apply all Alembic migrations |
| `make migration name=…` | Auto-generate new Alembic migration |
| `make format` | Auto-format Python code |
| `make format-check` | Verify code formatting (no changes) |
| `make lint-check` | Run Ruff lint checks |
| `make lint-fix` | Run Ruff with auto-fixes |
| `make type-check` | Run mypy type checks |
| `make env-check` | Verify env, deps, and DB connectivity |
| `make quality-check` | Run lint-check + type-check + test + sync-docs |
| `make test` | Run full test suite (pytest) |
| `make test-one path=…` | Run one test file or node |
| `make test-warnings` | Run tests with full warning details |
| `make sync-docs` | Auto-update README.md & docs/index.html from code |
| `make pre-commit-install` | Install git pre-commit hooks |
| `make pre-commit-check` | Run all pre-commit hooks |
| `make pre-deploy` | Run full quality gate before deploy |
| `make deploy DEPLOY_CMD='…'` | Run pre-deploy then deploy command |
<!-- END:MAKEFILE_REF -->


---

## License

MIT
