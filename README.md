# Study App API

REST API for user registration and related domain logic. Built with **FastAPI**, **SQLAlchemy 2**, **Alembic**, and **SQLite**, with configuration from environment variables and request/response validation via **Pydantic v2**.

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
- [Database and migrations](#database-and-migrations)
- [Project documentation (HTML & UML)](#project-documentation-html--uml)
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
│   ├── models/  # ORM models
│   │   ├── core/  # Core domain entities
│   │   └── reference/  # Reference / lookup entities
│   ├── repositories/  # Data-access layer
│   ├── schemas/  # Pydantic request/response models
│   └── services/  # Business logic
├── alembic/  # Migration environment
│   └── versions/  # Migration scripts
├── docs/  # HTML docs & UML sources
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
- **make** (optional but recommended; all common tasks are wrapped in the `Makefile`)

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
<!-- END:CONFIG_TABLE -->

> **Security:** do not commit `.env` with secrets. The repository includes `.env.example` only. Local `*.db` files are listed in `.gitignore`.

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
| `POST` | `/api/v1/users/register` | Register user |
| `GET` | `/health` | Health check |
<!-- END:HTTP_ENDPOINTS -->

---

## Project documentation (HTML & UML)

- Human-readable requirements and diagrams: open **`docs/index.html`** in a browser.
- PlantUML sources live under `docs/uml/`:
  - `docs/uml/architecture/*.puml` - C4 architecture views
  - `docs/uml/sequences/*.puml` - sequence diagrams
- Rendered PNGs are stored in `docs/uml/rendered/`.
- To regenerate all UML images:

  ```bash
  make docs
  make docs-watch   # watch docs/uml/**/*.puml and regenerate on changes
  ```

---

## Documentation generation workflow

This project has **two independent doc-generation flows**:

1. **Diagram rendering flow** (`make docs`, `make docs-watch`)
   - Source of truth: `docs/uml/**/*.puml`
   - Output: `docs/uml/rendered/*.png`
   - Script: `scripts/regenerate_docs.py`

2. **Text sync flow** (`make sync-docs`)
   - Sources of truth:
     - `Makefile` (command reference)
     - `app.main` routes (HTTP endpoints)
     - `.env.example` (configuration table)
     - repository directory structure
   - Outputs:
     - `README.md` sections between `<!-- BEGIN:... -->` and `<!-- END:... -->`
     - API contracts block in `docs/index.html` (`API_CONTRACTS`)
   - Script: `scripts/sync_docs.py`

Recommended update sequence after architecture/API/doc changes:

```bash
make docs
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
| `make venv` | Create virtual environment |
| `make install` | Install dependencies |
| `make requirements` | Auto-generate requirements.txt from .venv |
| `make run` | Start FastAPI dev server |
| `make migrate` | Apply all Alembic migrations |
| `make migration name=…` | Auto-generate new Alembic migration |
| `make docs` | Regenerate UML docs once |
| `make docs-watch` | Watch UML sources, regenerate on change |
| `make check` | Verify env, deps, and DB connectivity |
| `make sync-docs` | Auto-update README.md & docs/index.html from code |
<!-- END:MAKEFILE_REF -->


---

## License

MIT
