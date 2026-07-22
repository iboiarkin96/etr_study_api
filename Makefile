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

.PHONY: help setup up down status down-volumes logging-up logging-down logs \
        fix check verify verify-api verify-portal verify-monitoring verify-frontend release-check release \
        venv install env-init env-check clean-cache \
        format-fix format-check lint-check lint-fix dead-code-check type-check \
        pre-commit-install pre-commit-check pre-commit-validate \
        run migrate test test-one deps-audit \
        openapi-check openapi-regen api-mock build \
        docs-fix docs-check docs-html-check docs-design-check docs-a11y-check docs-feedback-check docs-spec-check docs-nav-check docs-storybook-check \
        catalog-render catalog-render-check serve open sync-staging \
        visual-test visual-test-update \
        tma-dev tma-storybook-dev tma-typecheck tma-lint tma-test tma-build tma-verify \
        tma-tunnel-up tma-tunnel-down open-web \
        gen-test-data

# ──────────────────────────────────────────────
# Help
# ──────────────────────────────────────────────
help:
	@echo ""
	@echo "  Study App — root Makefile"
	@echo "  ─────────────────────────"
	@echo ""
	@echo "  ★ Daily use — start / stop everything"
	@echo "    make up                     Start EVERYTHING + Cloudflare tunnels for on-device Telegram."
	@echo "                                Prints ONE URL at the end — paste it into @BotFather → Menu Button."
	@echo "    make down                   Stop everything (docker volumes preserved)."
	@echo "    make status                 Show what's running + all URLs."
	@echo ""
	@echo "  Toggles (rarely needed)"
	@echo "    NO_TUNNEL=1 make up         Skip Cloudflare tunnels (local browser only, no on-device test)."
	@echo "    OPEN=0 make up              Do NOT auto-open browser tabs."
	@echo "    make down-volumes           down + WIPE prometheus/grafana/es data."
	@echo "    make open-web               Re-open all 8 web UIs in the browser."
	@echo "    (logs)                      Service logs → Kibana http://127.0.0.1:5601 (Discover)."
	@echo "                                Background procs → .runtime/*.log (portal, tma, tma-storybook)."
	@echo ""
	@echo "  First-time setup"
	@echo "    make setup                  .venv + install deps + .env from template"
	@echo ""
	@echo "  Quality gates (day-to-day)"
	@echo "    make fix                    Auto-fix code + docs"
	@echo "    make check                  Fast checks (lint/types/openapi/tests)"
	@echo "    make verify                 Full pre-push gate (cross-cutting + all four services)"
	@echo "    make verify-api             → services/api/verify"
	@echo "    make verify-portal          → services/portal/verify"
	@echo "    make verify-monitoring      → services/monitoring/verify"
	@echo "    make verify-frontend        (no own gate — exercised by verify-portal)"
	@echo ""
	@echo "  Cross-cutting code quality (scans every .py)"
	@echo "    make format-fix / format-check   ruff format [--check] ."
	@echo "    make lint-check   / lint-fix     ruff check [--fix] ."
	@echo "    make dead-code-check             vulture"
	@echo "    make type-check                  mypy services/api/app tests tools"
	@echo ""
	@echo "  Environment"
	@echo "    make venv / install / env-init / env-check / clean-cache"
	@echo ""
	@echo "  Pre-commit"
	@echo "    make pre-commit-install / pre-commit-check / pre-commit-validate"
	@echo ""
	@echo "  Per-service delegates"
	@echo "    make run                    → services/api (local uvicorn --reload; use 'make up' for full stack)"
	@echo "    make migrate                → services/api"
	@echo "    make test [path=…]          → services/api"
	@echo "    make openapi-check / openapi-regen / api-mock / build / deps-audit → services/api"
	@echo "    make docs-fix / docs-check / docs-html-check / docs-design-check   → services/portal"
	@echo "    make docs-a11y-check / docs-feedback-check / docs-spec-check       → services/portal"
	@echo "    make docs-nav-check / catalog-render / catalog-render-check        → services/portal"
	@echo "    make serve / open [PORTAL_PORT=N]  → services/portal (portal preview only, no api)"
	@echo "    make visual-test / visual-test-update → services/portal (BL-047 pixel-diff)"
	@echo "    make api-check [<resource>]         → services/portal (canon validation)"
	@echo "    make tma-dev                        → services/telegram dev (Vite on :5173, foreground)"
	@echo "    make tma-storybook-dev              → services/telegram storybook (Storybook on :6006, foreground)"
	@echo "    make tma-typecheck / tma-lint / tma-test / tma-build / tma-verify → services/telegram"
	@echo "    make tma-storybook / tma-storybook-check                          → services/telegram (Storybook static)"
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
# One-shot lifecycle — start / stop the whole thing
# ──────────────────────────────────────────────
# `up` brings up the full local stack in one shot:
#   1. api + prometheus + grafana + blackbox via docker compose (detached).
#      The api image runs `alembic upgrade head` on start (see services/api/
#      Dockerfile entrypoint), so migrations are handled automatically.
#   2. Portal static server via python http.server, launched in the background
#      with its PID stored under .runtime/portal.pid so `down` can stop it.
#      Portal logs go to .runtime/portal.log (gitignored).
#   3. Telegram Mini App Vite dev server (services/telegram), launched in the
#      background against its local vite binary. PID under .runtime/tma.pid,
#      stdout at .runtime/tma.log. Skipped with a hint if node_modules isn't
#      installed yet — run `make -C services/telegram install` once, then `make up`.
#   4. Telegram Storybook dev server (services/telegram), launched in the
#      background against its local storybook binary with `--no-open` so it
#      doesn't hijack a browser tab. PID under .runtime/tma-storybook.pid,
#      stdout at .runtime/tma-storybook.log. Same install-first fallback as (3).
#
# `down` is the mirror image: stops portal + telegram dev + storybook, then
# docker compose down. `status` inspects every world and prints the URL cheat-sheet.
#
# Where to find logs:
#   - Structured service logs (api, monitoring, portal access) → Kibana
#     http://127.0.0.1:5601 → Discover. Filebeat ships stdout of every docker
#     container into Elasticsearch; use it instead of `docker compose logs`.
#   - Local background processes write raw stdout to files under .runtime/:
#       .runtime/portal.log        — portal http.server
#       .runtime/tma.log           — telegram Vite dev server
#       .runtime/tma-storybook.log — telegram Storybook dev server
#
# The logging stack (Elasticsearch + Kibana + Filebeat, ~2 GiB RAM) is bundled
# into `up` via the root docker-compose.yml's `include:` block — searchable
# logs at http://127.0.0.1:5601 come up together with the API and portal.

up:
	@mkdir -p .runtime
	@printf "$(COLOR_CYAN)== UP: START ==$(COLOR_RESET)\n"
	@printf "$(ICON_INFO) %s\n" "[1/4] api + monitoring + logging (docker compose up -d --build; migrations run in the api container)"
	@docker compose up -d --build
	@printf "$(ICON_INFO) %s\n" "[2/4] portal static server (background)"
	@if [ -f .runtime/portal.pid ] && kill -0 $$(cat .runtime/portal.pid) 2>/dev/null; then \
		printf "  $(ICON_OK) portal already running (PID $$(cat .runtime/portal.pid))\n"; \
	elif lsof -nP -iTCP:8080 -sTCP:LISTEN >/dev/null 2>&1; then \
		holder=$$(lsof -nP -iTCP:8080 -sTCP:LISTEN -Fp 2>/dev/null | sed -n 's/^p//p' | head -1); \
		printf "  $(ICON_ERR) port 8080 busy (PID $$holder) — portal NOT started. Free the port or run 'make serve PORTAL_PORT=8081' separately.\n"; \
	else \
		nohup python3 -m http.server -d services 8080 > .runtime/portal.log 2>&1 & \
		echo $$! > .runtime/portal.pid; \
		sleep 0.5; \
		printf "  $(ICON_OK) portal started (PID $$(cat .runtime/portal.pid), log: .runtime/portal.log)\n"; \
	fi
	@printf "$(ICON_INFO) %s\n" "[3/4] telegram Vite dev server (background)"
	@if [ -f .runtime/tma.pid ] && kill -0 $$(cat .runtime/tma.pid) 2>/dev/null; then \
		printf "  $(ICON_OK) telegram dev already running (PID $$(cat .runtime/tma.pid))\n"; \
	elif lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then \
		holder=$$(lsof -nP -iTCP:5173 -sTCP:LISTEN -Fp 2>/dev/null | sed -n 's/^p//p' | head -1); \
		printf "  $(ICON_ERR) port 5173 busy (PID $$holder) — telegram dev NOT started. Free the port or run 'make tma-dev' separately.\n"; \
	elif [ ! -x services/telegram/node_modules/.bin/vite ]; then \
		printf "  $(ICON_ERR) services/telegram/node_modules missing — run 'make -C services/telegram install' once, then 'make up' again (or 'make tma-dev' to install-and-run in the foreground)\n"; \
	else \
		nohup sh -c 'cd services/telegram && exec ./node_modules/.bin/vite --port 5173' > .runtime/tma.log 2>&1 & \
		echo $$! > .runtime/tma.pid; \
		sleep 0.5; \
		printf "  $(ICON_OK) telegram dev started (PID $$(cat .runtime/tma.pid), log: .runtime/tma.log)\n"; \
	fi
	@printf "$(ICON_INFO) %s\n" "[4/4] telegram Storybook dev server (background)"
	@if [ -f .runtime/tma-storybook.pid ] && kill -0 $$(cat .runtime/tma-storybook.pid) 2>/dev/null; then \
		printf "  $(ICON_OK) telegram Storybook already running (PID $$(cat .runtime/tma-storybook.pid))\n"; \
	elif lsof -nP -iTCP:6006 -sTCP:LISTEN >/dev/null 2>&1; then \
		holder=$$(lsof -nP -iTCP:6006 -sTCP:LISTEN -Fp 2>/dev/null | sed -n 's/^p//p' | head -1); \
		printf "  $(ICON_ERR) port 6006 busy (PID $$holder) — telegram Storybook NOT started. Free the port or run 'make tma-storybook-dev' separately.\n"; \
	elif [ ! -x services/telegram/node_modules/.bin/storybook ]; then \
		printf "  $(ICON_ERR) services/telegram/node_modules missing — run 'make -C services/telegram install' once, then 'make up' again\n"; \
	else \
		nohup sh -c 'cd services/telegram && exec ./node_modules/.bin/storybook dev -p 6006 --no-open --quiet' > .runtime/tma-storybook.log 2>&1 & \
		echo $$! > .runtime/tma-storybook.pid; \
		sleep 0.5; \
		printf "  $(ICON_OK) telegram Storybook started (PID $$(cat .runtime/tma-storybook.pid), log: .runtime/tma-storybook.log)\n"; \
	fi
	@if [ "$${NO_TUNNEL:-0}" = "1" ]; then \
		printf "$(ICON_INFO) %s\n" "[+] Cloudflare tunnels skipped (NO_TUNNEL=1) — Mini App will only work in local browser"; \
	elif ! command -v cloudflared >/dev/null 2>&1; then \
		printf "$(ICON_INFO) %s\n" "[+] Cloudflare tunnels skipped — 'cloudflared' not installed. Run: brew install cloudflared"; \
	else \
		printf "$(ICON_INFO) %s\n" "[+] Cloudflare tunnels (for on-device Telegram testing)"; \
		$(MAKE) --no-print-directory tma-tunnel-up; \
	fi
	@if [ "$${OPEN:-1}" = "1" ]; then \
		printf "$(ICON_INFO) %s\n" "[+] opening web UIs in default browser (OPEN=0 to skip)"; \
		$(MAKE) --no-print-directory open-web; \
	fi
	@printf "\n"
	@if [ -f services/telegram/.env.local ] && grep -qE '^TMA_FRONTEND_URL=' services/telegram/.env.local; then \
		front_url=$$(grep -E '^TMA_FRONTEND_URL=' services/telegram/.env.local | tail -1 | cut -d= -f2-); \
		printf "  $(COLOR_GREEN)╔══════════════════════════════════════════════════════════════════════════╗$(COLOR_RESET)\n"; \
		printf "  $(COLOR_GREEN)║$(COLOR_RESET)  $(COLOR_CYAN)📱 Open in Telegram — paste this URL into @BotFather → Menu Button$(COLOR_RESET)  $(COLOR_GREEN)║$(COLOR_RESET)\n"; \
		printf "  $(COLOR_GREEN)╠══════════════════════════════════════════════════════════════════════════╣$(COLOR_RESET)\n"; \
		printf "  $(COLOR_GREEN)║$(COLOR_RESET)  %-72s$(COLOR_GREEN)║$(COLOR_RESET)\n" "$$front_url"; \
		printf "  $(COLOR_GREEN)╚══════════════════════════════════════════════════════════════════════════╝$(COLOR_RESET)\n\n"; \
	fi
	@printf "  $(COLOR_GREEN)Stack is up.$(COLOR_RESET) Local URLs:\n\n"
	@printf "    $(COLOR_CYAN)API$(COLOR_RESET)        http://127.0.0.1:8000        (Swagger /docs · ReDoc /redoc)\n"
	@printf "    $(COLOR_CYAN)Portal$(COLOR_RESET)     http://127.0.0.1:8080/portal/\n"
	@printf "    $(COLOR_CYAN)Telegram$(COLOR_RESET)   http://127.0.0.1:5173         (TMA Vite dev)\n"
	@printf "    $(COLOR_CYAN)Storybook$(COLOR_RESET)  http://127.0.0.1:6006         (TMA component gallery)\n"
	@printf "    $(COLOR_CYAN)Kibana$(COLOR_RESET)     http://127.0.0.1:5601        (logs · first load 30-60s)\n"
	@printf "    $(COLOR_CYAN)Grafana$(COLOR_RESET)    http://127.0.0.1:3010        (creds in .env: GRAFANA_ADMIN_USER/PASSWORD)\n"
	@printf "    $(COLOR_CYAN)Prometheus$(COLOR_RESET) http://127.0.0.1:9090\n"
	@printf "    $(COLOR_CYAN)Blackbox$(COLOR_RESET)   http://127.0.0.1:9115\n\n"
	@printf "  Next:  $(COLOR_CYAN)make status$(COLOR_RESET) shows state  ·  $(COLOR_CYAN)make down$(COLOR_RESET) stops everything\n"
	@printf "$(COLOR_GREEN)== UP: SUCCESS ==$(COLOR_RESET)\n"

down:
	@printf "$(COLOR_CYAN)== DOWN: START ==$(COLOR_RESET)\n"
	@printf "$(ICON_INFO) %s\n" "[1/4] portal static server"
	@if [ -f .runtime/portal.pid ]; then \
		pid=$$(cat .runtime/portal.pid); \
		if kill -0 $$pid 2>/dev/null; then \
			kill $$pid 2>/dev/null && printf "  $(ICON_OK) portal stopped (PID $$pid)\n"; \
		else \
			printf "  $(ICON_INFO) portal PID file stale — nothing to stop\n"; \
		fi; \
		rm -f .runtime/portal.pid; \
	else \
		printf "  $(ICON_INFO) portal not running\n"; \
	fi
	@printf "$(ICON_INFO) %s\n" "[2/4] telegram Vite dev server"
	@if [ -f .runtime/tma.pid ]; then \
		pid=$$(cat .runtime/tma.pid); \
		if kill -0 $$pid 2>/dev/null; then \
			pkill -TERM -P $$pid 2>/dev/null || true; \
			kill $$pid 2>/dev/null; \
			printf "  $(ICON_OK) telegram dev stopped (PID $$pid)\n"; \
		else \
			printf "  $(ICON_INFO) telegram dev PID file stale — nothing to stop\n"; \
		fi; \
		rm -f .runtime/tma.pid; \
	else \
		printf "  $(ICON_INFO) telegram dev not running\n"; \
	fi
	@printf "$(ICON_INFO) %s\n" "[3/4] telegram Storybook dev server"
	@if [ -f .runtime/tma-storybook.pid ]; then \
		pid=$$(cat .runtime/tma-storybook.pid); \
		if kill -0 $$pid 2>/dev/null; then \
			pkill -TERM -P $$pid 2>/dev/null || true; \
			kill $$pid 2>/dev/null; \
			printf "  $(ICON_OK) telegram Storybook stopped (PID $$pid)\n"; \
		else \
			printf "  $(ICON_INFO) telegram Storybook PID file stale — nothing to stop\n"; \
		fi; \
		rm -f .runtime/tma-storybook.pid; \
	else \
		printf "  $(ICON_INFO) telegram Storybook not running\n"; \
	fi
	@printf "$(ICON_INFO) %s\n" "[+] Cloudflare quick tunnels (always cleaned — strips stale VITE_API_BASE_URL)"
	@services/telegram/scripts/tunnels-down.sh
	@printf "$(ICON_INFO) %s\n" "[4/4] api + monitoring (docker compose down)"
	@docker compose down
	@printf "$(COLOR_GREEN)== DOWN: SUCCESS ==$(COLOR_RESET)\n"

down-volumes:
	@printf "$(COLOR_CYAN)== DOWN-VOLUMES: START ==$(COLOR_RESET)\n"
	@printf "$(ICON_INFO) %s\n" "[1/4] portal static server"
	@if [ -f .runtime/portal.pid ]; then \
		pid=$$(cat .runtime/portal.pid); \
		kill $$pid 2>/dev/null && printf "  $(ICON_OK) portal stopped (PID $$pid)\n" || printf "  $(ICON_INFO) nothing to stop\n"; \
		rm -f .runtime/portal.pid; \
	fi
	@printf "$(ICON_INFO) %s\n" "[2/4] telegram Vite dev server"
	@if [ -f .runtime/tma.pid ]; then \
		pid=$$(cat .runtime/tma.pid); \
		pkill -TERM -P $$pid 2>/dev/null || true; \
		kill $$pid 2>/dev/null && printf "  $(ICON_OK) telegram dev stopped (PID $$pid)\n" || printf "  $(ICON_INFO) nothing to stop\n"; \
		rm -f .runtime/tma.pid; \
	fi
	@printf "$(ICON_INFO) %s\n" "[3/4] telegram Storybook dev server"
	@if [ -f .runtime/tma-storybook.pid ]; then \
		pid=$$(cat .runtime/tma-storybook.pid); \
		pkill -TERM -P $$pid 2>/dev/null || true; \
		kill $$pid 2>/dev/null && printf "  $(ICON_OK) telegram Storybook stopped (PID $$pid)\n" || printf "  $(ICON_INFO) nothing to stop\n"; \
		rm -f .runtime/tma-storybook.pid; \
	fi
	@printf "$(ICON_INFO) %s\n" "[4/4] api + monitoring — WIPING volumes (prometheus/grafana data will be lost)"
	@docker compose down -v
	@printf "$(COLOR_GREEN)== DOWN-VOLUMES: SUCCESS ==$(COLOR_RESET)\n"

status:
	@printf "$(COLOR_CYAN)== STATUS ==$(COLOR_RESET)\n"
	@printf "$(ICON_INFO) %s\n" "docker services (api + monitoring)"
	@docker compose ps 2>/dev/null | sed 's/^/    /' || printf "    $(ICON_ERR) docker daemon not reachable\n"
	@printf "\n$(ICON_INFO) %s\n" "portal static server"
	@if [ -f .runtime/portal.pid ] && kill -0 $$(cat .runtime/portal.pid) 2>/dev/null; then \
		printf "    $(ICON_OK) running (PID $$(cat .runtime/portal.pid), log: .runtime/portal.log)\n"; \
	elif lsof -nP -iTCP:8080 -sTCP:LISTEN >/dev/null 2>&1; then \
		holder=$$(lsof -nP -iTCP:8080 -sTCP:LISTEN -Fp 2>/dev/null | sed -n 's/^p//p' | head -1); \
		printf "    $(ICON_INFO) something else is on :8080 (PID $$holder) — not managed by 'make up'\n"; \
	else \
		printf "    $(ICON_INFO) down\n"; \
	fi
	@printf "\n$(ICON_INFO) %s\n" "telegram Vite dev server"
	@if [ -f .runtime/tma.pid ] && kill -0 $$(cat .runtime/tma.pid) 2>/dev/null; then \
		printf "    $(ICON_OK) running (PID $$(cat .runtime/tma.pid), log: .runtime/tma.log)\n"; \
	elif lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then \
		holder=$$(lsof -nP -iTCP:5173 -sTCP:LISTEN -Fp 2>/dev/null | sed -n 's/^p//p' | head -1); \
		printf "    $(ICON_INFO) something else is on :5173 (PID $$holder) — not managed by 'make up'\n"; \
	else \
		printf "    $(ICON_INFO) down\n"; \
	fi
	@printf "\n$(ICON_INFO) %s\n" "telegram Storybook dev server"
	@if [ -f .runtime/tma-storybook.pid ] && kill -0 $$(cat .runtime/tma-storybook.pid) 2>/dev/null; then \
		printf "    $(ICON_OK) running (PID $$(cat .runtime/tma-storybook.pid), log: .runtime/tma-storybook.log)\n"; \
	elif lsof -nP -iTCP:6006 -sTCP:LISTEN >/dev/null 2>&1; then \
		holder=$$(lsof -nP -iTCP:6006 -sTCP:LISTEN -Fp 2>/dev/null | sed -n 's/^p//p' | head -1); \
		printf "    $(ICON_INFO) something else is on :6006 (PID $$holder) — not managed by 'make up'\n"; \
	else \
		printf "    $(ICON_INFO) down\n"; \
	fi
	@printf "\n$(ICON_INFO) %s\n" "endpoints (when up)"
	@printf "    API        http://127.0.0.1:8000\n"
	@printf "    Portal     http://127.0.0.1:8080/portal/\n"
	@printf "    Telegram   http://127.0.0.1:5173\n"
	@printf "    Storybook  http://127.0.0.1:6006\n"
	@printf "    Kibana     http://127.0.0.1:5601        (logs UI — Discover)\n"
	@printf "    Grafana    http://127.0.0.1:3010\n"
	@printf "    Prometheus http://127.0.0.1:9090\n"
	@printf "    Blackbox   http://127.0.0.1:9115\n"

# Backwards-compat aliases. The logging stack is now part of `make up` via the
# root docker-compose.yml `include:` block; these targets remain so muscle memory
# and older docs keep working. New code should call `make up` / `make down`.
logging-up: up
logging-down: down

# `make logs` is retired — Filebeat ships every container's stdout into
# Elasticsearch and Kibana (`make up` brings them up together with the api).
# Kept as an explicit .PHONY stub for two reasons: (a) the repo-root `logs/`
# directory would otherwise shadow the target and make `make logs` silently
# no-op; (b) muscle memory gets redirected to the actual log-viewing surface
# instead of a mystery success.
logs:
	@printf "$(ICON_INFO) %s\n" "make logs is retired — service logs live in Kibana now."
	@printf "    %s\n" "Structured logs   → http://127.0.0.1:5601 (Discover, filter by kubernetes.container.name / service)"
	@printf "    %s\n" "Background stdout → .runtime/portal.log · .runtime/tma.log · .runtime/tma-storybook.log  (tail -f)"
	@printf "    %s\n" "Raw docker stdout → docker compose logs -f --tail=100        (rarely needed; prefer Kibana)"

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
	@printf "$(ICON_INFO) %s\n" "[1/4] lint-check"
	@$(MAKE) lint-check
	@printf "$(ICON_INFO) %s\n" "[2/4] type-check"
	@$(MAKE) type-check
	@printf "$(ICON_INFO) %s\n" "[3/4] openapi-check"
	@$(MAKE) -C services/api openapi-check
	@printf "$(ICON_INFO) %s\n" "[4/4] test"
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

# verify — full pre-push composite: cross-cutting code quality first, then
# every service in declared order. Same composition as ci.yml matrix lanes.
verify:
	@printf "$(COLOR_CYAN)== VERIFY: START ==$(COLOR_RESET)\n"
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
	@printf "$(COLOR_GREEN)== VERIFY: SUCCESS ==$(COLOR_RESET)\n"

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
run migrate openapi-check openapi-regen api-mock build deps-audit:
	@$(MAKE) -C services/api $@

test:
	@$(MAKE) -C services/api test

test-one:
	@$(MAKE) -C services/api test-one path=$(path)

docs-fix docs-check docs-html-check docs-design-check docs-a11y-check docs-feedback-check docs-spec-check docs-nav-check docs-storybook-check catalog-render catalog-render-check serve open visual-test visual-test-update api-check:
	@$(MAKE) -C services/portal $@

# TMA delegates — forward the common services/telegram verbs from the repo
# root so `make tma-dev` works the same as `make -C services/telegram dev`.
# `make up` starts Vite + Storybook in the background; `make tma-dev` and
# `make tma-storybook-dev` are the foreground counterparts for when you want
# to see the dev-server output live in your terminal.
tma-dev tma-typecheck tma-lint tma-test tma-build tma-verify:
	@$(MAKE) -C services/telegram $(subst tma-,,$@)

tma-storybook-dev:
	@$(MAKE) -C services/telegram storybook

# TMA Storybook — built into services/telegram/storybook-static/, served by
# `make serve` at http://localhost:8080/telegram/storybook-static/iframe.html
# because portal's dev server exposes services/ as its web root. Kit-showcase
# pages iframe those URLs (see .storybook-embed primitive).
.PHONY: tma-storybook tma-storybook-check
tma-storybook:
	@$(MAKE) -C services/telegram storybook-build

# Sanity check for kit-page authors: prints where storybook-static/ lives
# and whether it was built. Non-zero exit + hint if missing, so iframe 404s
# in the pilot page point at the actual root cause.
tma-storybook-check:
	@if [ -d services/telegram/storybook-static ]; then \
		printf "$(ICON_OK) storybook-static/ present · served at http://localhost:8080/telegram/storybook-static/\n"; \
	else \
		printf "$(ICON_ERR) storybook-static/ missing — run 'make tma-storybook' first\n"; exit 1; \
	fi

# Cloudflare quick tunnels for the TMA dev loop — publish the local API and
# Vite dev server over HTTPS so Telegram can load the Mini App on device.
# tma-tunnel-up assumes `make up` already brought api + Vite up; it writes
# VITE_API_BASE_URL into services/telegram/.env.local, restarts Vite so the
# env takes effect, and copies the frontend URL to the clipboard for pasting
# into @BotFather → Menu Button.
tma-tunnel-up:
	@services/telegram/scripts/tunnels-up.sh

tma-tunnel-down:
	@services/telegram/scripts/tunnels-down.sh

# ──────────────────────────────────────────────
# Dev-time test data
# ──────────────────────────────────────────────
# One-shot regen of the plain-browser dev loop:
#   1) fresh VITE_DEV_INIT_DATA in services/telegram/.env.local
#   2) reset the 10 known seed conspectuses (drop → reinsert) so their
#      next_review_at land at the intended offsets from NOW — otherwise a
#      previous swipe/grade in the Mini App would have pushed the SM-2
#      schedule forward, and Today would render «All caught up» even
#      though the DB has 10 rows.
#   3) seed 162 review-logs (12-day streak + 60-day heatmap).
# All three use the shared dev user id (env TMA_DEV_TELEGRAM_USER_ID,
# default 42) so the initData resolves to the same owner the seed data
# belongs to. Pass `KEEP=1` to skip the reset (incremental add, e.g. after
# hand-crafting extra rows the seeder shouldn't wipe).
#
# Reads TELEGRAM_BOT_TOKEN from .env; falls back to shell env.
gen-test-data:
	@printf "$(COLOR_CYAN)== GEN-TEST-DATA: START ==$(COLOR_RESET)\n"
	@set -e; \
	if [ -f .env ]; then \
		token="$$(grep '^TELEGRAM_BOT_TOKEN=' .env | tail -1 | cut -d= -f2- | tr -d '\r' | tr -d '"' | tr -d "'")"; \
	fi; \
	token="$${token:-$$TELEGRAM_BOT_TOKEN}"; \
	if [ -z "$$token" ]; then \
		printf "$(ICON_ERR) TELEGRAM_BOT_TOKEN not found in .env or shell — set it and retry\n" >&2; \
		exit 1; \
	fi; \
	user_id="$${TMA_DEV_TELEGRAM_USER_ID:-42}"; \
	printf "$(ICON_INFO) %s\n" "[1/2] sign fresh VITE_DEV_INIT_DATA for user_id=$$user_id"; \
	line="$$(TMA_DEV_TELEGRAM_USER_ID=$$user_id $(PYTHON) tools/dev/sign_init_data.py --bot-token $$token --format env)"; \
	env_file=services/telegram/.env.local; \
	touch "$$env_file"; \
	tmp="$$env_file.tmp"; \
	grep -vE '^VITE_DEV_INIT_DATA=' "$$env_file" > "$$tmp" || true; \
	printf '%s\n' "$$line" >> "$$tmp"; \
	mv "$$tmp" "$$env_file"; \
	printf "  $(ICON_OK) $$env_file updated\n"; \
	printf "$(ICON_INFO) %s\n" "[2/2] seed conspectuses + review logs"; \
	reset_flag="--reset"; \
	if [ "$${KEEP:-0}" = "1" ]; then \
		reset_flag=""; \
		printf "  $(ICON_INFO) KEEP=1 — skipping --reset (incremental seed, existing rows preserved)\n"; \
	else \
		printf "  $(ICON_INFO) resetting the 10 known seed UUIDs so next_review_at lands fresh\n"; \
	fi; \
	TMA_DEV_TELEGRAM_USER_ID=$$user_id $(PYTHON) tools/dev/seed_dev_data.py --telegram-user-id $$user_id $$reset_flag
	@printf "$(COLOR_GREEN)== GEN-TEST-DATA: SUCCESS ==$(COLOR_RESET)\n"
	@printf "  Refresh the Mini App at http://127.0.0.1:5173 — Today should show 10 due cards.\n"

# open-web — fan out every stack UI into the default browser. Called from
# `make up` unless OPEN=0. macOS only (`open` binary); silently skipped on
# other platforms so this stays safe in CI.
open-web:
	@if ! command -v open >/dev/null 2>&1; then \
		printf "  $(ICON_INFO) `open` not found — skipping (macOS only)\n"; \
		exit 0; \
	fi
	@open \
		http://127.0.0.1:8000/docs \
		http://127.0.0.1:8080/portal/ \
		http://127.0.0.1:5173 \
		http://127.0.0.1:6006 \
		http://127.0.0.1:5601 \
		http://127.0.0.1:3010 \
# 		http://127.0.0.1:9090 \
# 		http://127.0.0.1:9115 \
		2>/dev/null || true
	@printf "  $(ICON_OK) opened 8 tabs (API docs · Portal · TMA · Storybook · Kibana · Grafana · Prometheus · Blackbox)\n"

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
