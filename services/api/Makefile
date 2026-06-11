# services/api/Makefile — Python FastAPI service (ADR 0028 Phase 2).
#
# Real implementations of API-specific targets. Cross-cutting gates
# (ruff / mypy / format) stay in the root Makefile because they scan
# every .py in the tree, not just this service.
#
# Common usage:
#   make -C services/api run           # uvicorn dev server (reload + migrate)
#   make -C services/api migrate       # alembic upgrade head
#   make -C services/api test          # pytest + coverage gate
#   make -C services/api openapi-check # baseline diff + lint
#   make -C services/api build         # docker build services/api/
#   make -C services/api verify        # API-side gate (deps-audit + openapi + contract + test)

REPO_ROOT := $(abspath ..)/..
PYTHON    := $(REPO_ROOT)/.venv/bin/python
PIP       := $(REPO_ROOT)/.venv/bin/pip
ENV       := $(REPO_ROOT)/.env
PYTEST_FLAGS ?= -q --disable-warnings

NO_COLOR ?= 0
ifeq ($(NO_COLOR),1)
  COLOR_RESET :=
  COLOR_GREEN :=
  COLOR_RED   :=
  COLOR_CYAN  :=
else
  COLOR_RESET := \033[0m
  COLOR_GREEN := \033[32m
  COLOR_RED   := \033[31m
  COLOR_CYAN  := \033[36m
endif
ICON_OK   := $(COLOR_GREEN)✓$(COLOR_RESET)
ICON_ERR  := $(COLOR_RED)✗$(COLOR_RESET)
ICON_STEP := $(COLOR_CYAN)→$(COLOR_RESET)
ICON_INFO := $(COLOR_CYAN)i$(COLOR_RESET)

.PHONY: help verify run migrate test test-one openapi-check contract-test openapi-accept-changes build deps-audit env-check

help:
	@echo "services/api — make targets"
	@echo ""
	@echo "  make run                    Start uvicorn dev server (migrate + reload)"
	@echo "  make migrate                Apply alembic migrations"
	@echo "  make test                   pytest + coverage gate"
	@echo "  make test-one path=…        Run one test file/node"
	@echo "  make openapi-check          Lint + breaking-change guard vs baseline"
	@echo "  make contract-test          Snapshot equality vs baseline"
	@echo "  make openapi-accept-changes Overwrite baseline with current spec"
	@echo "  make build                  docker build services/api/ (image: study-app-api:local)"
	@echo "  make deps-audit             pip-audit against the live .venv"
	@echo "  make env-check              Sanity-check .env + DB connectivity"
	@echo "  make verify                 deps-audit + openapi-check + contract-test + test"

# ─────────────────────────────────────────────
# Run / migrate
# ─────────────────────────────────────────────
run:
	@if [ ! -f "$(ENV)" ]; then \
		printf "$(ICON_ERR) %s\n" "$(ENV) not found. Run 'make env-init' from repo root."; exit 1; \
	fi
	@if [ ! -d "$(REPO_ROOT)/.venv" ]; then \
		printf "$(ICON_ERR) %s\n" ".venv not found. Run 'make venv && make install' from repo root."; exit 1; \
	fi
	@printf "$(ICON_STEP) %s\n" "Applying migrations then starting server (reading $(ENV))…"
	@set -a; . $(ENV); set +a; \
	APP_HOST=$${APP_HOST:-127.0.0.1}; \
	APP_PORT=$${APP_PORT:-8000}; \
	cd $(REPO_ROOT)/services/api && PYTHONPATH=. $(PYTHON) -m alembic upgrade head && \
	PYTHONPATH=. $(PYTHON) -m uvicorn app.main:app --host "$$APP_HOST" --port "$$APP_PORT" --reload --no-access-log

migrate:
	@if [ ! -f "$(ENV)" ]; then \
		printf "$(ICON_ERR) %s\n" "$(ENV) not found. Cannot resolve SQLITE_DB_PATH."; exit 1; \
	fi
	@printf "$(ICON_STEP) %s\n" "Applying migrations…"
	@cd $(REPO_ROOT)/services/api && PYTHONPATH=. $(PYTHON) -m alembic upgrade head && printf "$(ICON_OK) %s\n" "Migrations applied"

# ─────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────
test:
	@printf "$(COLOR_CYAN)== TEST: START ==$(COLOR_RESET)\n"
	@if [ ! -d "$(REPO_ROOT)/.venv" ]; then \
		printf "$(ICON_ERR) %s\n" ".venv not found."; exit 1; \
	fi
	@printf "$(ICON_STEP) %s\n" "Running tests…"
	@cd $(REPO_ROOT) && $(PYTHON) -m pytest $(PYTEST_FLAGS)
	@printf "$(ICON_OK) %s\n" "Tests passed"
	@printf "$(COLOR_GREEN)== TEST: SUCCESS ==$(COLOR_RESET)\n"

test-one:
	@if [ -z "$(path)" ]; then \
		printf "$(ICON_ERR) %s\n" "Missing test path. Usage: make -C services/api test-one path=tests/api/v1/test_user_create.py"; exit 1; \
	fi
	@printf "$(ICON_STEP) %s\n" "Running selected tests: $(path)"
	@cd $(REPO_ROOT) && $(PYTHON) -m pytest $(PYTEST_FLAGS) $(path)

# ─────────────────────────────────────────────
# OpenAPI governance
# ─────────────────────────────────────────────
openapi-check:
	@printf "$(COLOR_CYAN)== OPENAPI-CHECK: START ==$(COLOR_RESET)\n"
	@printf "$(ICON_STEP) %s\n" "Running OpenAPI governance checks…"
	@cd $(REPO_ROOT) && $(PYTHON) tools/api/openapi_governance.py check
	@printf "$(ICON_OK) %s\n" "OpenAPI checks passed"
	@printf "$(COLOR_GREEN)== OPENAPI-CHECK: SUCCESS ==$(COLOR_RESET)\n"

contract-test:
	@printf "$(COLOR_CYAN)== CONTRACT-TEST: START ==$(COLOR_RESET)\n"
	@printf "$(ICON_STEP) %s\n" "Running OpenAPI snapshot contract test…"
	@cd $(REPO_ROOT) && $(PYTHON) tools/api/openapi_governance.py contract-test
	@printf "$(ICON_OK) %s\n" "OpenAPI contract-test passed"
	@printf "$(COLOR_GREEN)== CONTRACT-TEST: SUCCESS ==$(COLOR_RESET)\n"

openapi-accept-changes:
	@printf "$(ICON_STEP) %s\n" "Accepting OpenAPI changes (updating baseline)…"
	@cd $(REPO_ROOT) && $(PYTHON) tools/api/openapi_governance.py update-baseline
	@printf "$(ICON_OK) %s\n" "OpenAPI baseline updated"

# ─────────────────────────────────────────────
# Docker
# ─────────────────────────────────────────────
build:
	@docker build -t study-app-api:local .
	@printf "$(ICON_OK) %s\n" "Image study-app-api:local built"

# ─────────────────────────────────────────────
# Supply chain + env health
# ─────────────────────────────────────────────
deps-audit:
	@if [ ! -d "$(REPO_ROOT)/.venv" ]; then \
		printf "$(ICON_ERR) %s\n" ".venv not found."; exit 1; \
	fi
	@mkdir -p $(REPO_ROOT)/.pip-audit-cache
	@printf "$(ICON_STEP) %s\n" "Running pip-audit against the local venv…"
	@cd $(REPO_ROOT) && $(PYTHON) -m pip_audit -l --desc on --cache-dir .pip-audit-cache
	@printf "$(ICON_OK) %s\n" "pip-audit: no known vulnerabilities reported"

env-check:
	@printf "$(ICON_STEP) %s\n" "Checking environment…"
	@if [ ! -d "$(REPO_ROOT)/.venv" ]; then printf "  $(ICON_ERR) %s\n" ".venv missing"; else printf "  $(ICON_OK) %s\n" ".venv exists"; fi
	@if [ ! -f "$(ENV)" ]; then printf "  $(ICON_ERR) %s\n" ".env missing"; else printf "  $(ICON_OK) %s\n" ".env exists"; fi
	@if [ ! -f "$(REPO_ROOT)/services/api/requirements.txt" ]; then printf "  $(ICON_ERR) %s\n" "services/api/requirements.txt missing"; else printf "  $(ICON_OK) %s\n" "services/api/requirements.txt exists"; fi
	@printf "  $(ICON_INFO) APP_ENV=%s\n" "$${APP_ENV:-<not set>}"
	@printf "  $(ICON_INFO) ENV_FILE=%s\n" "$${ENV_FILE:-<not set>}"
	@if [ -d "$(REPO_ROOT)/.venv" ] && [ -f "$(ENV)" ]; then \
		cd $(REPO_ROOT) && PYTHONPATH=services/api $(PYTHON) -c "from app.core.config import get_settings; s=get_settings(); print('  $(ICON_OK) Config OK - DB:', s.sqlite_db_path)" 2>/dev/null \
		|| printf "  $(ICON_ERR) %s\n" "Config load failed (check .env values)"; \
	fi
	@printf "$(ICON_STEP) %s\n" "Done"

# ─────────────────────────────────────────────
# Aggregator
# ─────────────────────────────────────────────
verify:
	@printf "$(COLOR_CYAN)== API VERIFY: START ==$(COLOR_RESET)\n"
	@printf "$(ICON_INFO) %s\n" "[1/4] deps-audit"
	@$(MAKE) deps-audit
	@printf "$(ICON_INFO) %s\n" "[2/4] openapi-check"
	@$(MAKE) openapi-check
	@printf "$(ICON_INFO) %s\n" "[3/4] contract-test"
	@$(MAKE) contract-test
	@printf "$(ICON_INFO) %s\n" "[4/4] test"
	@$(MAKE) test
	@printf "$(COLOR_GREEN)== API VERIFY: SUCCESS ==$(COLOR_RESET)\n"
