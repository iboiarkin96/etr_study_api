"use strict";

/**
 * Internal portal sidebar — config + nav data; behavior comes from docs-sidebar.js.
 *
 * Conventions enforced across the tree:
 *   - The first child of every group is `label: "Overview"` (B3, 2026-05-11).
 *     See analysis/principles/single-authoring-model.html for the rule.
 *   - No decorative emoji in labels (B2, 2026-05-11). Screen readers re-announce
 *     them and they clutter the drawer's tree.
 *   - Top-level entries are grouped by audience under `{ kind: "section" }`
 *     pseudo-nodes (B4–B5, 2026-05-11). Section order is: Project / Reference /
 *     By role / Governance / People.
 *   - Groups use `expand: "on-descendant"` as a documentation marker. The
 *     runtime defaults to opening a group when any descendant matches the
 *     current path; the keyword exists for clarity, not behaviour.
 *
 * Operation entries use HTTP-method-first labels (`METHOD /path/...`), not
 * Python operationId names — navigation matches how integrators think.
 * HTML files under `internal/api/{entity}/operations/` are named after the HTTP
 * method and path template, not operationId.
 */
(function () {
  /* ── SSOT-TODO ─────────────────────────────────────────────────────────
   * This array duplicates the filesystem structure under services/portal/internal/.
   * The canonical SSOT is the directory tree on disk; this array is a hand-
   * maintained projection. Adding / renaming / removing a page requires editing
   * BOTH the file AND this array — divergence is silent until a reader hits a
   * 404. See analysis/principles/ssot.html for the principle and the planned
   * Phase 2 work (generate the nav from a directory walk or a single YAML
   * manifest) that will eliminate the duplication.
   */
  const INTERNAL_SIDEBAR_NAV = [

    /* ─────────────────────────── PROJECT ──────────────────────────────── */
    { kind: "section", label: "Project" },
    { label: "Methodology", path: "internal/analysis/methodology.html" },
    { label: "System design", path: "internal/analysis/system-design.html" },
    { label: "Backlog", path: "internal/governance/backlog/index.html" },

    /* ────────────────────────── REFERENCE ─────────────────────────────── */
    { kind: "section", label: "Reference" },
    {
      label: "Service catalog",
      children: [
        { label: "Overview", path: "internal/catalog/index.html" },
        {
          label: "api",
          children: [
            { label: "Overview", path: "internal/catalog/api/index.html" },
            { label: "Architecture", path: "internal/catalog/api/architecture.html" },
            { label: "API reference", path: "internal/catalog/api/api-reference.html" },
            { label: "Runbooks", path: "internal/catalog/api/runbooks.html" },
            { label: "Dependencies", path: "internal/catalog/api/dependencies.html" },
            { label: "On-call", path: "internal/catalog/api/on-call.html" },
            { label: "Code reference (pdoc)", path: "internal/catalog/api/code-reference/index.html" },
          ],
        },
        {
          label: "portal",
          children: [
            { label: "Overview", path: "internal/catalog/portal/index.html" },
            { label: "Architecture", path: "internal/catalog/portal/architecture.html" },
            { label: "API reference", path: "internal/catalog/portal/api-reference.html" },
            { label: "Runbooks", path: "internal/catalog/portal/runbooks.html" },
            { label: "Dependencies", path: "internal/catalog/portal/dependencies.html" },
            { label: "On-call", path: "internal/catalog/portal/on-call.html" },
          ],
        },
        {
          label: "monitoring",
          children: [
            { label: "Overview", path: "internal/catalog/monitoring/index.html" },
            { label: "Architecture", path: "internal/catalog/monitoring/architecture.html" },
            { label: "API reference", path: "internal/catalog/monitoring/api-reference.html" },
            { label: "Runbooks", path: "internal/catalog/monitoring/runbooks.html" },
            { label: "Dependencies", path: "internal/catalog/monitoring/dependencies.html" },
            { label: "On-call", path: "internal/catalog/monitoring/on-call.html" },
          ],
        },
      ],
    },
    {
      label: "API endpoints documentation",
      children: [
        { label: "Overview", path: "internal/api/index.html" },
        {
          label: "Shared (cross-cutting)",
          children: [
            { label: "Specification template", path: "internal/api/_shared/spec-template.html" },
            { label: "Definition of Done", path: "internal/api/_shared/spec-definition-of-done.html" },
            { label: "Idempotency", path: "internal/api/_shared/idempotency.html" },
            { label: "Error envelope", path: "internal/api/_shared/error-envelope.html" },
            { label: "Error catalog", path: "internal/api/_shared/error-catalog.html" },
            { label: "Authentication & authorization", path: "internal/api/_shared/auth.html" },
            { label: "Pagination", path: "internal/api/_shared/pagination.html" },
            { label: "Versioning", path: "internal/api/_shared/versioning.html" },
            { label: "Observability conventions", path: "internal/api/_shared/observability-conventions.html" },
            { label: "Field conventions", path: "internal/api/_shared/field-conventions.html" },
            { label: "OpenAPI authoring guide", path: "internal/api/_shared/openapi-authoring-guide.html" },
            { label: "Error matrix (auto-generated)", path: "internal/api/errors.html" },
          ],
        },
        {
          label: "User",
          expand: "on-descendant",
          children: [
            { label: "Overview", path: "internal/api/user/index.html" },
            { label: "GET /user/", path: "internal/api/user/operations/get-api-v1-user-system_uuid-system_user_id.html" },
            { label: "POST /user", path: "internal/api/user/operations/post-api-v1-user.html" },
            { label: "PUT /user/", path: "internal/api/user/operations/put-api-v1-user-system_uuid-system_user_id.html" },
            { label: "PATCH /user/", path: "internal/api/user/operations/patch-api-v1-user-system_uuid-system_user_id.html" },
          ],
        },
        {
          label: "Conspectus",
          expand: "on-descendant",
          children: [
            { label: "Overview", path: "internal/api/conspectus/index.html" },
            { label: "GET /conspectuses/due/", path: "internal/api/conspectus/operations/get-api-v1-conspectuses-due.html" },
            { label: "GET /schedule/summary/", path: "internal/api/conspectus/operations/get-api-v1-schedule-summary.html" },
            { label: "POST …/actions/review", path: "internal/api/conspectus/operations/post-api-v1-conspectuses-conspectus_uuid-actions-review.html" },
            { label: "POST /conspectuses", path: "internal/api/conspectus/operations/post-api-v1-conspectuses.html" },
            { label: "PATCH /conspectuses/{id}", path: "internal/api/conspectus/operations/patch-api-v1-conspectuses-conspectus_uuid.html" },
          ],
        },
        {
          label: "Error log",
          expand: "on-descendant",
          children: [
            { label: "Overview", path: "internal/api/error-log/index.html" },
            { label: "GET /errors/", path: "internal/api/error-log/operations/get-api-v1-errors.html" },
            { label: "POST /errors", path: "internal/api/error-log/operations/post-api-v1-errors.html" },
          ],
        },
      ],
    },
    {
      label: "Docs frontend documentation",
      children: [
        { label: "Overview", path: "internal/front/index.html" },
        {
          label: "Foundations",
          children: [
            { label: "Style guide", path: "internal/front/_shared/style-guide.html" },
            { label: "Maintenance process", path: "internal/front/_shared/process.html" },
            { label: "Frontend glossary", path: "internal/front/_shared/glossary.html" },
            { label: "Quick entry by role", path: "internal/front/_shared/fast-entry-by-role.html" },
          ],
        },
        {
          label: "Spec templates",
          children: [
            { label: "Component spec template", path: "internal/front/_shared/component-spec-template.html" },
            { label: "Foundation spec template", path: "internal/front/_shared/foundation-spec-template.html" },
            { label: "Contract spec template", path: "internal/front/_shared/contract-spec-template.html" },
            { label: "Definition of Done", path: "internal/front/_shared/spec-definition-of-done.html" },
          ],
        },
        {
          label: "Architecture",
          children: [
            { label: "Architecture map", path: "internal/front/architecture-map.html" },
          ],
        },
        {
          label: "Screens",
          children: [
            { label: "Screen spec template", path: "internal/front/screens/docs-screen-template.html" },
            { label: "Engineering hub home", path: "internal/front/screens/docs-screen-home-landing.html" },
            { label: "Backlog cockpit", path: "internal/front/screens/docs-screen-backlog-cockpit.html" },
            { label: "Hall of Contributors", path: "internal/front/screens/docs-screen-portal-hall-of-contributors.html" },
          ],
        },
        {
          label: "Components",
          children: [
            { label: "UI kit", path: "internal/front/foundations/ui-kit.html" },
            { label: "Tooltips and inline hints", path: "internal/front/components/tooltips.html" },
            { label: "Popup and overlay system", path: "internal/front/components/popups-and-overlays.html" },
            { label: "Diagrams and lightbox", path: "internal/front/components/diagrams-and-lightbox.html" },
            { label: "Resume reading and back-to-top", path: "internal/front/components/resume-and-back-to-top.html" },
            { label: "Rocket launch animation", path: "internal/front/components/rocket-launch-animation.html" },
            { label: "Report-bug FAB", path: "internal/front/components/report-bug-fab.html" },
            { label: "Sticky On this page TOC", path: "internal/front/components/sticky-toc.html" },
            { label: "Hotkeys", path: "internal/front/foundations/hotkeys.html" },
          ],
        },
        {
          label: "Reference",
          children: [
            { label: "JavaScript modules", path: "internal/front/foundations/js-modules.html" },
            { label: "CSS architecture", path: "internal/front/foundations/css-architecture.html" },
            { label: "Token gallery (auto-generated)", path: "internal/front/foundations/tokens.html" },
          ],
        },
        {
          label: "Cross-cutting systems",
          children: [
            { label: "Navigation and theme contract", path: "internal/front/contracts/menu-and-theme.html" },
            { label: "Navigation, search, discovery", path: "internal/front/contracts/navigation-search-and-discovery.html" },
            { label: "UI, motion, adaptivity", path: "internal/front/foundations/motion-and-adaptivity.html" },
            { label: "Feedback and editorial workflow", path: "internal/front/contracts/feedback-and-editorial-workflow.html" },
          ],
        },
        {
          label: "Patterns",
          children: [
            { label: "Long-form reading aids", path: "internal/front/patterns/long-form-reading-aids.html" },
          ],
        },
      ],
    },

    /* ─────────────────────────── BY ROLE ──────────────────────────────── */
    { kind: "section", label: "By role" },
    {
      label: "Managers portal",
      children: [
        { label: "Overview", path: "internal/manager/index.html" },
        { label: "SDLC RACI matrix", path: "internal/manager/sdlc-raci-matrix.html" },
      ],
    },
    {
      label: "Developers portal",
      children: [
        { label: "Overview", path: "internal/handbook/developer/index.html" },
        {
          label: "Core architecture and contracts",
          children: [
            { label: "Requirements guide", path: "internal/handbook/developer/0001-requirements.html" },
            { label: "Schemas and contracts", path: "internal/handbook/developer/0002-schemas-and-contracts.html" },
            { label: "Business logic guide", path: "internal/handbook/developer/0003-business-logic.html" },
            { label: "Error matrix by status", path: "internal/handbook/developer/0005-error-matrix-by-status.html" },
          ],
        },
        {
          label: "Database tables",
          children: [
            { label: "Overview", path: "internal/catalog/api/data/index.html" },
            { label: "Template", path: "internal/catalog/api/data/_template.html" },
            {
              label: "Core",
              children: [
                { label: "users", path: "internal/catalog/api/data/users.html" },
              ],
            },
            {
              label: "Reference",
              children: [
                { label: "systems", path: "internal/catalog/api/data/systems.html" },
                { label: "invalidation_reasons", path: "internal/catalog/api/data/invalidation_reasons.html" },
                { label: "timezones", path: "internal/catalog/api/data/timezones.html" },
              ],
            },
          ],
        },
        {
          label: "Delivery workflow and operations",
          children: [
            { label: "Make commands and workflows", path: "internal/handbook/developer/0010-make-commands-and-workflows.html" },
            { label: "Local development", path: "internal/handbook/developer/0007-local-development.html" },
            { label: "Docker image and container", path: "internal/handbook/developer/0009-docker-image-and-container.html" },
            { label: "API load testing", path: "internal/handbook/developer/0006-api-load-testing.html" },
            { label: "Documentation pipeline", path: "internal/handbook/developer/0008-docs-pipeline.html" },
          ],
        },
        { label: "See: How-to guides", path: "internal/handbook/howto/index.html" },
      ],
    },
    {
      label: "SRE portal",
      children: [
        { label: "Overview", path: "internal/sre/index.html" },
        {
          label: "Reliability foundations",
          children: [
            { label: "SLOs & error budget", path: "internal/sre/slos.html" },
            { label: "Monitoring", path: "internal/sre/monitoring.html" },
            { label: "Logging", path: "internal/sre/logging.html" },
            { label: "Observability", path: "internal/sre/observability.html" },
          ],
        },
        {
          label: "Operations",
          children: [
            { label: "On-call", path: "internal/sre/on-call.html" },
            { label: "Incident response", path: "internal/sre/incident-response.html" },
            { label: "Debugging", path: "internal/sre/debugging.html" },
          ],
        },
        {
          label: "Postmortems",
          children: [
            { label: "Overview", path: "internal/sre/postmortems/index.html" },
            { label: "Postmortem template", path: "internal/sre/postmortems/_template.html" },
          ],
        },
        {
          label: "Runbooks",
          children: [
            { label: "Overview", path: "internal/sre/runbooks/index.html" },
            {
              label: "Shared (cross-cutting)",
              children: [
                { label: "Runbook template", path: "internal/sre/runbooks/0000-template.html" },
              ],
            },
            {
              label: "CI and local quality failures",
              children: [
                { label: "Tests failing", path: "internal/sre/runbooks/0001-tests-failing.html" },
                { label: "Pre-commit failing", path: "internal/sre/runbooks/0004-pre-commit-failing.html" },
                { label: "Quality check failing", path: "internal/sre/runbooks/0005-quality-check-failing.html" },
                { label: "OpenAPI contract test failing", path: "internal/sre/runbooks/0007-openapi-contract-test-failing.html" },
              ],
            },
            {
              label: "Data and migration failures",
              children: [{ label: "Migrations failing", path: "internal/sre/runbooks/0002-migrations-failing.html" }],
            },
            {
              label: "Security and API guardrails",
              children: [{ label: "API security failing", path: "internal/sre/runbooks/0006-api-security-failing.html" }],
            },
            {
              label: "Observability and reliability incidents",
              children: [
                { label: "Logging failing", path: "internal/sre/runbooks/0003-logging-failing.html" },
                { label: "Observability scrape failing", path: "internal/sre/runbooks/0008-observability-scrape-failing.html" },
                { label: "Error budget exhaustion", path: "internal/sre/runbooks/0009-error-budget-exhaustion.html" },
              ],
            },
            {
              label: "Docs frontend incidents",
              children: [{ label: "In-page TOC missing", path: "internal/sre/runbooks/0010-in-page-toc-missing.html" }],
            },
          ],
        },
      ],
    },
    {
      label: "QA portal",
      children: [
        { label: "Overview", path: "internal/handbook/qa/index.html" },
        {
          label: "Foundations",
          children: [
            { label: "Test strategy", path: "internal/handbook/qa/test-strategy.html" },
            { label: "Test pyramid & layer ownership", path: "internal/handbook/qa/test-pyramid.html" },
            { label: "QA process & SDLC integration", path: "internal/handbook/qa/qa-process.html" },
            { label: "Tester onboarding", path: "internal/handbook/qa/tester-onboarding.html" },
            { label: "QA glossary", path: "internal/handbook/qa/glossary.html" },
          ],
        },
        {
          label: "Templates",
          children: [
            { label: "Test case template", path: "internal/handbook/qa/templates/test-case-template.html" },
            { label: "Bug report template", path: "internal/handbook/qa/templates/bug-report-template.html" },
            { label: "Test plan template", path: "internal/handbook/qa/templates/test-plan-template.html" },
          ],
        },
        {
          label: "Playbooks",
          children: [
            { label: "API endpoint testing", path: "internal/handbook/qa/playbooks/api-endpoint-testing.html" },
            { label: "Documentation testing", path: "internal/handbook/qa/playbooks/documentation-testing.html" },
            { label: "Release smoke testing", path: "internal/handbook/qa/playbooks/release-smoke.html" },
            { label: "Exploratory testing", path: "internal/handbook/qa/playbooks/exploratory-testing.html" },
            { label: "Accessibility testing", path: "internal/handbook/qa/playbooks/accessibility-testing.html" },
          ],
        },
        {
          label: "Checklists",
          children: [
            { label: "0001 — Documentation pages visual", path: "internal/handbook/qa/0001-documentation-pages-visual-checklist.html" },
            { label: "0002 — API endpoint acceptance", path: "internal/handbook/qa/0002-api-endpoint-acceptance-checklist.html" },
            { label: "0003 — Release smoke", path: "internal/handbook/qa/0003-release-smoke-checklist.html" },
            { label: "0004 — Regression", path: "internal/handbook/qa/0004-regression-checklist.html" },
            { label: "0005 — Accessibility (WCAG 2.1 AA)", path: "internal/handbook/qa/0005-accessibility-checklist.html" },
          ],
        },
        {
          label: "Reference",
          children: [
            { label: "Severity & priority matrix", path: "internal/handbook/qa/reference/bug-severity-and-priority.html" },
            { label: "Defect lifecycle", path: "internal/handbook/qa/reference/defect-lifecycle.html" },
            { label: "Test environments", path: "internal/handbook/qa/reference/test-environments.html" },
          ],
        },
      ],
    },
    {
      label: "SA portal",
      children: [
        { label: "Overview", path: "internal/analysis/index.html" },
        { label: "Methodology", path: "internal/analysis/methodology.html" },
        { label: "System design", path: "internal/analysis/system-design.html" },
        {
          label: "Documentation principles",
          children: [
            { label: "Overview", path: "internal/analysis/principles/index.html" },
            { label: "SSOT (Single Source of Truth)", path: "internal/analysis/principles/ssot.html" },
            { label: "Docs as code", path: "internal/analysis/principles/docs-as-code.html" },
            { label: "Diátaxis", path: "internal/analysis/principles/diataxis.html" },
            { label: "Decision records (ADR/RFC)", path: "internal/analysis/principles/decision-records.html" },
            { label: "Single authoring model", path: "internal/analysis/principles/single-authoring-model.html" },
            { label: "Mobile contract", path: "internal/analysis/principles/mobile-contract.html" },
            { label: "PlantUML only", path: "internal/analysis/principles/plantuml-only.html" },
          ],
        },
      ],
    },

    /* ────────────────────────── GOVERNANCE ────────────────────────────── */
    { kind: "section", label: "Governance" },
    {
      label: "ADRs",
      children: [
        { label: "Overview", path: "internal/governance/adr/index.html" },
        {
          label: "Shared (cross-cutting)",
          children: [
            { label: "ADR template", path: "internal/governance/adr/0000-template.html" },
          ],
        },
        {
          label: "Process: how we record decisions",
          children: [
            { label: "ADR 0018 — lifecycle, ratification, badges", path: "internal/governance/adr/0018-adr-lifecycle-ratification-and-badges.html" },
          ],
        },
        {
          label: "Documentation and diagrams",
          children: [
            { label: "ADR 0027 — client-side docs search", path: "internal/governance/adr/0027-client-side-docs-search-index-and-ranking.html" },
            { label: "ADR 0025 — external vs internal API documentation", path: "internal/governance/adr/0025-external-and-internal-api-documentation.html" },
            { label: "ADR 0026 — internal service documentation (source of truth)", path: "internal/governance/adr/0026-internal-service-documentation-as-source-of-truth.html" },
            { label: "ADR 0024 — architecture and quality assessment documents", path: "internal/governance/adr/0024-architecture-and-quality-assessment-documents.html" },
            { label: "ADR 0001 — docs as code", path: "internal/governance/adr/0001-docs-as-code.html" },
            { label: "ADR 0013 — changelog and release notes", path: "internal/governance/adr/0013-changelog-and-release-notes.html" },
            { label: "ADR 0016 — Python docstrings and pdoc", path: "internal/governance/adr/0016-python-docstrings-google-style-and-pdoc.html" },
            { label: "ADR 0020 — C4, PlantUML, diagram conventions", path: "internal/governance/adr/0020-c4-plantuml-diagram-style-and-conventions.html" },
            { label: "ADR 0029 — database table documentation", path: "internal/governance/adr/0029-database-table-documentation.html" },
            { label: "ADR 0030 — portal shell token contract", path: "internal/governance/adr/0030-portal-shell-token-contract.html" },
          ],
        },
        {
          label: "API contract and integrators",
          children: [
            { label: "ADR 0007 — OpenAPI governance and usability", path: "internal/governance/adr/0007-openapi-governance-and-usability-standard.html" },
            { label: "ADR 0003 — error contract governance", path: "internal/governance/adr/0003-error-contract-governance.html" },
            { label: "ADR 0004 — API versioning policy", path: "internal/governance/adr/0004-api-versioning-policy.html" },
            { label: "ADR 0006 — idempotency for write operations", path: "internal/governance/adr/0006-idempotency-write-operations.html" },
            { label: "ADR 0022 — embedded Swagger UI (superseded)", path: "internal/governance/adr/0022-embedded-swagger-ui-openapi-sandbox.html" },
          ],
        },
        {
          label: "Security, config, and supply chain",
          children: [
            { label: "ADR 0005 — API security defaults", path: "internal/governance/adr/0005-api-security-defaults.html" },
            { label: "ADR 0010 — env profiles and config governance", path: "internal/governance/adr/0010-env-profiles-and-config-governance.html" },
            { label: "ADR 0019 — pip-audit and dependency pinning", path: "internal/governance/adr/0019-python-dependency-security-pip-audit-and-pinning-policy.html" },
          ],
        },
        {
          label: "Testing and code health",
          children: [
            { label: "ADR 0002 — testing policy", path: "internal/governance/adr/0002-testing-policy.html" },
            { label: "ADR 0012 — testing strategy and load testing", path: "internal/governance/adr/0012-testing-strategy-and-load-testing.html" },
            { label: "ADR 0014 — dead code analysis and repository hygiene", path: "internal/governance/adr/0014-dead-code-analysis-and-repository-hygiene.html" },
          ],
        },
        {
          label: "Running, observing, and SLOs",
          children: [
            { label: "ADR 0009 — health, readiness, and observability", path: "internal/governance/adr/0009-health-readiness-and-observability.html" },
            { label: "ADR 0011 — SLO, SLA, and error budget", path: "internal/governance/adr/0011-slo-sla-error-budget.html" },
            { label: "ADR 0023 — structured logging and local Elasticsearch", path: "internal/governance/adr/0023-structured-logging-and-local-elasticsearch.html" },
          ],
        },
        {
          label: "Day-to-day workflow and Git",
          children: [
            { label: "ADR 0008 — Make command taxonomy and workflow entrypoints", path: "internal/governance/adr/0008-make-command-taxonomy-and-workflow-entrypoints.html" },
            { label: "ADR 0017 — branch naming and repository workflow", path: "internal/governance/adr/0017-branch-naming-and-repository-workflow.html" },
          ],
        },
        {
          label: "Containers and delivery",
          children: [
            { label: "ADR 0015 — container image", path: "internal/governance/adr/0015-container-image.html" },
            { label: "ADR 0021 — continuous delivery (GitHub Actions and GHCR)", path: "internal/governance/adr/0021-continuous-delivery-github-actions-and-ghcr.html" },
          ],
        },
      ],
    },
    {
      label: "RFCs",
      children: [
        { label: "Overview", path: "internal/governance/rfc/index.html" },
        {
          label: "Shared (cross-cutting)",
          children: [
            { label: "RFC template", path: "internal/governance/rfc/0000-template.html" },
          ],
        },
        {
          label: "Docs search program",
          children: [
            { label: "RFC 0001 — docs search implementation", path: "internal/governance/rfc/0001-docs-search-implementation.html" },
            { label: "RFC 0002 — docs search KPI policy and SLO", path: "internal/governance/rfc/0002-docs-search-kpi-policy-and-slo.html" },
          ],
        },
        {
          label: "Authoring model",
          children: [
            { label: "RFC 0003 — documentation authoring model", path: "internal/governance/rfc/0003-documentation-authoring-model.html" },
          ],
        },
      ],
    },
    {
      label: "How-to guides",
      children: [
        { label: "Overview", path: "internal/handbook/howto/index.html" },
        {
          label: "Onboarding and implementation",
          children: [
            { label: "Onboarding from zero to endpoint and docs", path: "internal/handbook/howto/0001-onboarding-from-zero-to-endpoint-docs.html" },
            { label: "How to add POST /api/v1/contract", path: "internal/handbook/howto/0004-how-to-add-post-contract.html" },
          ],
        },
        {
          label: "Documentation operations",
          children: [
            { label: "Internal service docs layout and how to add pages", path: "internal/handbook/howto/0002-internal-service-docs-layout.html" },
            { label: "How to change docs frontend safely", path: "internal/handbook/howto/0005-how-to-change-docs-frontend-safely.html" },
          ],
        },
        {
          label: "Workflow and commands",
          children: [
            { label: "Make commands inventory", path: "internal/handbook/howto/0003-make-commands-inventory.html" },
          ],
        },
      ],
    },
    {
      label: "Audit",
      children: [
        { label: "Overview", path: "internal/governance/audit/index.html" },
        {
          label: "Shared (cross-cutting)",
          children: [
            { label: "Assessment template", path: "internal/governance/audit/AUDIT_TEMPLATE.html" },
          ],
        },
        {
          label: "DX audit",
          children: [
            { label: "DX 2026-04-14", path: "internal/governance/audit/docs/2026-04-14-documentation-experience-assessment.html" },
            { label: "DX 2026-04-18", path: "internal/governance/audit/docs/2026-04-18-documentation-experience-assessment.html" },
            { label: "DX 2026-05-01", path: "internal/governance/audit/docs/2026-05-01-documentation-experience-assessment.html" },
          ],
        },
        {
          label: "UI/UX audit",
          children: [
            { label: "UI/UX 2026-04-23", path: "internal/governance/audit/ui-ux/2026-04-23-ui-ux-assessment.html" },
            { label: "UI/UX 2026-04-24", path: "internal/governance/audit/ui-ux/2026-04-24-ui-ux-assessment.html" },
            { label: "UI/UX 2026-05-09", path: "internal/governance/audit/ui-ux/2026-05-09-ui-ux-consistency-assessment.html" },
          ],
        },
        {
          label: "REST API audit",
          children: [
            { label: "REST API 2026-04-14", path: "internal/governance/audit/api/2026-04-14-rest-api-assessment.html" },
          ],
        },
        {
          label: "Bug audit",
          children: [
            { label: "Bug audit 2026-05-07", path: "internal/governance/audit/bugs/2026-05-07-portal-bug-audit.html" },
          ],
        },
        {
          label: "Project maturity audit",
          children: [
            { label: "Project Maturity 2026-05-11", path: "internal/governance/audit/maturity/2026-05-10-project-maturity-assessment.html" },
            { label: "Tech Docs Maturity 2026-05-11", path: "internal/governance/audit/maturity/2026-05-10-tech-docs-maturity-assessment.html" },
            { label: "Tech Docs Maturity v2 2026-05-11", path: "internal/governance/audit/maturity/2026-05-10-tech-docs-maturity-assessment-v2.html" },
          ],
        },
      ],
    },

    /* ─────────────────────────── PEOPLE ───────────────────────────────── */
    { kind: "section", label: "People" },
    { label: "People & maintainers", path: "internal/team/people/index.html" },
  ];

  /* ── Config ───────────────────────────────────────────────────────────── */

  const CONFIG = {
    navData: INTERNAL_SIDEBAR_NAV,
    treePrefix: "internal-sidebar",
    layoutPrefix: "internal-layout",
    mountId: "internal-sidebar-mount",
    sidebarSelector: ".internal-layout__sidebar",
    shellSelector: ".internal-layout__shell",
    storageKey: "docs.internal.sidebar.collapsed",
    navAriaLabel: "Internal documentation",
    defaultRelPath: "index.html",
    docsRootFirstSegments: [
      "index.html",
      "adr",
      "api",
      "assets",
      "audit",
      "backlog",
      "developer",
      "howto",
      "internal",
      "openapi",
      "public",
      "qa",
      "rfc",
      "runbooks",
    ],
    supportsIcons: false,
    supportsLabelHtml: true,
    activeScrollBlock: "center",
    collapseToggle: {
      hideTitleSelector: ".internal-layout__sidebar-title",
      hideHostOnCollapse: true,
      toggleLabelText: "HIDE",
      tooltipOnCollapse: true,
      dataAttr: "data-internal-sidebar-toggle",
    },
    drawer: {
      id: "internal-docs-drawer",
      title: "Internal docs",
      bodyClassOnOpen: "internal-sidebar-drawer-open",
      drawerModeShellClass: "is-drawer-mode",
      toggleEventName: "internal-sidebar:toggle-drawer",
      stateEventName: "internal-sidebar:drawer-state",
      focusRestore: true,
    },
    beforeRenderTree(ctx) {
      const { host, fromDir } = ctx;
      const { relHref } = window.DocsSidebar.pathUtils;
      /* Hide the static eyebrow label — the wordmark below replaces it visually.
       * On collapse, hideHostOnCollapse hides the host; the eyebrow is restored
       * by removing the data attribute so it serves as the collapsed label. */
      const aside = host.closest(".internal-layout__sidebar");
      if (aside) aside.setAttribute("data-has-wordmark", "1");
      host.appendChild(window.DocsSidebarBootstrap.buildWordmark({
        fromDir,
        relHref,
        homeHref: "internal/index.html",
        ariaLabel: "ETR Study API — Project Documentation",
        productHtml: 'ETR <span class="internal-sidebar__product-accent">Study API</span>',
        tagline: "Project Documentation",
        classPrefix: "internal-sidebar",
      }));
    },
  };

  /* ── Bootstrap: ensure sidebar-bootstrap.js is loaded, then init. ──────
   * Identical 18-line pattern in public-sidebar.js — the only variants
   * are SCRIPT_BASENAME and LABEL. All shared helpers live in
   * sidebar-bootstrap.js (deriveAssetsBaseDir, ensureRuntimeLoaded, init).
   */
  (function bootstrapInternalSidebar() {
    const SCRIPT_BASENAME = "internal-sidebar.js";
    const LABEL = "internal-sidebar";

    function go() {
      window.DocsSidebarBootstrap.init({
        config: CONFIG,
        scriptBasename: SCRIPT_BASENAME,
        label: LABEL,
      });
    }
    if (window.DocsSidebarBootstrap) { go(); return; }

    const tags = document.querySelectorAll('script[src*="' + SCRIPT_BASENAME + '"]');
    if (!tags.length) return;
    const src = tags[tags.length - 1].src;
    const baseDir = src.slice(0, src.lastIndexOf("/") + 1);

    let loader = document.querySelector('script[data-docs-sidebar-bootstrap="1"]');
    if (!loader) {
      loader = document.createElement("script");
      loader.src = baseDir + "sidebar-bootstrap.js";
      loader.dataset.docsSidebarBootstrap = "1";
      document.head.appendChild(loader);
    }
    loader.addEventListener("load", go);
    loader.addEventListener("error", () => {
      // eslint-disable-next-line no-console
      console.error("[" + LABEL + "] failed to load sidebar-bootstrap");
    });
  })();
})();
