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
