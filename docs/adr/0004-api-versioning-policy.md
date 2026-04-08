# ADR 0004: API Versioning Policy

## Status

Accepted

## Context

The project exposes a public HTTP API contract used by external clients.
Without explicit versioning and compatibility governance, contract evolution can
introduce regressions, hidden breaking changes, and expensive client migration.

## Decision

Adopt path-based major versioning and additive contract evolution by default.

1. Major API version is encoded in URL prefix (current: `/api/v1`).
2. `v1` accepts only backward-compatible changes.
3. Breaking changes require a new major version (for example `/api/v2`).
4. Error contract semantics for existing `code`/`key` pairs are immutable.
5. Deprecated contract elements must keep a migration window of at least
   90 days (or two release cycles, whichever is longer).

## Compatibility Rules

### Breaking changes (forbidden inside same major)

- Endpoint removal or rename.
- Field removal, rename, type change, or semantic change.
- Existing optional field becoming required.
- Enum value removal or semantic repurposing.
- Repurposing existing business/validation error `code` and `key`.

### Non-breaking changes (allowed inside same major)

- Adding new endpoints.
- Adding optional fields.
- Adding new error codes with new keys.
- Documentation/example improvements without runtime behavior change.

## Deprecation Policy

When deprecating behavior, document migration path and timeline in:

- `README.md`
- `docs/index.html`
- ADR notes (if policy-level)

If deprecation headers are enabled, use:

- `Deprecation: true`
- `Sunset: <date>`
- `Link: <migration-guide>; rel="deprecation"`

## Implementation Guidance

For contract-related changes:

1. Update request/response schemas.
2. Update router `responses` and OpenAPI examples.
3. Add compatibility and regression tests.
4. Run `make pre-deploy` and `make sync-docs`.
5. Record policy-level decisions in ADR.

## Consequences

### Positive

- Predictable API evolution for clients.
- Lower risk of accidental contract breaks.
- Clear migration expectations.

### Trade-offs

- Additional governance overhead for API changes.
- Longer lifecycle for deprecated behavior support.
