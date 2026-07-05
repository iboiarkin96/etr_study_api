# services/portal/Makefile — Documentation portal (ADR 0028 Phase 2).
#
# Real implementations of docs-pipeline targets. All scripts live under
# tools/docs/; this Makefile just ties them together.
#
# Common usage:
#   make -C services/portal docs-fix          # regenerate docs artefacts
#   make -C services/portal docs-check        # drift gate (CI uses this)
#   make -C services/portal docs-a11y-check   # WCAG baseline
#   make -C services/portal verify            # docs-check + docs-a11y-check
#
# The drift gate compares git diff HEAD before and after docs-fix; identical →
# committed artefacts match the pipeline (no drift). The pdoc tree under
# services/portal/internal/services/api/code-reference/ is restored from HEAD
# after docs-fix because pdoc output varies across OS / Python / file order.

REPO_ROOT := $(abspath ..)/..
PYTHON    := $(REPO_ROOT)/.venv/bin/python

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

.PHONY: help verify verify-local docs-fix docs-check docs-html-check docs-design-check docs-a11y-check docs-feedback-check docs-spec-check docs-nav-check catalog-render catalog-render-check serve open visual-test visual-test-update api-check

PORTAL_PORT ?= 8080
PORTAL_URL  := http://127.0.0.1:$(PORTAL_PORT)/portal/

help:
	@echo "services/portal — make targets"
	@echo ""
	@echo "  make docs-fix              Regenerate docs (UML + markers + HTML repair + pdoc + Pagefind)"
	@echo "  make docs-check            Drift gate — fails if docs-fix would change anything"
	@echo "  make docs-html-check       HTML structure validation"
	@echo "  make docs-design-check     Design baseline (cards, skeleton)"
	@echo "  make docs-a11y-check       WCAG baseline accessibility"
	@echo "  make docs-feedback-check   Page-level feedback smoke"
	@echo "  make docs-spec-check       Spec consistency + lint"
	@echo "  make docs-nav-check        Sidebar coverage — fails on pages not in nav-tree-internal.json"
	@echo "  make catalog-render        Regenerate per-service catalog from catalog-info.yaml"
	@echo "  make catalog-render-check  Catalog drift gate"
	@echo "  make verify                docs-check + docs-a11y-check (the CI gate)"
	@echo "  make verify-local          verify + visual-test (full local gate before push)"
	@echo ""
	@echo "  make open  [PORTAL_PORT=N] Start static server AND open the portal in the browser (one-shot)"
	@echo "  make serve [PORTAL_PORT=N] Just start the server (headless / curl / non-default browser)"
	@echo ""
	@echo "  make visual-test           Pixel-diff UI Kit templates vs tests/visual/baselines/ (BL-047)"
	@echo "  make visual-test-update    Refresh those baselines after an intentional UI change"
	@echo "                             VISUAL_TEST_WORKERS=N to tune Chromium parallelism (default 4)"
	@echo ""
	@echo "  OpenAPI canon validation"
	@echo "    make api-check                Validate ALL fragments across ALL canons"
	@echo "    make api-check user           Validate one resource (e.g. user, course) across every canon that has it"

# ─────────────────────────────────────────────
# Local preview — serve the portal + open in browser
# ─────────────────────────────────────────────
# The portal HTML lives under services/portal/ but references sibling assets via
# `../frontend/portal/assets_v2/...`. Server root must be services/ (one level
# above this Makefile) so those `..` refs resolve inside scope — same geometry
# the GitHub Pages workflow stages in pages.yml. Browser entry: /portal/.
serve:
	@if lsof -nP -iTCP:$(PORTAL_PORT) -sTCP:LISTEN >/dev/null 2>&1; then \
		holder=$$(lsof -nP -iTCP:$(PORTAL_PORT) -sTCP:LISTEN -Fp 2>/dev/null | sed -n 's/^p//p' | head -1); \
		printf "$(ICON_ERR) %s\n" "Port $(PORTAL_PORT) is busy (PID $$holder)."; \
		printf "$(ICON_INFO) %s\n" "Free it (kill $$holder) or override: make serve PORTAL_PORT=8081"; \
		exit 1; \
	fi
	@printf "$(ICON_STEP) %s\n" "Serving portal at $(PORTAL_URL) (Ctrl+C to stop)"
	@cd $(REPO_ROOT) && python3 -m http.server -d services $(PORTAL_PORT)

open:
	@if lsof -nP -iTCP:$(PORTAL_PORT) -sTCP:LISTEN >/dev/null 2>&1; then \
		holder=$$(lsof -nP -iTCP:$(PORTAL_PORT) -sTCP:LISTEN -Fp 2>/dev/null | sed -n 's/^p//p' | head -1); \
		printf "$(ICON_INFO) %s\n" "Port $(PORTAL_PORT) is already serving (PID $$holder) — skipping start, opening browser only."; \
		open $(PORTAL_URL) 2>/dev/null || xdg-open $(PORTAL_URL) 2>/dev/null || \
			printf "$(ICON_ERR) %s %s\n" "Couldn't auto-open browser; visit:" "$(PORTAL_URL)"; \
		exit 0; \
	fi
	@printf "$(ICON_STEP) %s\n" "Starting portal at $(PORTAL_URL) (Ctrl+C to stop)"
	@cd $(REPO_ROOT) && { \
		( sleep 0.6 && ( open $(PORTAL_URL) 2>/dev/null || xdg-open $(PORTAL_URL) 2>/dev/null || \
			printf "$(ICON_ERR) %s %s\n" "Couldn't auto-open browser; visit:" "$(PORTAL_URL)" ) ) & \
		python3 -m http.server -d services $(PORTAL_PORT); \
	}

# ─────────────────────────────────────────────
# Visual regression (BL-047) — UI Kit templates pixel-diff
# ─────────────────────────────────────────────
# Driver lives at tools/visual_regression/runner.py; corpus at
# tests/visual/pages.json (10 templates × 3 frames = 30 PNG baselines).
# Refresh recipe: tests/visual/README.md.
visual-test:
	@if [ ! -d "$(REPO_ROOT)/.venv" ]; then \
		printf "$(ICON_ERR) %s\n" ".venv not found. Run 'make venv && make install' from repo root."; exit 1; \
	fi
	@printf "$(COLOR_CYAN)== VISUAL-TEST: START ==$(COLOR_RESET)\n"
	@cd $(REPO_ROOT) && $(PYTHON) -m tools.visual_regression --mode check
	@printf "$(COLOR_GREEN)== VISUAL-TEST: SUCCESS ==$(COLOR_RESET)\n"

visual-test-update:
	@if [ ! -d "$(REPO_ROOT)/.venv" ]; then \
		printf "$(ICON_ERR) %s\n" ".venv not found. Run 'make venv && make install' from repo root."; exit 1; \
	fi
	@printf "$(COLOR_CYAN)== VISUAL-TEST-UPDATE: START ==$(COLOR_RESET)\n"
	@cd $(REPO_ROOT) && $(PYTHON) -m tools.visual_regression --mode update
	@printf "$(COLOR_GREEN)== VISUAL-TEST-UPDATE: SUCCESS ==$(COLOR_RESET)\n"

# ─────────────────────────────────────────────
# Docs pipeline
# ─────────────────────────────────────────────
docs-fix:
	@if [ ! -d "$(REPO_ROOT)/.venv" ]; then \
		printf "$(ICON_ERR) %s\n" ".venv not found. Run 'make venv && make install' from repo root."; exit 1; \
	fi
	@if [ ! -f "$(REPO_ROOT)/tools/docs/regenerate_docs.py" ]; then \
		printf "$(ICON_ERR) %s\n" "tools/docs/regenerate_docs.py not found."; exit 1; \
	fi
	@printf "$(COLOR_CYAN)== DOCS-FIX: START ==$(COLOR_RESET)\n"
	@printf "$(ICON_INFO) %s\n" "[1/10] regenerate UML diagrams"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/regenerate_docs.py
	@printf "$(ICON_INFO) %s\n" "[2/10] sync marker-based documentation"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/sync_docs.py
	@printf "$(ICON_INFO) %s\n" "[3/10] render docs markdown to html companions"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/render_docs_html.py
	@printf "$(ICON_INFO) %s\n" "[4/10] repair docs html structure"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/repair_docs_html.py
	@printf "$(ICON_INFO) %s\n" "[5/10] normalize docs html template"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/format_docs_html.py
	@printf "$(ICON_INFO) %s\n" "[6/10] render service catalog (YAML → HTML)"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/render_service_descriptors.py
	@printf "$(ICON_INFO) %s\n" "[7/10] ensure docs body maintainers"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/ensure_docs_maintainers.py
	@printf "$(ICON_INFO) %s\n" "[8/10] Python API reference (pdoc)"
	@rm -rf $(REPO_ROOT)/services/portal/internal/services/api/code-reference
	@cd $(REPO_ROOT) && PYTHONHASHSEED=0 PYTHONPATH=services/api $(PYTHON) -m pdoc app -o services/portal/internal/services/api/code-reference
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/normalize_pdoc_output.py
	@printf "$(ICON_INFO) %s\n" "[9/10] rebuild internal catalog (quadrant / service / topic / recent)"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/build_catalog.py
	@printf "$(ICON_INFO) %s\n" "[10/10] build pagefind index (ADR-0033)"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/build_pagefind_index.py
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/check_pagefind_visibility.py
	@printf "$(COLOR_GREEN)== DOCS-FIX: SUCCESS ==$(COLOR_RESET)\n"

# ─────────────────────────────────────────────
# Granular docs checks
# ─────────────────────────────────────────────
docs-html-check:
	@printf "$(COLOR_CYAN)== DOCS-HTML-CHECK: START ==$(COLOR_RESET)\n"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/validate_docs_html.py
	@printf "$(COLOR_GREEN)== DOCS-HTML-CHECK: SUCCESS ==$(COLOR_RESET)\n"

docs-design-check:
	@printf "$(COLOR_CYAN)== DOCS-DESIGN-CHECK: START ==$(COLOR_RESET)\n"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/validate_docs_design.py
	@printf "$(COLOR_GREEN)== DOCS-DESIGN-CHECK: SUCCESS ==$(COLOR_RESET)\n"

docs-a11y-check:
	@printf "$(COLOR_CYAN)== DOCS-A11Y-CHECK: START ==$(COLOR_RESET)\n"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/validate_docs_a11y.py
	@printf "$(COLOR_GREEN)== DOCS-A11Y-CHECK: SUCCESS ==$(COLOR_RESET)\n"

docs-feedback-check:
	@printf "$(COLOR_CYAN)== DOCS-FEEDBACK-CHECK: START ==$(COLOR_RESET)\n"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/validate_docs_feedback.py
	@printf "$(COLOR_GREEN)== DOCS-FEEDBACK-CHECK: SUCCESS ==$(COLOR_RESET)\n"

docs-spec-check:
	@printf "$(COLOR_CYAN)== DOCS-SPEC-CHECK: START ==$(COLOR_RESET)\n"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/spec_lint.py
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/spec_consistency.py
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/front_spec_lint.py
	@printf "$(COLOR_GREEN)== DOCS-SPEC-CHECK: SUCCESS ==$(COLOR_RESET)\n"

docs-nav-check:
	@printf "$(COLOR_CYAN)== DOCS-NAV-CHECK: START ==$(COLOR_RESET)\n"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/check_sidebar_coverage.py
	@printf "$(COLOR_GREEN)== DOCS-NAV-CHECK: SUCCESS ==$(COLOR_RESET)\n"

# ─────────────────────────────────────────────
# Drift gate (used by CI + `make verify`)
# ─────────────────────────────────────────────
docs-check:
	@$(MAKE) docs-html-check
	@$(MAKE) docs-design-check
	@$(MAKE) docs-feedback-check
	@$(MAKE) docs-spec-check
	@$(MAKE) docs-nav-check
	@cd $(REPO_ROOT) && tmp_before=$$(mktemp); tmp_after=$$(mktemp); \
	git diff HEAD > "$$tmp_before"; \
	$(MAKE) -C services/portal docs-fix; \
	git checkout HEAD -- services/portal/internal/services/api/code-reference 2>/dev/null || true; \
	git diff HEAD > "$$tmp_after"; \
	if cmp -s "$$tmp_before" "$$tmp_after"; then \
		printf "$(ICON_OK) %s\n" "Docs check passed (no drift)"; \
		rm -f "$$tmp_before" "$$tmp_after"; \
	else \
		printf "$(ICON_ERR) %s\n" "Docs drift detected. Run 'make docs-fix' and commit updated files."; \
		printf "$(ICON_INFO) %s\n" "Files differing from HEAD after docs-fix:"; \
		git status --short | sed 's/^/    /'; \
		printf "$(ICON_INFO) %s\n" "Per-file diff size:"; \
		git diff HEAD --stat | sed 's/^/    /'; \
		printf "$(ICON_INFO) %s\n" "Full diff (truncated to 200 lines):"; \
		git diff HEAD | head -200 | sed 's/^/    /'; \
		rm -f "$$tmp_before" "$$tmp_after"; \
		exit 1; \
	fi

# ─────────────────────────────────────────────
# Service catalog (YAML → HTML)
# ─────────────────────────────────────────────
catalog-render:
	@printf "$(ICON_STEP) %s\n" "Rendering service descriptors…"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/render_service_descriptors.py
	@printf "$(ICON_OK) %s\n" "Service descriptors rendered"

catalog-render-check:
	@printf "$(ICON_STEP) %s\n" "Checking service descriptors are up to date…"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/render_service_descriptors.py --check
	@printf "$(ICON_OK) %s\n" "Service descriptor check passed"

# ============================================================
# API OpenAPI Validation
# ============================================================
# One target, two modes.
#
#   make api-check              # validate ALL fragments across ALL canons
#   make api-check user         # validate only `user/` — everywhere it exists
#   make api-check course       # validate only `course/` — everywhere it exists
#
# A "canon" is any directory `openapi/{NAME}/fragments/` under
# `services/portal/internal/services/api/openapi/`. Adding a new one is
# `mkdir` + drop fragments — no Make edits, no code changes.

# Extract the resource name from MAKECMDGOALS — but only when `api-check`
# is the first goal. Otherwise every other target in a chain would leak
# into API_CHECK_RESOURCE and get overridden as a no-op.
ifeq (api-check,$(firstword $(MAKECMDGOALS)))
API_CHECK_RESOURCE := $(filter-out api-check,$(MAKECMDGOALS))
ifneq (,$(API_CHECK_RESOURCE))
# Silence make's «no recipe for …» warning for the resource-name argument.
$(eval $(API_CHECK_RESOURCE):; @:)
endif
endif

api-check:
	@printf "$(COLOR_CYAN)== API-CHECK: START ==$(COLOR_RESET)\n"
ifeq (,$(API_CHECK_RESOURCE))
	@cd $(REPO_ROOT) && $(PYTHON) tools/governance/validate_openapi.py --all-trees
else
	@printf "$(ICON_INFO) %s\n" "Scope: resource '$(API_CHECK_RESOURCE)' across every canon that has it"
	@cd $(REPO_ROOT) && $(PYTHON) tools/governance/validate_openapi.py --resource $(API_CHECK_RESOURCE)
endif
	@printf "$(COLOR_GREEN)== API-CHECK: SUCCESS ==$(COLOR_RESET)\n"


# ─────────────────────────────────────────────
# Aggregator
# ─────────────────────────────────────────────
verify:
	@printf "$(COLOR_CYAN)== PORTAL VERIFY: START ==$(COLOR_RESET)\n"
	@$(MAKE) docs-check
	@$(MAKE) docs-a11y-check
	@# visual-test is intentionally NOT in the CI verify chain. PNG baselines
	@# are platform-dependent (font hinting, sub-pixel AA differ between
	@# macOS Chromium and Linux Chromium on GitHub runners), so a baseline
	@# baked locally fails on CI even when the UI hasn't changed. For the
	@# full local gate that does include the visual diff, use `verify-local`.
	@printf "$(COLOR_GREEN)== PORTAL VERIFY: SUCCESS ==$(COLOR_RESET)\n"

# Full local gate — everything in `verify` plus the platform-dependent
# visual diff. Use before push when you've touched UI Kit components,
# tokens, or template structure. Same command CI runs as `verify` plus
# `visual-test`, so a green `verify-local` implies a green CI verify.
verify-local:
	@printf "$(COLOR_CYAN)== PORTAL VERIFY-LOCAL: START ==$(COLOR_RESET)\n"
	@$(MAKE) verify
	@$(MAKE) visual-test
	@printf "$(COLOR_GREEN)== PORTAL VERIFY-LOCAL: SUCCESS ==$(COLOR_RESET)\n"
