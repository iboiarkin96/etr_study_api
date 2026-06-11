# services/portal — Documentation portal

The Docs-as-Code content tree. Public Diátaxis-shaped layer at `public/`, internal handbook + governance at `internal/`. UI Kit + frontend artefacts live in the sibling service [`services/frontend/portal/`](../frontend/portal/).

## Contents

| Section | What you find |
| ------- | ------------- |
| [Quick start](#quick-start) | Open the portal locally |
| [Structure](#structure) | What goes where |
| [Editing docs](#editing-docs) | Authoring workflow |
| [Make targets](#make-targets) | docs-fix / docs-check / docs-a11y |
| [Cross-references](#cross-references) | ADRs, handbook, RFCs |

## Quick start

The portal is plain HTML — open `services/portal/index.html` in a browser or serve the tree with any static server. Serve from `services/` (not `services/portal/`) so the portal can reach its sibling frontend assets at `../frontend/portal/assets_v2/`:

```bash
python3 -m http.server -d services 8080
# then open http://127.0.0.1:8080/portal/
```

Or run the docs-fix pipeline first to regenerate auto-content (pdoc, search index, marker-driven sections):

```bash
make docs-fix    # pdoc + sync_docs + render_docs + Pagefind
make docs-check  # drift gate (used in CI)
```

## Structure

| Path | What it is |
| ---- | ---------- |
| `public/` | Public Diátaxis tree — `tutorials/`, `how-to/`, `reference/`, `explanation/`. Includes the static Swagger UI under `public/reference/api/`. |
| `internal/handbook/` | SA / dev / SRE / QA reference + how-tos (lens-chip canon per ADR 0031). |
| `internal/governance/` | ADRs (`adr/`), RFCs (`rfc/`), audit reports (`audits/`), backlog (`backlog/`), traceability matrices (`traceability/`). |
| `internal/services/` | Per-service catalog cards (Backstage-style) — `api/`, `portal/`, `monitoring/`, `datastore/`, `ui-kit/`. Each is rendered from `catalog-info.yaml` by `tools/docs/render_service_descriptors.py`. |
| `internal/team/` | People + role hubs. |
| `internal/onboarding/` | Onboarding tracks. |
| `index.html` | Portal landing page. |

The static frontend (CSS, JS, UI Kit v2, Pagefind bundle, rendered UML) lives at [`services/frontend/portal/`](../frontend/portal/) — separate service.

## Editing docs

- **Add or edit a page:** [`internal/handbook/sa/authoring/add-a-page.html`](internal/handbook/sa/authoring/add-a-page.html).
- **Templates:** every page type has a template under [`internal/handbook/sa/templates/`](internal/handbook/sa/templates/).
- **Style guide:** [`internal/handbook/sa/style-guide.html`](internal/handbook/sa/style-guide.html).
- **Diátaxis quadrants:** see [ADR 0024](internal/governance/adr/0024-architecture-and-quality-assessment-documents.html) and the per-page audit at [`internal/governance/audits/diataxis-quadrant-audit-2026-05-26.html`](internal/governance/audits/diataxis-quadrant-audit-2026-05-26.html).

## Make targets

| Command | What it does |
| ------- | ------------ |
| `make docs-fix` | UML → SVG, marker-driven sync, HTML repair + format, pdoc → `code-reference/`, Pagefind index rebuild |
| `make docs-check` | Drift gate — fails if `docs-fix` would change anything (CI uses this) |
| `make docs-html-check` | Pages validate as well-formed HTML |
| `make docs-design-check` | Card/skeleton/mount baseline checks |
| `make docs-a11y-check` | WCAG baseline (headings, landmarks, contrast, keyboard) |
| `make docs-feedback-check` | Page-level feedback control wiring |
| `make docs-spec-check` | API operation specs + frontend typed specs |
| `make catalog-render` | Re-render the service catalog from `internal/services/*/catalog-info.yaml` |
| `make catalog-render-check` | Catalog drift gate (used in pre-commit) |

## Cross-references

- **Docs-as-Code policy:** [ADR 0001](internal/governance/adr/0001-docs-as-code.html), [ADR 0030](internal/governance/adr/0030-portal-shell-token-contract.html), [ADR 0031](internal/governance/adr/0031-foundations-handbook-canon-explanation-and-lens-chips.html).
- **Frontend kit:** [`services/frontend/portal/CHANGELOG.md`](../frontend/portal/CHANGELOG.md).
- **API service:** [`services/api/README.md`](../api/README.md).
- **Monitoring stack:** [`services/monitoring/README.md`](../monitoring/README.md).
- **Changelog:** [`services/portal/CHANGELOG.md`](CHANGELOG.md).
