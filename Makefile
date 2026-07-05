PYTHON := .venv/bin/python
PIP    := .venv/bin/pip
ENV    := .env
DEPLOY_CMD ?=
PYTEST_FLAGS ?= -q --disable-warnings
NO_COLOR ?= 0
MAKEFLAGS += --no-print-directory

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

# This Makefile is the cross-cutting orchestrator. Per-service implementations live
# under services/<svc>/Makefile (api, portal, monitoring); cross-cutting tooling
# scripts live under tools/. The delegate targets below forward common verbs to
# the owning service so habits like `make run` / `make docs-fix` keep working.

.PHONY: help setup dev fix check verify verify-all verify-api verify-portal verify-monitoring verify-frontend ci docs ship release-check release \
        venv install env-init env-check clean-cache \
        format-fix format-check lint-check lint-fix dead-code-check type-check \
        pre-commit-install pre-commit-check pre-commit-validate \
        stack-up stack-down stack-down-volumes stack-logs logging-up logging-down \
        run migrate test test-one deps-audit \
        openapi-check contract-test openapi-accept-changes api-mock build \
        docs-fix docs-check docs-html-check docs-design-check docs-a11y-check docs-feedback-check docs-spec-check docs-nav-check \
        catalog-render catalog-render-check serve open sync-staging \
        visual-test visual-test-update

# ──────────────────────────────────────────────
# Help
# ──────────────────────────────────────────────
help:
	@echo ""
	@echo "  Study App — root Makefile (cross-cutting orchestrator)"
	@echo "  ------------------------------------------------------"
	@echo ""
	@echo "  Common entry points (recommended)"
	@echo "    make setup                  # first-time local setup (.venv + install deps + .env)"
	@echo "    make dev                    # run local API (delegates → services/api)"
	@echo "    make fix                    # auto-fix code + docs"
	@echo "    make check                  # fast checks (lint/types/openapi/contract/tests)"
	@echo "    make verify-all             # full pre-push gate (cross-cutting + all four services)"
	@echo "    make verify                 # alias for verify-all (kept for habits / CI)"
	@echo "    make docs                   # regenerate docs artifacts (delegates → services/portal)"
	@echo "    make ship                   # full pre-release gate"
	@echo ""
	@echo "  Per-service verify (one gate per service in the monorepo)"
	@echo "    make verify-api             → services/api/verify    (deps-audit · openapi · contract · test)"
	@echo "    make verify-portal          → services/portal/verify (docs-check drift gate + docs-a11y)"
	@echo "    make verify-monitoring      → services/monitoring/verify (compose-config smoke for both stacks)"
	@echo "    make verify-frontend        # no own gate yet — assets consumed and exercised by portal"
	@echo ""
	@echo "  Cross-cutting code quality (scans every .py)"
	@echo "    make format-fix             ruff format ."
	@echo "    make format-check           ruff format --check ."
	@echo "    make lint-check             ruff check ."
	@echo "    make lint-fix               ruff check --fix ."
	@echo "    make dead-code-check        vulture"
	@echo "    make type-check             mypy services/api/app tests tools"
	@echo ""
	@echo "  Environment"
	@echo "    make venv                   Create .venv"
	@echo "    make install                pip install -r services/api/requirements.txt"
	@echo "    make env-init               Copy env/example → .env"
	@echo "    make env-check              Delegates → services/api"
	@echo "    make clean-cache            Remove tool caches"
	@echo ""
	@echo "  Docker compose orchestration"
	@echo "    make stack-up               api + observability via root docker-compose.yml"
	@echo "    make stack-down             stop, preserve volumes"
	@echo "    make stack-down-volumes     stop + wipe persistent volumes"
	@echo "    make stack-logs             tail compose logs"
	@echo "    make logging-up             optional ES + Kibana + Filebeat (heavy)"
	@echo "    make logging-down           stop the logging stack"
	@echo ""
	@echo "  Pre-commit"
	@echo "    make pre-commit-install     Install hooks"
	@echo "    make pre-commit-check       Run all hooks against working tree"
	@echo "    make pre-commit-validate    Deep validation (asset/css/path checkers + verify)"
	@echo ""
	@echo "  Per-service delegates (forward to services/<svc>/Makefile)"
	@echo "    make run                    → services/api/Makefile"
	@echo "    make migrate                → services/api/Makefile"
	@echo "    make test [path=…]          → services/api/Makefile"
	@echo "    make openapi-check          → services/api/Makefile"
	@echo "    make contract-test          → services/api/Makefile"
	@echo "    make openapi-accept-changes → services/api/Makefile"
	@echo "    make api-mock               → services/api/Makefile (mock every canon on its own port)"
	@echo "    make build                  → services/api/Makefile (docker build)"
	@echo "    make deps-audit             → services/api/Makefile"
	@echo "    make docs-fix               → services/portal/Makefile"
	@echo "    make docs-check             → services/portal/Makefile"
	@echo "    make docs-html-check        → services/portal/Makefile"
	@echo "    make docs-design-check      → services/portal/Makefile"
	@echo "    make docs-a11y-check        → services/portal/Makefile"
	@echo "    make docs-feedback-check    → services/portal/Makefile"
	@echo "    make docs-spec-check        → services/portal/Makefile"
	@echo "    make docs-nav-check         → services/portal/Makefile (sidebar coverage)"
	@echo "    make catalog-render         → services/portal/Makefile"
	@echo "    make catalog-render-check   → services/portal/Makefile"
	@echo "    make serve [PORTAL_PORT=N]  → services/portal/Makefile (static preview)"
	@echo "    make open  [PORTAL_PORT=N]  → services/portal/Makefile (open in browser)"
	@echo "    make visual-test            → services/portal/Makefile (UI Kit pixel-diff, BL-047)"
	@echo "    make visual-test-update     → services/portal/Makefile (refresh visual baselines)"
	@echo "    make api-check              → services/portal/Makefile (validate ALL canons)"
	@echo "    make api-check <resource>   → services/portal/Makefile (validate one resource across every canon)"
	@echo ""
	@echo "  Release pipeline (ADR 0034 dual-Pages)"
	@echo "    make sync-staging           Reset staging branch to origin/main after a promo merge"
	@echo ""

# ──────────────────────────────────────────────
# Setup + entry-point aliases
# ──────────────────────────────────────────────
setup: venv install
	@if [ ! -f ".env" ]; then \
		$(MAKE) env-init; \
	else \
		printf "$(ICON_OK) %s\n" ".env already exists"; \
	fi

dev: run
ci: verify
docs: docs-fix
ship: release-check

# ──────────────────────────────────────────────
# Environment
# ──────────────────────────────────────────────
venv:
	@if [ -d ".venv" ]; then \
		printf "$(ICON_OK) %s\n" ".venv already exists"; \
	else \
		printf "$(ICON_STEP) %s\n" "Creating virtual environment…"; \
		python3 -m venv .venv && printf "$(ICON_OK) %s\n" ".venv created"; \
	fi

install:
	@if [ ! -d ".venv" ]; then \
		printf "$(ICON_ERR) %s\n" ".venv not found. Run 'make venv' first."; exit 1; \
	fi
	@printf "$(ICON_STEP) %s\n" "Upgrading pip…"
	@$(PYTHON) -m pip install --upgrade pip -q
	@printf "$(ICON_STEP) %s\n" "Installing requirements…"
	@$(PIP) install -r services/api/requirements.txt -q
	@printf "$(ICON_OK) %s\n" "Dependencies installed"

env-init:
	@if [ -f ".env" ]; then \
		printf "$(ICON_ERR) %s\n" ".env already exists — remove or rename it first."; exit 1; \
	fi
	@cp env/example .env && printf "$(ICON_OK) %s\n" ".env created from env/example — edit APP_ENV and secrets"

env-check:
	@$(MAKE) -C services/api env-check

# ──────────────────────────────────────────────
# Cross-cutting code quality (every .py)
# ──────────────────────────────────────────────
format-fix:
	@if [ ! -d ".venv" ]; then printf "$(ICON_ERR) %s\n" ".venv not found."; exit 1; fi
	@printf "$(ICON_STEP) %s\n" "Formatting Python code…"
	@$(PYTHON) -m ruff format .
	@printf "$(ICON_OK) %s\n" "Formatting completed"

format-check:
	@if [ ! -d ".venv" ]; then printf "$(ICON_ERR) %s\n" ".venv not found."; exit 1; fi
	@printf "$(ICON_STEP) %s\n" "Checking Python code formatting…"
	@$(PYTHON) -m ruff format --check .
	@printf "$(ICON_OK) %s\n" "Formatting check passed"

lint-check:
	@printf "$(COLOR_CYAN)== LINT-CHECK: START ==$(COLOR_RESET)\n"
	@if [ ! -d ".venv" ]; then printf "$(ICON_ERR) %s\n" ".venv not found."; exit 1; fi
	@printf "$(ICON_STEP) %s\n" "Running Ruff lint checks…"
	@$(PYTHON) -m ruff check .
	@printf "$(ICON_OK) %s\n" "Lint checks passed"
	@printf "$(COLOR_GREEN)== LINT-CHECK: SUCCESS ==$(COLOR_RESET)\n"

lint-fix:
	@if [ ! -d ".venv" ]; then printf "$(ICON_ERR) %s\n" ".venv not found."; exit 1; fi
	@printf "$(ICON_STEP) %s\n" "Running Ruff auto-fixes…"
	@$(PYTHON) -m ruff check --fix .
	@printf "$(ICON_OK) %s\n" "Auto-fix pass completed"

dead-code-check:
	@if [ ! -d ".venv" ]; then printf "$(ICON_ERR) %s\n" ".venv not found."; exit 1; fi
	@printf "$(ICON_STEP) %s\n" "Running Vulture dead-code scan…"
	@$(PYTHON) -m vulture
	@printf "$(ICON_OK) %s\n" "Vulture scan passed"

type-check:
	@printf "$(COLOR_CYAN)== TYPE-CHECK: START ==$(COLOR_RESET)\n"
	@if [ ! -d ".venv" ]; then printf "$(ICON_ERR) %s\n" ".venv not found."; exit 1; fi
	@printf "$(ICON_STEP) %s\n" "Running mypy type checks…"
	@PYTHONPATH=services/api $(PYTHON) -m mypy services/api/app tests tools
	@printf "$(ICON_OK) %s\n" "Type checks passed"
	@printf "$(COLOR_GREEN)== TYPE-CHECK: SUCCESS ==$(COLOR_RESET)\n"

# ──────────────────────────────────────────────
# Docker compose orchestration
# ──────────────────────────────────────────────
stack-up:
	@printf "$(ICON_STEP) %s\n" "Starting api + monitoring stack…"
	@docker compose up -d --build
	@printf "$(ICON_OK) %s\n" "Stack up — api :8000  ·  prom :9090  ·  grafana :3001  ·  blackbox :9115"

stack-down:
	@printf "$(ICON_STEP) %s\n" "Stopping stack…"
	@docker compose down
	@printf "$(ICON_OK) %s\n" "Stack down"

stack-down-volumes:
	@printf "$(ICON_STEP) %s\n" "Stopping stack and wiping persistent volumes…"
	@docker compose down -v
	@printf "$(ICON_OK) %s\n" "Stack down (volumes wiped)"

stack-logs:
	@docker compose logs -f --tail=100

logging-up:
	@docker compose -f services/monitoring/docker-compose.logging.yml up -d
	@printf "$(ICON_OK) %s\n" "Logging stack up — ES :9200  ·  Kibana :5601"

logging-down:
	@docker compose -f services/monitoring/docker-compose.logging.yml down

# ──────────────────────────────────────────────
# Pre-commit
# ──────────────────────────────────────────────
pre-commit-install:
	@if [ ! -d ".venv" ]; then printf "$(ICON_ERR) %s\n" ".venv not found."; exit 1; fi
	@printf "$(ICON_STEP) %s\n" "Installing pre-commit hooks…"
	@$(PYTHON) -m pre_commit install
	@printf "$(ICON_OK) %s\n" "pre-commit hooks installed"

pre-commit-check:
	@if [ ! -d ".venv" ]; then printf "$(ICON_ERR) %s\n" ".venv not found."; exit 1; fi
	@printf "$(ICON_STEP) %s\n" "Running pre-commit hooks…"
	@$(PYTHON) -m pre_commit run --all-files
	@printf "$(ICON_OK) %s\n" "pre-commit checks passed"

pre-commit-validate:
	@if [ ! -d ".venv" ]; then printf "$(ICON_ERR) %s\n" ".venv not found."; exit 1; fi
	@printf "$(COLOR_CYAN)== PRE-COMMIT-VALIDATE: START ==$(COLOR_RESET)\n"
	@printf "$(ICON_INFO) %s\n" "[1/4] check_css_vars"
	@$(PYTHON) tools/governance/check_css_vars.py
	@printf "$(ICON_INFO) %s\n" "[2/4] check_asset_refs"
	@$(PYTHON) tools/governance/check_asset_refs.py
	@printf "$(ICON_INFO) %s\n" "[3/4] check_path_literals"
	@$(PYTHON) tools/governance/check_path_literals.py
	@printf "$(ICON_INFO) %s\n" "[4/4] verify"
	@$(MAKE) verify
	@printf "$(COLOR_GREEN)== PRE-COMMIT-VALIDATE: SUCCESS ==$(COLOR_RESET)\n"

# ──────────────────────────────────────────────
# Aggregators
# ──────────────────────────────────────────────
fix:
	@printf "$(COLOR_CYAN)== FIX: START ==$(COLOR_RESET)\n"
	@printf "$(ICON_INFO) %s\n" "[1/3] format-fix"
	@$(MAKE) format-fix
	@printf "$(ICON_INFO) %s\n" "[2/3] lint-fix"
	@$(MAKE) lint-fix
	@printf "$(ICON_INFO) %s\n" "[3/3] docs-fix (services/portal)"
	@$(MAKE) -C services/portal docs-fix
	@printf "$(COLOR_GREEN)== FIX: SUCCESS ==$(COLOR_RESET)\n"

check:
	@printf "$(COLOR_CYAN)== CHECK: START ==$(COLOR_RESET)\n"
	@printf "$(ICON_INFO) %s\n" "[1/5] lint-check"
	@$(MAKE) lint-check
	@printf "$(ICON_INFO) %s\n" "[2/5] type-check"
	@$(MAKE) type-check
	@printf "$(ICON_INFO) %s\n" "[3/5] openapi-check"
	@$(MAKE) -C services/api openapi-check
	@printf "$(ICON_INFO) %s\n" "[4/5] contract-test"
	@$(MAKE) -C services/api contract-test
	@printf "$(ICON_INFO) %s\n" "[5/5] test"
	@$(MAKE) -C services/api test
	@printf "$(COLOR_GREEN)== CHECK: SUCCESS ==$(COLOR_RESET)\n"

# ──────────────────────────────────────────────
# Per-service verify slots (one named target per service in the monorepo)
# ──────────────────────────────────────────────
verify-api:
	@$(MAKE) -C services/api verify

verify-portal:
	@$(MAKE) -C services/portal verify

verify-monitoring:
	@$(MAKE) -C services/monitoring verify

# Frontend (UI Kit v2 assets) has no own runtime / build step today — its
# content is exercised by services/portal (docs-check + docs-a11y-check render
# every page). This target exists so the monorepo map and CI matrix can name
# every service uniformly; if frontend ever grows its own pipeline (visual
# regression baseline, lint of kit CSS, etc.), wire it here.
verify-frontend:
	@printf "$(ICON_INFO) %s\n" "services/frontend has no own gate today — UI Kit v2 is consumed and exercised by services/portal (docs-check)."

# verify-all — full pre-push composite: cross-cutting code quality first, then
# every service in declared order. Same composition as ci.yml matrix lanes.
verify-all:
	@printf "$(COLOR_CYAN)== VERIFY-ALL: START ==$(COLOR_RESET)\n"
	@printf "$(ICON_INFO) %s\n" "[1/6] lint-check  (cross-cutting)"
	@$(MAKE) lint-check
	@printf "$(ICON_INFO) %s\n" "[2/6] type-check  (cross-cutting)"
	@$(MAKE) type-check
	@printf "$(ICON_INFO) %s\n" "[3/6] verify-api"
	@$(MAKE) verify-api
	@printf "$(ICON_INFO) %s\n" "[4/6] verify-portal"
	@$(MAKE) verify-portal
	@printf "$(ICON_INFO) %s\n" "[5/6] verify-monitoring"
	@$(MAKE) verify-monitoring
	@printf "$(ICON_INFO) %s\n" "[6/6] verify-frontend"
	@$(MAKE) verify-frontend
	@printf "$(COLOR_GREEN)== VERIFY-ALL: SUCCESS ==$(COLOR_RESET)\n"

# verify — backward-compat alias for verify-all (CI workflows and finger
# memory both call `make verify`; keeping the name avoids breakage).
verify: verify-all

release-check:
	@if [ ! -d ".venv" ]; then printf "$(ICON_ERR) %s\n" ".venv not found."; exit 1; fi
	@printf "$(COLOR_CYAN)== RELEASE-CHECK: START ==$(COLOR_RESET)\n"
	@printf "$(ICON_INFO) %s\n" "[1/2] env-check"
	@$(MAKE) env-check
	@printf "$(ICON_INFO) %s\n" "[2/2] verify"
	@$(MAKE) verify
	@printf "$(COLOR_GREEN)== RELEASE-CHECK: SUCCESS ==$(COLOR_RESET)\n"

release:
	@if [ -z "$(DEPLOY_CMD)" ]; then \
		printf "$(ICON_ERR) %s\n" "Missing DEPLOY_CMD. Usage: make release DEPLOY_CMD='echo Deploying'"; exit 1; \
	fi
	@printf "$(COLOR_CYAN)== RELEASE: START ==$(COLOR_RESET)\n"
	@$(MAKE) release-check
	@printf "$(ICON_STEP) %s\n" "Running deploy command: $(DEPLOY_CMD)"
	@sh -c "$(DEPLOY_CMD)"
	@printf "$(COLOR_GREEN)== RELEASE: SUCCESS ==$(COLOR_RESET)\n"

# ──────────────────────────────────────────────
# Per-service delegates (kept so habits like `make run` stay working)
# ──────────────────────────────────────────────
run migrate openapi-check contract-test openapi-accept-changes api-mock build deps-audit:
	@$(MAKE) -C services/api $@

test:
	@$(MAKE) -C services/api test

test-one:
	@$(MAKE) -C services/api test-one path=$(path)

docs-fix docs-check docs-html-check docs-design-check docs-a11y-check docs-feedback-check docs-spec-check docs-nav-check catalog-render catalog-render-check serve open visual-test visual-test-update api-check:
	@$(MAKE) -C services/portal $@

# ──────────────────────────────────────────────
# Release pipeline — ADR 0034 dual-Pages
# ──────────────────────────────────────────────
# After a `staging → main` PR merges (squash), origin/main has a single new
# commit and origin/staging still carries the pre-squash history. Left alone,
# they diverge a little more on every promotion. This target resets the local
# and remote `staging` to match `origin/main` so the next feature can branch
# off a clean common ancestor. Safe by construction:
#   - aborts if the working tree is dirty
#   - uses --force-with-lease (refuses to overwrite a staging tip we haven't seen)
#   - returns you to the branch you were on before
# Procedure / rationale: services/portal/internal/services/portal/how-to/sync-staging-after-prod-merge.html
sync-staging:
	@set -e; \
	current="$$(git rev-parse --abbrev-ref HEAD)"; \
	if ! git diff --quiet || ! git diff --cached --quiet; then \
		printf "$(ICON_ERR) %s\n" "Working tree is dirty — commit or stash before syncing staging."; exit 1; \
	fi; \
	printf "$(ICON_STEP) %s\n" "Fetching origin…"; \
	git fetch origin --prune; \
	printf "$(ICON_STEP) %s\n" "Resetting local staging to origin/main…"; \
	git switch staging 2>/dev/null || git switch -c staging origin/main; \
	git reset --hard origin/main; \
	printf "$(ICON_STEP) %s\n" "Force-with-lease push staging → origin…"; \
	git push --force-with-lease origin staging; \
	if [ "$$current" != "staging" ]; then \
		printf "$(ICON_STEP) %s\n" "Returning to $$current…"; \
		git switch "$$current"; \
	fi; \
	printf "$(ICON_OK) %s\n" "Staging is now at origin/main."

# ──────────────────────────────────────────────
# Housekeeping
# ──────────────────────────────────────────────
clean-cache:
	@printf "$(COLOR_CYAN)== CLEAN-CACHE: START ==$(COLOR_RESET)\n"
	@printf "$(ICON_STEP) %s\n" "Removing __pycache__ directories…"
	@find . -type d -name '__pycache__' -not -path './.venv/*' -not -path './node_modules/*' -prune -exec rm -rf {} +
	@printf "$(ICON_STEP) %s\n" "Removing tool caches (.mypy_cache, .ruff_cache, .pytest_cache, .pip-audit-cache)…"
	@rm -rf .mypy_cache .ruff_cache .pytest_cache .pip-audit-cache
	@printf "$(ICON_OK) %s\n" "Caches cleaned"
