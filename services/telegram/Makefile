# services/telegram/Makefile — Telegram Mini App (React + TS + Vite).
#
# Node-side counterpart to services/api/Makefile. Cross-cutting Python
# gates (ruff / mypy) don't touch this tree; the Node quality gates
# (typecheck / lint / build) live here and are invoked by `verify`.
#
# Common usage:
#   make -C services/telegram install     # npm ci (or install on first run)
#   make -C services/telegram dev         # vite dev server on :5173
#   make -C services/telegram typecheck   # tsc --noEmit
#   make -C services/telegram lint        # eslint .
#   make -C services/telegram build       # vite build → dist/
#   make -C services/telegram verify      # typecheck + lint + build (the CI gate)

REPO_ROOT := $(abspath ..)/..

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

NPM ?= npm
VITE_PORT ?= 5173
SB_PORT ?= 6006

.PHONY: help install install-if-missing dev build preview typecheck lint lint-fix test gen-api verify clean storybook storybook-build test-visual test-visual-update test-a11y install-browsers

help:
	@echo "services/telegram — make targets"
	@echo ""
	@echo "  make install       npm ci (deterministic install from package-lock.json)"
	@echo "  make dev           Vite dev server on http://localhost:$(VITE_PORT)"
	@echo "  make build         Vite production build → dist/"
	@echo "  make preview       Serve the built bundle locally"
	@echo "  make typecheck     tsc --noEmit"
	@echo "  make lint          eslint ."
	@echo "  make lint-fix      eslint . --fix"
	@echo "  make test          vitest run (unit)"
	@echo "  make gen-api       Regenerate src/shared/api/schema.d.ts from services/portal/public/reference/api/openapi.json"
	@echo "  make storybook            Storybook dev server on http://localhost:$(SB_PORT)"
	@echo "  make storybook-build      Static Storybook → storybook-static/"
	@echo "  make test-visual          Playwright visual regression (fails on drift)"
	@echo "  make test-visual-update   Refresh baseline screenshots after intentional visual change"
	@echo "  make test-a11y            axe-core WCAG gate over all Storybook stories"
	@echo "  make install-browsers     Install Playwright browsers (chromium only)"
	@echo "  make verify        typecheck + lint + test + build (the CI gate)"
	@echo "  make clean         rm -rf node_modules dist .vite"

install:
	@printf "$(ICON_STEP) %s\n" "Installing Node dependencies (npm ci)…"
	@if [ -f package-lock.json ]; then \
		$(NPM) ci; \
	else \
		printf "  $(ICON_INFO) no lockfile — running 'npm install' instead\n"; \
		$(NPM) install; \
	fi
	@printf "$(ICON_OK) %s\n" "Dependencies installed"

install-if-missing:
	@if [ ! -d node_modules ]; then \
		printf "$(ICON_INFO) %s\n" "node_modules missing — installing"; \
		$(MAKE) install; \
	fi

dev: install-if-missing
	@printf "$(ICON_STEP) %s\n" "Starting Vite dev server on http://localhost:$(VITE_PORT)…"
	@$(NPM) run dev -- --port $(VITE_PORT)

build: install-if-missing
	@printf "$(ICON_STEP) %s\n" "Building production bundle…"
	@$(NPM) run build
	@printf "$(ICON_OK) %s\n" "Bundle written to dist/"

preview: install-if-missing
	@$(NPM) run preview -- --port $(VITE_PORT)

typecheck: install-if-missing
	@printf "$(ICON_STEP) %s\n" "Type-checking (tsc --noEmit)…"
	@$(NPM) run typecheck
	@printf "$(ICON_OK) %s\n" "Type check passed"

lint: install-if-missing
	@printf "$(ICON_STEP) %s\n" "Linting (eslint .)…"
	@$(NPM) run lint
	@printf "$(ICON_OK) %s\n" "Lint passed"

lint-fix: install-if-missing
	@$(NPM) run lint -- --fix

test: install-if-missing
	@printf "$(ICON_STEP) %s\n" "Running unit tests (vitest run)…"
	@$(NPM) run test
	@printf "$(ICON_OK) %s\n" "Tests passed"

gen-api: install-if-missing
	@printf "$(ICON_STEP) %s\n" "Regenerating OpenAPI types…"
	@$(NPM) run gen-api
	@printf "$(ICON_OK) %s\n" "src/shared/api/schema.d.ts refreshed"

storybook: install-if-missing
	@printf "$(ICON_STEP) %s\n" "Starting Storybook on http://localhost:$(SB_PORT)…"
	@$(NPM) run storybook -- -p $(SB_PORT)

storybook-build: install-if-missing
	@printf "$(ICON_STEP) %s\n" "Building static Storybook…"
	@$(NPM) run build-storybook
	@printf "$(ICON_OK) %s\n" "Static bundle written to storybook-static/"

install-browsers: install-if-missing
	@printf "$(ICON_STEP) %s\n" "Installing Playwright Chromium…"
	@npx --yes playwright install chromium
	@printf "$(ICON_OK) %s\n" "Playwright ready"

# `test-visual*` targets rebuild storybook-static only when missing, so
# incremental runs are fast. Delete storybook-static/ if you want a fresh build.
test-visual: install-if-missing
	@if [ ! -d storybook-static ]; then \
		printf "$(ICON_INFO) %s\n" "storybook-static missing — building"; \
		$(NPM) run build-storybook; \
	fi
	@printf "$(ICON_STEP) %s\n" "Running visual regression (playwright test)…"
	@$(NPM) run test:visual
	@printf "$(ICON_OK) %s\n" "No visual drift"

test-a11y: install-if-missing
	@if [ ! -d storybook-static ]; then \
		printf "$(ICON_INFO) %s\n" "storybook-static missing — building"; \
		$(NPM) run build-storybook; \
	fi
	@printf "$(ICON_STEP) %s\n" "Running accessibility gate (axe-core)…"
	@$(NPM) run test:a11y
	@printf "$(ICON_OK) %s\n" "No WCAG violations"

test-visual-update: install-if-missing
	@if [ ! -d storybook-static ]; then \
		printf "$(ICON_INFO) %s\n" "storybook-static missing — building"; \
		$(NPM) run build-storybook; \
	fi
	@printf "$(ICON_STEP) %s\n" "Refreshing baseline screenshots…"
	@$(NPM) run test:visual:update
	@printf "$(ICON_OK) %s\n" "Baselines updated — review + commit tests/visual/__screenshots__/"

verify: install-if-missing
	@printf "$(COLOR_CYAN)== TELEGRAM VERIFY: START ==$(COLOR_RESET)\n"
	@printf "$(ICON_INFO) %s\n" "[1/4] typecheck"
	@$(MAKE) typecheck
	@printf "$(ICON_INFO) %s\n" "[2/4] lint"
	@$(MAKE) lint
	@printf "$(ICON_INFO) %s\n" "[3/4] test"
	@$(MAKE) test
	@printf "$(ICON_INFO) %s\n" "[4/4] build"
	@$(MAKE) build
	@printf "$(COLOR_GREEN)== TELEGRAM VERIFY: SUCCESS ==$(COLOR_RESET)\n"

clean:
	@printf "$(ICON_STEP) %s\n" "Removing node_modules dist .vite…"
	@rm -rf node_modules dist .vite
	@printf "$(ICON_OK) %s\n" "Clean"
