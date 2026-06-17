# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- **services/api:** bumped `starlette` 1.0.1 → 1.3.1 to close four CVEs
  flagged by `pip-audit`:
  - CVE-2026-48818 — Windows SSRF in `StaticFiles` via UNC paths (fix ≥ 1.1.0).
  - CVE-2026-48817 — `HTTPEndpoint` dispatches arbitrary attributes for
    non-standard HTTP verbs when `methods=` is omitted (fix ≥ 1.1.0).
  - CVE-2026-54283 — `request.form()` ignores `max_fields` / `max_part_size`
    on `application/x-www-form-urlencoded` bodies; sub-10 MB payload can
    block the event loop or force unbounded allocation. DoS without auth
    (fix ≥ 1.3.1).
  - CVE-2026-54282 — `request.url` reconstruction lets a malformed path
    move the authority boundary, making `request.url.hostname` attacker-
    controlled in middleware / 404-handlers (fix ≥ 1.3.0).

  FastAPI 0.135.3 runs cleanly against starlette 1.3.1 — verified by
  `make -C services/api verify` (deps-audit + openapi + contract + tests
  at 91 % coverage).

### Changed

- **ci:** `changelog` job in `.github/workflows/ci.yml` now runs on PRs into
  `staging` (and pushes to `staging`), not only into `main`/`master`. Closes
  the gap where a `services/api/` change could land on staging without a
  CHANGELOG entry and only surface at the `staging → main` PR.

### Removed

- **operating-model:** retired four sub-pages now subsumed by the rest of the
  section — `domain-model.html`, `cross-service-workflows.html`,
  `information-architecture.html`, `whats-new-in-how-we-work.html`. The
  paired meta-log coupling gate (`check_meta_changes_logged` pre-commit hook
  + script reference) is disabled.

### Changed

- **operating-model hub** (`services/portal/internal/operating-model/index.html`)
  trimmed to three sections — Start here (one SVG mental anchor),
  What to read (four reference pages in author-order), and Starting a new
  page (single outbound pill to handbook templates). Mixed-genre «five
  rules» and duplicated Quick answers / tour CTAs removed.
- **operating-model · quality-gates-map** D-section rebuilt from a
  five-column table into numbered cards with bullets; meta-log row dropped
  from Table A and the two feed-coupling cells in Table C blanked.
- **operating-model · history footers** added to all six remaining
  sub-pages (canonical `docs-history` block).
- **services/portal · entity card + dependencies page** updated to show
  Pagefind as a build-time and runtime dependency (ADR 0033 already
  switched the search engine; the catalog descriptor hadn't caught up).
