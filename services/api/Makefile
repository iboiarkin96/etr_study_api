# services/api/Makefile — per-service entry points for the FastAPI service (ADR 0028 Phase 2).
#
# Delegates to the root Makefile for shared gates (ruff/mypy/pytest config still
# lives in /pyproject.toml, .pre-commit-config.yaml, /.github/workflows/ci.yml).
# Per-service targets exist so you can iterate on the API without leaving its folder.
#
# Usage:
#   make -C services/api verify   # full local gate (delegates to root `make verify`)
#   make -C services/api run      # uvicorn with --reload
#   make -C services/api test     # pytest with coverage
#   make -C services/api migrate  # alembic upgrade head
#   make -C services/api build    # docker build services/api/

REPO_ROOT := $(abspath ..)/..
PYTHON    := $(REPO_ROOT)/.venv/bin/python

.PHONY: help verify test lint-check type-check run migrate build openapi-check

help:
	@echo "services/api/Makefile — per-service entry points (delegates to root for shared gates)"
	@echo ""
	@echo "  make verify       Full gate (calls \$$(REPO_ROOT)/Makefile verify)"
	@echo "  make test         pytest + coverage"
	@echo "  make lint-check   ruff check ."
	@echo "  make type-check   mypy services/api/app"
	@echo "  make run          uvicorn (reload, no-access-log)"
	@echo "  make migrate      alembic upgrade head"
	@echo "  make build        docker build services/api/"
	@echo "  make openapi-check baseline diff + breaking-change check"

# Shared gates — delegate to root.
verify lint-check type-check openapi-check test:
	@$(MAKE) -C $(REPO_ROOT) $@

run:
	@$(MAKE) -C $(REPO_ROOT) run

migrate:
	@$(MAKE) -C $(REPO_ROOT) migrate

build:
	@docker build -t study-app-api:local .
