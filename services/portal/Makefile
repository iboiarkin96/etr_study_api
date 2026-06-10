# services/portal/Makefile — per-service entry points for the documentation portal (ADR 0028 Phase 2).
#
# All targets delegate to the root Makefile because the docs autogen pipeline
# (pdoc + render_docs_html + format_docs_html + render_service_descriptors +
# build_pagefind_index) needs `app.*` introspection and lives under
# tools/docs/. The root Makefile orchestrates the full chain.
#
# Usage:
#   make -C services/portal docs-fix         # regenerate docs artefacts
#   make -C services/portal docs-check       # drift gate (used in CI)
#   make -C services/portal docs-a11y-check  # WCAG baseline
#   make -C services/portal docs-html-check  # HTML well-formed
#   make -C services/portal docs-design-check
#   make -C services/portal docs-feedback-check
#   make -C services/portal docs-spec-check
#   make -C services/portal verify           # alias for docs-check + docs-a11y-check

REPO_ROOT := $(abspath ..)/..

.PHONY: help verify docs-fix docs-check docs-html-check docs-design-check docs-a11y-check docs-feedback-check docs-spec-check catalog-render catalog-render-check

help:
	@echo "services/portal/Makefile — documentation portal control"
	@echo ""
	@echo "  make docs-fix              Regenerate docs (UML + markers + HTML repair + pdoc + Pagefind)"
	@echo "  make docs-check            Drift gate — fails if docs-fix would change anything"
	@echo "  make docs-html-check       HTML structure validation"
	@echo "  make docs-design-check     Design baseline (cards, skeleton)"
	@echo "  make docs-a11y-check       WCAG baseline accessibility"
	@echo "  make docs-feedback-check   Page-level feedback smoke"
	@echo "  make docs-spec-check       Spec consistency + lint"
	@echo "  make catalog-render        Regenerate per-service catalog cards from catalog-info.yaml"
	@echo "  make catalog-render-check  Drift gate for catalog HTML"
	@echo "  make verify                docs-check + docs-a11y-check"

docs-fix docs-check docs-html-check docs-design-check docs-a11y-check docs-feedback-check docs-spec-check catalog-render catalog-render-check:
	@$(MAKE) -C $(REPO_ROOT) $@

verify:
	@$(MAKE) -C $(REPO_ROOT) docs-check
	@$(MAKE) -C $(REPO_ROOT) docs-a11y-check
