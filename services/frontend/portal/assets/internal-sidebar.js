"use strict";

/**
 * Internal portal sidebar — config + nav data; behavior comes from docs-sidebar.js.
 *
 * Conventions enforced across the tree:
 *   - The first child of every group is `label: "Overview"` (B3, 2026-05-11).
 *     See roles/sa/practices/single-authoring-model.html for the rule.
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
   * 404. See roles/sa/practices/ssot.html for the principle and the planned
   * Phase 2 work (generate the nav from a directory walk or a single YAML
   * manifest) that will eliminate the duplication.
   */
  const INTERNAL_SIDEBAR_NAV = [

    /* ────────────────────────── HANDBOOK ──────────────────────────────── */
    { kind: "section", label: "Documentation handbook" },
    {
      label: "Handbook",
      children: [
        { label: "Overview", path: "internal/handbook/index.html" },
        { label: "Principles", path: "internal/handbook/principles.html" },
        { label: "Style guide", path: "internal/handbook/style-guide.html" },
        { label: "Process", path: "internal/handbook/process.html" },
        {
          label: "Authoring workflows",
          children: [
            { label: "Add a page", path: "internal/handbook/authoring/add-a-page.html" },
            { label: "Add an ADR", path: "internal/handbook/authoring/add-an-adr.html" },
            { label: "Add an RFC", path: "internal/handbook/authoring/add-an-rfc.html" },
            { label: "Add an API spec", path: "internal/handbook/authoring/add-an-api-spec.html" },
            { label: "Add a runbook", path: "internal/handbook/authoring/add-a-runbook.html" },
            { label: "Update sidebar", path: "internal/handbook/authoring/update-sidebar.html" },
            { label: "History format", path: "internal/handbook/authoring/history-format.html" },
          ],
        },
        {
          label: "Templates",
          children: [
            { label: "Overview", path: "internal/handbook/templates/index.html" },
            { label: "ADR", path: "internal/handbook/templates/adr.html" },
            { label: "RFC", path: "internal/handbook/templates/rfc.html" },
            { label: "API spec", path: "internal/handbook/templates/api-spec.html" },
            { label: "Audit", path: "internal/handbook/templates/audit.html" },
            { label: "Data table", path: "internal/handbook/templates/data-table.html" },
            { label: "Service descriptor", path: "internal/handbook/templates/service-descriptor.html" },
          ],
        },
      ],
    },

    /* ────────────────────────── SERVICES ──────────────────────────────── */
    { kind: "section", label: "Services" },
    {
      label: "Service catalog",
      children: [
        { label: "Overview", path: "internal/services/index.html" },
        {
          label: "api",
          children: [
            { label: "Overview", path: "internal/services/api/index.html" },
            { label: "Architecture", path: "internal/services/api/architecture.html" },
            { label: "API reference", path: "internal/services/api/api-reference.html" },
            { label: "Runbooks", path: "internal/services/api/runbooks.html" },
            { label: "Dependencies", path: "internal/services/api/dependencies.html" },
            { label: "On-call", path: "internal/services/api/on-call.html" },
            { label: "Code reference (pdoc)", path: "internal/services/api/code-reference/index.html" },
          ],
        },
        {
          label: "portal",
          children: [
            { label: "Overview", path: "internal/services/portal/index.html" },
            { label: "Architecture", path: "internal/services/portal/architecture.html" },
            { label: "API reference", path: "internal/services/portal/api-reference.html" },
            { label: "Runbooks", path: "internal/services/portal/runbooks.html" },
            { label: "Dependencies", path: "internal/services/portal/dependencies.html" },
            { label: "On-call", path: "internal/services/portal/on-call.html" },
          ],
        },
        {
          label: "monitoring",
          children: [
            { label: "Overview", path: "internal/services/monitoring/index.html" },
            { label: "Architecture", path: "internal/services/monitoring/architecture.html" },
            { label: "API reference", path: "internal/services/monitoring/api-reference.html" },
            { label: "Runbooks", path: "internal/services/monitoring/runbooks.html" },
            { label: "Dependencies", path: "internal/services/monitoring/dependencies.html" },
            { label: "On-call", path: "internal/services/monitoring/on-call.html" },
          ],
        },
        {
          label: "ui-kit",
          children: [
            { label: "Overview", path: "internal/services/ui-kit/index.html" },
            { label: "Architecture", path: "internal/services/ui-kit/architecture.html" },
            { label: "Dependencies", path: "internal/services/ui-kit/dependencies.html" },
          ],
        },
      ],
    },

    /* ────────────────────────── TUTORIALS ─────────────────────────────── */
    { kind: "section", label: "Tutorials" },
    { label: "Onboarding from zero to endpoint", path: "internal/tutorials/onboarding-zero-to-endpoint.html" },
    { label: "QA onboarding", path: "internal/tutorials/qa/onboarding.html" },

    /* ─────────────────────────── HOW-TO ───────────────────────────────── */
    { kind: "section", label: "How-to" },
    {
      label: "How-to guides",
      children: [
        { label: "Overview", path: "internal/how-to/index.html" },
        {
          label: "Onboarding and implementation",
          children: [
            { label: "Onboarding from zero to endpoint and docs", path: "internal/tutorials/onboarding-zero-to-endpoint.html" },
            { label: "How to add POST /api/v1/contract", path: "internal/how-to/api/add-post-contract.html" },
          ],
        },
        {
          label: "Documentation operations",
          children: [
            { label: "Internal service docs layout and how to add pages", path: "internal/how-to/docs/internal-service-docs-layout.html" },
            { label: "How to change docs frontend safely", path: "internal/how-to/docs/change-docs-frontend-safely.html" },
          ],
        },
        {
          label: "Workflow and commands",
          children: [
            { label: "Make commands (reference)", path: "internal/reference/service/make-commands.html" },
          ],
        },
      ],
    },
    {
      label: "Runbooks",
      children: [
        { label: "Overview", path: "internal/how-to/incidents/runbooks/index.html" },
        { label: "Runbook template", path: "internal/how-to/incidents/runbooks/0000-template.html" },
        { label: "Tests failing", path: "internal/how-to/incidents/runbooks/0001-tests-failing.html" },
        { label: "Migrations failing", path: "internal/how-to/incidents/runbooks/0002-migrations-failing.html" },
        { label: "Logging failing", path: "internal/how-to/incidents/runbooks/0003-logging-failing.html" },
        { label: "Pre-commit failing", path: "internal/how-to/incidents/runbooks/0004-pre-commit-failing.html" },
        { label: "Quality check failing", path: "internal/how-to/incidents/runbooks/0005-quality-check-failing.html" },
        { label: "API security failing", path: "internal/how-to/incidents/runbooks/0006-api-security-failing.html" },
        { label: "OpenAPI contract test failing", path: "internal/how-to/incidents/runbooks/0007-openapi-contract-test-failing.html" },
        { label: "Observability scrape failing", path: "internal/how-to/incidents/runbooks/0008-observability-scrape-failing.html" },
        { label: "Error budget exhaustion", path: "internal/how-to/incidents/runbooks/0009-error-budget-exhaustion.html" },
        { label: "In-page TOC missing", path: "internal/how-to/incidents/runbooks/0010-in-page-toc-missing.html" },
      ],
    },
    {
      label: "Postmortems",
      children: [
        { label: "Overview", path: "internal/how-to/incidents/postmortems/index.html" },
        { label: "Postmortem template", path: "internal/how-to/incidents/postmortems/_template.html" },
      ],
    },

    /* ────────────────────────── REFERENCE ─────────────────────────────── */
    { kind: "section", label: "Reference" },
    {
      label: "API endpoints documentation",
      children: [
        { label: "Overview", path: "internal/reference/api/index.html" },
        {
          label: "Shared (cross-cutting)",
          children: [
            { label: "Specification template", path: "internal/reference/templates/api-spec.html" },
            { label: "Definition of Done", path: "internal/explanation/api/dod.html" },
            { label: "Idempotency", path: "internal/reference/api/_shared/idempotency.html" },
            { label: "Error envelope", path: "internal/reference/api/_shared/error-envelope.html" },
            { label: "Error catalog", path: "internal/reference/api/_shared/error-catalog.html" },
            { label: "Authentication & authorization", path: "internal/reference/api/_shared/auth.html" },
            { label: "Pagination", path: "internal/reference/api/_shared/pagination.html" },
            { label: "Versioning", path: "internal/reference/api/_shared/versioning.html" },
            { label: "Observability conventions", path: "internal/reference/api/_shared/observability-conventions.html" },
            { label: "Field conventions", path: "internal/reference/api/_shared/field-conventions.html" },
            { label: "OpenAPI authoring guide", path: "internal/reference/api/_shared/openapi-authoring-guide.html" },
            { label: "Error matrix (auto-generated)", path: "internal/reference/api/errors.html" },
          ],
        },
        {
          label: "User",
          expand: "on-descendant",
          children: [
            { label: "Overview", path: "internal/reference/api/user/index.html" },
            { label: "GET /user/", path: "internal/reference/api/user/operations/get-api-v1-user-system_uuid-system_user_id.html" },
            { label: "POST /user", path: "internal/reference/api/user/operations/post-api-v1-user.html" },
            { label: "PUT /user/", path: "internal/reference/api/user/operations/put-api-v1-user-system_uuid-system_user_id.html" },
            { label: "PATCH /user/", path: "internal/reference/api/user/operations/patch-api-v1-user-system_uuid-system_user_id.html" },
          ],
        },
        {
          label: "Conspectus",
          expand: "on-descendant",
          children: [
            { label: "Overview", path: "internal/reference/api/conspectus/index.html" },
            { label: "GET /conspectuses/due/", path: "internal/reference/api/conspectus/operations/get-api-v1-conspectuses-due.html" },
            { label: "GET /schedule/summary/", path: "internal/reference/api/conspectus/operations/get-api-v1-schedule-summary.html" },
            { label: "POST …/actions/review", path: "internal/reference/api/conspectus/operations/post-api-v1-conspectuses-conspectus_uuid-actions-review.html" },
            { label: "POST /conspectuses", path: "internal/reference/api/conspectus/operations/post-api-v1-conspectuses.html" },
            { label: "PATCH /conspectuses/{id}", path: "internal/reference/api/conspectus/operations/patch-api-v1-conspectuses-conspectus_uuid.html" },
          ],
        },
        {
          label: "Error log",
          expand: "on-descendant",
          children: [
            { label: "Overview", path: "internal/reference/api/error-log/index.html" },
            { label: "GET /errors/", path: "internal/reference/api/error-log/operations/get-api-v1-errors.html" },
            { label: "POST /errors", path: "internal/reference/api/error-log/operations/post-api-v1-errors.html" },
          ],
        },
      ],
    },
    {
      label: "Docs frontend documentation",
      children: [
        { label: "Overview", path: "internal/reference/front/index.html" },
        {
          label: "Foundations",
          children: [
            { label: "Style guide", path: "internal/reference/front/_shared/style-guide.html" },
            { label: "Maintenance process", path: "internal/reference/front/_shared/process.html" },
            { label: "Frontend glossary", path: "internal/reference/front/_shared/glossary.html" },
            { label: "Quick entry by role", path: "internal/reference/front/_shared/fast-entry-by-role.html" },
          ],
        },
        {
          label: "Spec templates",
          children: [
            { label: "Component spec template", path: "internal/reference/front/_shared/component-spec-template.html" },
            { label: "Foundation spec template", path: "internal/reference/front/_shared/foundation-spec-template.html" },
            { label: "Contract spec template", path: "internal/reference/front/_shared/contract-spec-template.html" },
            { label: "Definition of Done", path: "internal/reference/front/_shared/spec-definition-of-done.html" },
          ],
        },
        {
          label: "Architecture",
          children: [
            { label: "Architecture map", path: "internal/reference/front/architecture-map.html" },
          ],
        },
        {
          label: "Screens",
          children: [
            { label: "Screen spec template", path: "internal/reference/front/screens/docs-screen-template.html" },
            { label: "Engineering hub home", path: "internal/reference/front/screens/docs-screen-home-landing.html" },
            { label: "Backlog cockpit", path: "internal/reference/front/screens/docs-screen-backlog-cockpit.html" },
            { label: "Hall of Contributors", path: "internal/reference/front/screens/docs-screen-portal-hall-of-contributors.html" },
          ],
        },
        {
          label: "Components",
          children: [
            { label: "UI kit", path: "internal/reference/front/foundations/ui-kit.html" },
            { label: "Tooltips and inline hints", path: "internal/reference/front/components/tooltips.html" },
            { label: "Popup and overlay system", path: "internal/reference/front/components/popups-and-overlays.html" },
            { label: "Diagrams and lightbox", path: "internal/reference/front/components/diagrams-and-lightbox.html" },
            { label: "Resume reading and back-to-top", path: "internal/reference/front/components/resume-and-back-to-top.html" },
            { label: "Rocket launch animation", path: "internal/reference/front/components/rocket-launch-animation.html" },
            { label: "Bug report", path: "ui-kit/pages/components/bug-report.html" },
            { label: "Sticky On this page TOC", path: "internal/reference/front/components/sticky-toc.html" },
            { label: "Hotkeys", path: "internal/reference/front/foundations/hotkeys.html" },
          ],
        },
        {
          label: "Reference",
          children: [
            { label: "JavaScript modules", path: "internal/reference/front/foundations/js-modules.html" },
            { label: "CSS architecture", path: "internal/reference/front/foundations/css-architecture.html" },
            { label: "Token gallery (auto-generated)", path: "internal/reference/front/foundations/tokens.html" },
          ],
        },
        {
          label: "Cross-cutting systems",
          children: [
            { label: "Navigation and theme contract", path: "internal/reference/front/contracts/menu-and-theme.html" },
            { label: "Navigation, search, discovery", path: "internal/reference/front/contracts/navigation-search-and-discovery.html" },
            { label: "UI, motion, adaptivity", path: "internal/reference/front/foundations/motion-and-adaptivity.html" },
            { label: "Feedback and editorial workflow", path: "internal/reference/front/contracts/feedback-and-editorial-workflow.html" },
          ],
        },
        {
          label: "Patterns",
          children: [
            { label: "Long-form reading aids", path: "internal/reference/front/patterns/long-form-reading-aids.html" },
          ],
        },
      ],
    },

    /* ───────────────────────── EXPLANATION ────────────────────────────── */
    { kind: "section", label: "Explanation" },
    { label: "Methodology", path: "internal/explanation/methodology.html" },
    { label: "System design", path: "internal/explanation/system-design.html" },
    {
      label: "API concepts",
      children: [
        { label: "Definition of Done", path: "internal/explanation/api/dod.html" },
      ],
    },
    {
      label: "Dev concepts",
      children: [
        { label: "Requirements guide", path: "internal/explanation/dev/requirements.html" },
        { label: "Schemas and contracts", path: "internal/explanation/dev/schemas-and-contracts.html" },
        { label: "Business logic guide", path: "internal/explanation/dev/business-logic.html" },
      ],
    },
    {
      label: "QA strategy & process",
      children: [
        { label: "Test strategy", path: "internal/explanation/qa/test-strategy.html" },
        { label: "Test pyramid & layer ownership", path: "internal/explanation/qa/test-pyramid.html" },
        { label: "QA process & SDLC integration", path: "internal/explanation/qa/qa-process.html" },
      ],
    },
    {
      label: "SRE foundations",
      children: [
        { label: "SLOs & error budget", path: "internal/explanation/sre/slos.html" },
        { label: "Monitoring", path: "internal/explanation/sre/monitoring.html" },
        { label: "Logging", path: "internal/explanation/sre/logging.html" },
        { label: "Observability", path: "internal/explanation/sre/observability.html" },
        { label: "On-call", path: "internal/explanation/sre/on-call.html" },
        { label: "Incident response", path: "internal/explanation/sre/incident-response.html" },
        { label: "Debugging", path: "internal/explanation/sre/debugging.html" },
      ],
    },
    /* ────────────────────────── GOVERNANCE ────────────────────────────── */
    { kind: "section", label: "Decision log & audits" },
    { label: "Backlog", path: "internal/governance/backlog/index.html" },
    {
      label: "ADRs",
      children: [
        { label: "Overview", path: "internal/governance/adr/index.html" },
        {
          label: "Shared (cross-cutting)",
          children: [
            { label: "ADR template", path: "internal/reference/templates/adr.html" },
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
            { label: "RFC template", path: "internal/reference/templates/rfc.html" },
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
      label: "Audit",
      children: [
        { label: "Overview", path: "internal/governance/audits/index.html" },
        {
          label: "Shared (cross-cutting)",
          children: [
            { label: "Assessment template", path: "internal/reference/templates/audit.html" },
          ],
        },
        {
          label: "REST API audit",
          children: [
            { label: "REST API 2026-05-25", path: "internal/governance/audits/api/2026-05-25-rest-api-assessment.html" },
          ],
        },
        {
          label: "Bug audit",
          children: [
            { label: "Bug audit 2026-05-25", path: "internal/governance/audits/bugs/2026-05-25-portal-bug-audit.html" },
          ],
        },
        {
          label: "DX audit",
          children: [
            { label: "DX 2026-05-25", path: "internal/governance/audits/docs/2026-05-25-documentation-experience-assessment.html" },
          ],
        },
        {
          label: "Project maturity audit",
          children: [
            { label: "Project Maturity 2026-05-25", path: "internal/governance/audits/maturity/2026-05-25-project-maturity-assessment.html" },
          ],
        },
        {
          label: "UI/UX audit",
          children: [
            { label: "UI/UX 2026-05-25", path: "internal/governance/audits/ui-ux/2026-05-25-ui-ux-assessment.html" },
          ],
        },
      ],
    },

    /* ──────────────────────────── TEAM ────────────────────────────────── */
    { kind: "section", label: "Team" },
    { label: "People & maintainers", path: "internal/team/people/index.html" },
    {
      label: "Manager",
      children: [
        { label: "Overview", path: "internal/roles/manager/index.html" },
        { label: "SDLC RACI matrix", path: "internal/reference/manager/sdlc-raci-matrix.html" },
        { label: "Tech radar", path: "internal/roles/manager/radar.html" },
        {
          label: "Practice handbook (25)",
          children: [
            { label: "01 · Ab Testing", path: "internal/roles/manager/practices/ab-testing.html" },
            { label: "02 · Continuous Discovery", path: "internal/roles/manager/practices/continuous-discovery.html" },
            { label: "03 · Customer Journey Map", path: "internal/roles/manager/practices/customer-journey-map.html" },
            { label: "04 · Decision Raci", path: "internal/roles/manager/practices/decision-raci.html" },
            { label: "05 · Definition Ready Done", path: "internal/roles/manager/practices/definition-ready-done.html" },
            { label: "06 · Dual Track Agile", path: "internal/roles/manager/practices/dual-track-agile.html" },
            { label: "07 · Funnel Cohort Analytics", path: "internal/roles/manager/practices/funnel-cohort-analytics.html" },
            { label: "08 · Go To Market", path: "internal/roles/manager/practices/go-to-market.html" },
            { label: "09 · Heart Framework", path: "internal/roles/manager/practices/heart-framework.html" },
            { label: "10 · Impact Mapping", path: "internal/roles/manager/practices/impact-mapping.html" },
            { label: "11 · Jtbd", path: "internal/roles/manager/practices/jtbd.html" },
            { label: "12 · North Star Metric", path: "internal/roles/manager/practices/north-star-metric.html" },
            { label: "13 · Now Next Later Roadmap", path: "internal/roles/manager/practices/now-next-later-roadmap.html" },
            { label: "14 · Okrs", path: "internal/roles/manager/practices/okrs.html" },
            { label: "15 · Opportunity Solution Tree", path: "internal/roles/manager/practices/opportunity-solution-tree.html" },
            { label: "16 · Product Brief", path: "internal/roles/manager/practices/product-brief.html" },
            { label: "17 · Product Health Dashboard", path: "internal/roles/manager/practices/product-health-dashboard.html" },
            { label: "18 · Product Postmortem", path: "internal/roles/manager/practices/product-postmortem.html" },
            { label: "19 · Product Review Cadence", path: "internal/roles/manager/practices/product-review-cadence.html" },
            { label: "20 · Product Vision", path: "internal/roles/manager/practices/product-vision.html" },
            { label: "21 · Rice Prioritisation", path: "internal/roles/manager/practices/rice-prioritisation.html" },
            { label: "22 · Stakeholder Alignment", path: "internal/roles/manager/practices/stakeholder-alignment.html" },
            { label: "23 · Story Mapping", path: "internal/roles/manager/practices/story-mapping.html" },
            { label: "24 · User Research Synthesis", path: "internal/roles/manager/practices/user-research-synthesis.html" },
            { label: "25 · Working Backwards", path: "internal/roles/manager/practices/working-backwards.html" },
          ],
        },
      ],
    },
    {
      label: "SA",
      children: [
        { label: "Overview", path: "internal/roles/sa/index.html" },
        { label: "Methodology", path: "internal/explanation/methodology.html" },
        { label: "System design", path: "internal/explanation/system-design.html" },
        { label: "Tech radar", path: "internal/roles/sa/radar.html" },
        {
          label: "Practice handbook (25)",
          children: [
            { label: "All 25 practices",                path: "internal/roles/sa/practices/index.html" },
            { label: "01 · Design Docs",                path: "internal/roles/sa/practices/design-docs.html" },
            { label: "02 · ADR · RFC",                  path: "internal/roles/sa/practices/decision-records.html" },
            { label: "03 · SSOT",                       path: "internal/roles/sa/practices/ssot.html" },
            { label: "04 · Glossary",                   path: "internal/roles/sa/practices/glossary.html" },
            { label: "05 · Tech Radar",                 path: "internal/roles/sa/practices/tech-radar.html" },
            { label: "06 · C4 + PlantUML",              path: "internal/roles/sa/practices/c4-plantuml.html" },
            { label: "07 · ER model",                   path: "internal/roles/sa/practices/er-model.html" },
            { label: "08 · OpenAPI contract-first",     path: "internal/roles/sa/practices/openapi-contract-first.html" },
            { label: "09 · AsyncAPI",                   path: "internal/roles/sa/practices/asyncapi.html" },
            { label: "10 · DDD bounded contexts",       path: "internal/roles/sa/practices/ddd-bounded-contexts.html" },
            { label: "11 · Diátaxis",                   path: "internal/roles/sa/practices/diataxis.html" },
            { label: "12 · Docs as code",               path: "internal/roles/sa/practices/docs-as-code.html" },
            { label: "13 · Template registry",          path: "internal/roles/sa/practices/single-authoring-model.html" },
            { label: "14 · Style guide as code",        path: "internal/roles/sa/practices/style-guide.html" },
            { label: "15 · Onboarding · a11y",          path: "internal/roles/sa/practices/onboarding-a11y.html" },
            { label: "16 · SLO · SLI · error budgets",  path: "internal/roles/sa/practices/slo-sli-error-budgets.html" },
            { label: "17 · Runbooks",                   path: "internal/roles/sa/practices/runbooks.html" },
            { label: "18 · Blameless postmortems",      path: "internal/roles/sa/practices/postmortems.html" },
            { label: "19 · Risk register",              path: "internal/roles/sa/practices/risk-register.html" },
            { label: "20 · Capacity · FinOps",          path: "internal/roles/sa/practices/capacity-finops.html" },
            { label: "21 · SECURITY · threat model",    path: "internal/roles/sa/practices/security-threat-modeling.html" },
            { label: "22 · Service catalog",            path: "internal/roles/sa/practices/service-catalog.html" },
            { label: "23 · AI-augmented docs",          path: "internal/roles/sa/practices/ai-augmented-docs.html" },
            { label: "24 · Stakeholder map · JTBD",     path: "internal/roles/sa/practices/stakeholder-map.html" },
            { label: "25 · RACI · release · review",    path: "internal/roles/sa/practices/raci-release.html" },
          ],
        },
      ],
    },
    {
      label: "Architect",
      children: [
        { label: "Overview", path: "internal/roles/architect/index.html" },
        { label: "Tech radar", path: "internal/roles/architect/radar.html" },
        {
          label: "Practice handbook (25)",
          children: [
            { label: "01 · Domain-Driven Design",       path: "internal/roles/architect/practices/domain-driven-design.html" },
            { label: "02 · Event-Driven Architecture",  path: "internal/roles/architect/practices/event-driven-architecture.html" },
            { label: "03 · C4 Model Diagrams",          path: "internal/roles/architect/practices/c4-model.html" },
            { label: "04 · Fitness Functions",          path: "internal/roles/architect/practices/fitness-functions.html" },
            { label: "05 · Hexagonal Architecture",     path: "internal/roles/architect/practices/hexagonal-architecture.html" },
            { label: "06 · Technology Radar",           path: "internal/roles/architect/practices/technology-radar.html" },
            { label: "07 · Build vs Buy vs OSS",        path: "internal/roles/architect/practices/build-vs-buy.html" },
            { label: "08 · Technical Roadmapping",      path: "internal/roles/architect/practices/technical-roadmapping.html" },
            { label: "09 · PoC & Spike",                path: "internal/roles/architect/practices/poc-spike.html" },
            { label: "10 · API-First Design",           path: "internal/roles/architect/practices/api-first-design.html" },
            { label: "11 · ADR Process",                path: "internal/roles/architect/practices/adr-process.html" },
            { label: "12 · RFC Process",                path: "internal/roles/architect/practices/rfc-process.html" },
            { label: "13 · Architecture Review",        path: "internal/roles/architect/practices/architecture-review.html" },
            { label: "14 · Stakeholder Mapping",        path: "internal/roles/architect/practices/stakeholder-mapping.html" },
            { label: "15 · Design Docs",                path: "internal/roles/architect/practices/design-docs.html" },
            { label: "16 · NFR Definition",             path: "internal/roles/architect/practices/nfr-definition.html" },
            { label: "17 · SLO & SLA Design",           path: "internal/roles/architect/practices/slo-sla-design.html" },
            { label: "18 · Chaos Engineering",          path: "internal/roles/architect/practices/chaos-engineering.html" },
            { label: "19 · Threat Modeling",            path: "internal/roles/architect/practices/threat-modeling.html" },
            { label: "20 · Capacity & FinOps",          path: "internal/roles/architect/practices/capacity-finops.html" },
            { label: "21 · Tech Debt Management",       path: "internal/roles/architect/practices/tech-debt-management.html" },
            { label: "22 · Engineering Principles",     path: "internal/roles/architect/practices/engineering-principles.html" },
            { label: "23 · Team Topologies",            path: "internal/roles/architect/practices/team-topologies.html" },
            { label: "24 · Architecture Mentoring",     path: "internal/roles/architect/practices/architecture-mentoring.html" },
            { label: "25 · Architecture Retrospective", path: "internal/roles/architect/practices/architecture-retrospective.html" },
          ],
        },
      ],
    },
    {
      label: "Developer",
      children: [
        { label: "Overview", path: "internal/roles/dev/index.html" },
        {
          label: "Core architecture and contracts",
          children: [
            { label: "Requirements guide", path: "internal/explanation/dev/requirements.html" },
            { label: "Schemas and contracts", path: "internal/explanation/dev/schemas-and-contracts.html" },
            { label: "Business logic guide", path: "internal/explanation/dev/business-logic.html" },
            { label: "Error matrix by status", path: "internal/reference/api/error-matrix-by-status.html" },
          ],
        },
        {
          label: "Database tables",
          children: [
            { label: "Overview", path: "internal/reference/data/index.html" },
            { label: "Template", path: "internal/reference/templates/data-table.html" },
            {
              label: "Core",
              children: [
                { label: "users", path: "internal/reference/data/users.html" },
              ],
            },
            {
              label: "Reference",
              children: [
                { label: "systems", path: "internal/reference/data/systems.html" },
                { label: "invalidation_reasons", path: "internal/reference/data/invalidation_reasons.html" },
                { label: "timezones", path: "internal/reference/data/timezones.html" },
              ],
            },
          ],
        },
        {
          label: "Delivery workflow and operations",
          children: [
            { label: "Make commands and workflows", path: "internal/how-to/service/make-commands-and-workflows.html" },
            { label: "Local development", path: "internal/how-to/service/local-development.html" },
            { label: "Docker image and container", path: "internal/how-to/service/docker-image-and-container.html" },
            { label: "API load testing", path: "internal/how-to/api/api-load-testing.html" },
            { label: "Documentation pipeline", path: "internal/how-to/docs/docs-pipeline.html" },
          ],
        },
        { label: "See: How-to guides", path: "internal/how-to/index.html" },

        { label: "Tech radar", path: "internal/roles/dev/radar.html" },
        {
          label: "Practice handbook (25)",
          children: [
            { label: "All 25 practices",                  path: "internal/roles/dev/practices/index.html" },
            { label: "01 · Trunk-Based Development",      path: "internal/roles/dev/practices/trunk-based-development.html" },
            { label: "02 · Test-Driven Development",      path: "internal/roles/dev/practices/test-driven-development.html" },
            { label: "03 · Small PRs",                    path: "internal/roles/dev/practices/small-prs.html" },
            { label: "04 · Pair & Mob Programming",       path: "internal/roles/dev/practices/pair-mob-programming.html" },
            { label: "05 · Continuous Refactoring",       path: "internal/roles/dev/practices/continuous-refactoring.html" },
            { label: "06 · CI & green-trunk discipline",  path: "internal/roles/dev/practices/ci-green-trunk.html" },
            { label: "07 · Feature Flags",                path: "internal/roles/dev/practices/feature-flags.html" },
            { label: "08 · Pre-commit hooks",             path: "internal/roles/dev/practices/pre-commit-hooks.html" },
            { label: "09 · Conventional Commits",         path: "internal/roles/dev/practices/conventional-commits.html" },
            { label: "10 · Progressive Delivery",         path: "internal/roles/dev/practices/progressive-delivery.html" },
            { label: "11 · Twelve-Factor App",            path: "internal/roles/dev/practices/twelve-factor-app.html" },
            { label: "12 · API Contract-First",           path: "internal/roles/dev/practices/api-contract-first.html" },
            { label: "13 · DDD tactical patterns",        path: "internal/roles/dev/practices/ddd-tactical.html" },
            { label: "14 · Type safety",                  path: "internal/roles/dev/practices/type-safety.html" },
            { label: "15 · Design Docs & RFCs",           path: "internal/roles/dev/practices/design-docs.html" },
            { label: "16 · Structured Logging",           path: "internal/roles/dev/practices/structured-logging.html" },
            { label: "17 · Distributed Tracing",          path: "internal/roles/dev/practices/distributed-tracing.html" },
            { label: "18 · SLOs in code",                 path: "internal/roles/dev/practices/slos-in-code.html" },
            { label: "19 · Error monitoring",             path: "internal/roles/dev/practices/error-monitoring.html" },
            { label: "20 · Performance budgets",          path: "internal/roles/dev/practices/performance-budgets.html" },
            { label: "21 · Reproducible dev env",         path: "internal/roles/dev/practices/devcontainers.html" },
            { label: "22 · Docs-as-Code",                 path: "internal/roles/dev/practices/docs-as-code.html" },
            { label: "23 · Tech-Debt Register",           path: "internal/roles/dev/practices/tech-debt-register.html" },
            { label: "24 · CODEOWNERS & inner-source",    path: "internal/roles/dev/practices/codeowners.html" },
            { label: "25 · Continuous Learning",          path: "internal/roles/dev/practices/continuous-learning.html" },
          ],
        },
      ],
    },
    {
      label: "QA",
      children: [
        { label: "Overview", path: "internal/roles/qa/index.html" },
        {
          label: "Foundations",
          children: [
            { label: "Test strategy", path: "internal/explanation/qa/test-strategy.html" },
            { label: "Test pyramid & layer ownership", path: "internal/explanation/qa/test-pyramid.html" },
            { label: "QA process & SDLC integration", path: "internal/explanation/qa/qa-process.html" },
            { label: "Tester onboarding", path: "internal/tutorials/qa/onboarding.html" },
            { label: "QA glossary", path: "internal/reference/qa/glossary.html" },
          ],
        },
        {
          label: "Templates",
          children: [
            { label: "Test case template", path: "internal/reference/qa/templates/test-case-template.html" },
            { label: "Bug report template", path: "internal/reference/qa/templates/bug-report-template.html" },
            { label: "Test plan template", path: "internal/reference/qa/templates/test-plan-template.html" },
          ],
        },
        {
          label: "Playbooks",
          children: [
            { label: "API endpoint testing", path: "internal/how-to/api/api-endpoint-testing.html" },
            { label: "Documentation testing", path: "internal/how-to/qa/documentation-testing.html" },
            { label: "Release smoke testing", path: "internal/how-to/qa/release-smoke.html" },
            { label: "Exploratory testing", path: "internal/how-to/qa/exploratory-testing.html" },
            { label: "Accessibility testing", path: "internal/how-to/qa/accessibility-testing.html" },
          ],
        },
        {
          label: "Checklists",
          children: [
            { label: "0001 — Documentation pages visual", path: "internal/reference/qa/checklists/0001-documentation-pages-visual-checklist.html" },
            { label: "0002 — API endpoint acceptance", path: "internal/reference/qa/checklists/0002-api-endpoint-acceptance-checklist.html" },
            { label: "0003 — Release smoke", path: "internal/reference/qa/checklists/0003-release-smoke-checklist.html" },
            { label: "0004 — Regression", path: "internal/reference/qa/checklists/0004-regression-checklist.html" },
            { label: "0005 — Accessibility (WCAG 2.1 AA)", path: "internal/reference/qa/checklists/0005-accessibility-checklist.html" },
          ],
        },
        {
          label: "Reference",
          children: [
            { label: "Severity & priority matrix", path: "internal/reference/qa/bug-severity-and-priority.html" },
            { label: "Defect lifecycle", path: "internal/reference/qa/defect-lifecycle.html" },
            { label: "Test environments", path: "internal/reference/qa/test-environments.html" },
          ],
        },

        { label: "Tech radar", path: "internal/roles/qa/radar.html" },
        {
          label: "Practice handbook (25)",
          children: [
            { label: "01 · Risk-based Testing",            path: "internal/roles/qa/practices/risk-based-testing.html" },
            { label: "02 · Test Pyramid Design",           path: "internal/roles/qa/practices/test-pyramid-design.html" },
            { label: "03 · Shift-left Testing",            path: "internal/roles/qa/practices/shift-left-testing.html" },
            { label: "04 · Test Oracle Definition",        path: "internal/roles/qa/practices/test-oracle-definition.html" },
            { label: "05 · Test Environment Design",       path: "internal/roles/qa/practices/test-environment-design.html" },
            { label: "06 · Boundary Value Analysis",       path: "internal/roles/qa/practices/boundary-value-analysis.html" },
            { label: "07 · Equivalence Partitioning",      path: "internal/roles/qa/practices/equivalence-partitioning.html" },
            { label: "08 · Decision Table Testing",        path: "internal/roles/qa/practices/decision-table-testing.html" },
            { label: "09 · Exploratory Charters",          path: "internal/roles/qa/practices/exploratory-charters.html" },
            { label: "10 · Scenario-based Testing",        path: "internal/roles/qa/practices/scenario-based-testing.html" },
            { label: "11 · Contract Testing",              path: "internal/roles/qa/practices/contract-testing.html" },
            { label: "12 · API Acceptance Testing",        path: "internal/roles/qa/practices/api-acceptance-testing.html" },
            { label: "13 · Visual Regression Testing",     path: "internal/roles/qa/practices/visual-regression-testing.html" },
            { label: "14 · Accessibility Automation",      path: "internal/roles/qa/practices/accessibility-automation.html" },
            { label: "15 · CI Quality Gates",              path: "internal/roles/qa/practices/ci-quality-gates.html" },
            { label: "16 · Defect Triage",                 path: "internal/roles/qa/practices/defect-triage.html" },
            { label: "17 · Escape Rate Tracking",          path: "internal/roles/qa/practices/escape-rate-tracking.html" },
            { label: "18 · Root Cause Analysis",           path: "internal/roles/qa/practices/root-cause-analysis.html" },
            { label: "19 · Quality Dashboarding",          path: "internal/roles/qa/practices/quality-dashboarding.html" },
            { label: "20 · Release Sign-off",              path: "internal/roles/qa/practices/release-sign-off.html" },
            { label: "21 · Three Amigos",                  path: "internal/roles/qa/practices/three-amigos.html" },
            { label: "22 · Test Plan Authoring",           path: "internal/roles/qa/practices/test-plan-authoring.html" },
            { label: "23 · Regression Suite Management",   path: "internal/roles/qa/practices/regression-suite-management.html" },
            { label: "24 · QA Retrospective",              path: "internal/roles/qa/practices/qa-retrospective.html" },
            { label: "25 · Quality Advocacy",              path: "internal/roles/qa/practices/quality-advocacy.html" },
          ],
        },
      ],
    },
    {
      label: "SRE",
      children: [
        { label: "Overview", path: "internal/roles/sre/index.html" },
        {
          label: "Reliability foundations",
          children: [
            { label: "SLOs & error budget", path: "internal/explanation/sre/slos.html" },
            { label: "Monitoring", path: "internal/explanation/sre/monitoring.html" },
            { label: "Logging", path: "internal/explanation/sre/logging.html" },
            { label: "Observability", path: "internal/explanation/sre/observability.html" },
          ],
        },
        {
          label: "Operations",
          children: [
            { label: "On-call", path: "internal/explanation/sre/on-call.html" },
            { label: "Incident response", path: "internal/explanation/sre/incident-response.html" },
            { label: "Debugging", path: "internal/explanation/sre/debugging.html" },
          ],
        },
        {
          label: "Postmortems",
          children: [
            { label: "Overview", path: "internal/how-to/incidents/postmortems/index.html" },
            { label: "Postmortem template", path: "internal/how-to/incidents/postmortems/_template.html" },
          ],
        },
        {
          label: "Runbooks",
          children: [
            { label: "Overview", path: "internal/how-to/incidents/runbooks/index.html" },
            {
              label: "Shared (cross-cutting)",
              children: [
                { label: "Runbook template", path: "internal/how-to/incidents/runbooks/0000-template.html" },
              ],
            },
            {
              label: "CI and local quality failures",
              children: [
                { label: "Tests failing", path: "internal/how-to/incidents/runbooks/0001-tests-failing.html" },
                { label: "Pre-commit failing", path: "internal/how-to/incidents/runbooks/0004-pre-commit-failing.html" },
                { label: "Quality check failing", path: "internal/how-to/incidents/runbooks/0005-quality-check-failing.html" },
                { label: "OpenAPI contract test failing", path: "internal/how-to/incidents/runbooks/0007-openapi-contract-test-failing.html" },
              ],
            },
            {
              label: "Data and migration failures",
              children: [{ label: "Migrations failing", path: "internal/how-to/incidents/runbooks/0002-migrations-failing.html" }],
            },
            {
              label: "Security and API guardrails",
              children: [{ label: "API security failing", path: "internal/how-to/incidents/runbooks/0006-api-security-failing.html" }],
            },
            {
              label: "Observability and reliability incidents",
              children: [
                { label: "Logging failing", path: "internal/how-to/incidents/runbooks/0003-logging-failing.html" },
                { label: "Observability scrape failing", path: "internal/how-to/incidents/runbooks/0008-observability-scrape-failing.html" },
                { label: "Error budget exhaustion", path: "internal/how-to/incidents/runbooks/0009-error-budget-exhaustion.html" },
              ],
            },
            {
              label: "Docs frontend incidents",
              children: [{ label: "In-page TOC missing", path: "internal/how-to/incidents/runbooks/0010-in-page-toc-missing.html" }],
            },
          ],
        },
        { label: "Tech radar", path: "internal/roles/sre/radar.html" },
        {
          label: "Practice handbook (25)",
          children: [
            { label: "01 · Alerting Design", path: "internal/roles/sre/practices/alerting-design.html" },
            { label: "02 · Blameless Postmortem", path: "internal/roles/sre/practices/blameless-postmortem.html" },
            { label: "03 · Capacity Planning", path: "internal/roles/sre/practices/capacity-planning.html" },
            { label: "04 · Chaos Engineering", path: "internal/roles/sre/practices/chaos-engineering.html" },
            { label: "05 · Cicd Reliability", path: "internal/roles/sre/practices/cicd-reliability.html" },
            { label: "06 · Compliance Automation", path: "internal/roles/sre/practices/compliance-automation.html" },
            { label: "07 · Deployment Health", path: "internal/roles/sre/practices/deployment-health.html" },
            { label: "08 · Distributed Tracing", path: "internal/roles/sre/practices/distributed-tracing.html" },
            { label: "09 · Game Days", path: "internal/roles/sre/practices/game-days.html" },
            { label: "10 · Incident Command", path: "internal/roles/sre/practices/incident-command.html" },
            { label: "11 · Incident Severity", path: "internal/roles/sre/practices/incident-severity.html" },
            { label: "12 · Metrics Dashboards", path: "internal/roles/sre/practices/metrics-dashboards.html" },
            { label: "13 · On Call Handbook", path: "internal/roles/sre/practices/on-call-handbook.html" },
            { label: "14 · Progressive Delivery", path: "internal/roles/sre/practices/progressive-delivery.html" },
            { label: "15 · Reliability Tiering", path: "internal/roles/sre/practices/reliability-tiering.html" },
            { label: "16 · Rollback Playbook", path: "internal/roles/sre/practices/rollback-playbook.html" },
            { label: "17 · Runbooks", path: "internal/roles/sre/practices/runbooks.html" },
            { label: "18 · Secret Management", path: "internal/roles/sre/practices/secret-management.html" },
            { label: "19 · Security Posture", path: "internal/roles/sre/practices/security-posture.html" },
            { label: "20 · Slo Error Budget", path: "internal/roles/sre/practices/slo-error-budget.html" },
            { label: "21 · Structured Logging", path: "internal/roles/sre/practices/structured-logging.html" },
            { label: "22 · Supply Chain Security", path: "internal/roles/sre/practices/supply-chain-security.html" },
            { label: "23 · Synthetic Monitoring", path: "internal/roles/sre/practices/synthetic-monitoring.html" },
            { label: "24 · Toil Reduction", path: "internal/roles/sre/practices/toil-reduction.html" },
            { label: "25 · Vulnerability Mgmt", path: "internal/roles/sre/practices/vulnerability-mgmt.html" },
          ],
        },
      ],
    },
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
      "assets",
      "explanation",
      "governance",
      "how-to",
      "internal",
      "public",
      "reference",
      "roles",
      "services",
      "team",
      "tutorials",
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
