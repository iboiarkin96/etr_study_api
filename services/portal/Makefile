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

.PHONY: help verify docs-fix docs-check docs-html-check docs-design-check docs-a11y-check docs-feedback-check docs-spec-check catalog-render catalog-render-check

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
	@echo "  make catalog-render        Regenerate per-service catalog from catalog-info.yaml"
	@echo "  make catalog-render-check  Catalog drift gate"
	@echo "  make verify                docs-check + docs-a11y-check"

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
	@printf "$(ICON_INFO) %s\n" "[1/9] regenerate UML diagrams"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/regenerate_docs.py
	@printf "$(ICON_INFO) %s\n" "[2/9] sync marker-based documentation"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/sync_docs.py
	@printf "$(ICON_INFO) %s\n" "[3/9] render docs markdown to html companions"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/render_docs_html.py
	@printf "$(ICON_INFO) %s\n" "[4/9] repair docs html structure"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/repair_docs_html.py
	@printf "$(ICON_INFO) %s\n" "[5/9] normalize docs html template"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/format_docs_html.py
	@printf "$(ICON_INFO) %s\n" "[6/9] render service catalog (YAML → HTML)"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/render_service_descriptors.py
	@printf "$(ICON_INFO) %s\n" "[7/9] ensure docs body maintainers"
	@cd $(REPO_ROOT) && $(PYTHON) tools/docs/ensure_docs_maintainers.py
	@printf "$(ICON_INFO) %s\n" "[8/9] Python API reference (pdoc)"
	@rm -rf $(REPO_ROOT)/services/portal/internal/services/api/code-reference
	@cd $(REPO_ROOT) && PYTHONHASHSEED=0 PYTHONPATH=services/api $(PYTHON) -m pdoc app -o services/portal/internal/services/api/code-reference
	@printf "$(ICON_INFO) %s\n" "[9/9] build pagefind index (ADR-0033)"
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

# ─────────────────────────────────────────────
# Drift gate (used by CI + `make verify`)
# ─────────────────────────────────────────────
docs-check:
	@$(MAKE) docs-html-check
	@$(MAKE) docs-design-check
	@$(MAKE) docs-feedback-check
	@$(MAKE) docs-spec-check
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

# ─────────────────────────────────────────────
# Aggregator
# ─────────────────────────────────────────────
verify:
	@printf "$(COLOR_CYAN)== PORTAL VERIFY: START ==$(COLOR_RESET)\n"
	@$(MAKE) docs-check
	@$(MAKE) docs-a11y-check
	@printf "$(COLOR_GREEN)== PORTAL VERIFY: SUCCESS ==$(COLOR_RESET)\n"
