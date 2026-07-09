"""Validate HTML consistency for docs pages.

Two checks run per page:

1. **html5 parse cleanliness** — every page is parsed with ``html5lib``;
   any parse error fails the build. Also guards against the legacy
   ``</wbr>`` regression.

2. **D7 metadata schema** (ADR-0032 W6 / ADR-0035 D6) — every page under
   ``services/portal/internal/`` carries the three required body attributes
   ``data-page-type``, ``data-service``, ``data-lifecycle`` drawn from the
   closed vocabularies named in ADR-0032 D7. Three more attributes are
   optional but, if present, must match the schema:
   ``data-role`` (closed vocabulary; empty string legal),
   ``data-topic`` (open vocabulary), and
   ``data-updated`` (ISO-8601 ``YYYY-MM-DD``).

Skips (D7 only — both checks share the html5 layer):

* ``internal/governance/`` — ADR / RFC / audit pages have their own metadata
  governance (status pills, lifecycle popovers); not D7-shaped.
* ``internal/onboarding/`` — onboarding hub + cold-start + glossary are
  router shells with their own conventions.
* ``internal/services/api/code-reference/`` — pdoc-generated; cannot be
  amended.
* Pages in ``FROZEN_DOCS_REL_PATHS`` and redirect stubs.

Per ADR-0032 D7 the closed vocabularies are:

* ``data-page-type`` ∈ {tutorial, how-to, reference, explanation, landing,
  landing-section, blog} — ``blog`` is in use today (see ``build_catalog.py``
  ``TONE_BY_TYPE``) and is accepted here pending a successor ADR.
* ``data-service`` ∈ {api, portal, datastore, monitoring, ui-kit, none}.
* ``data-role`` — space-separated subset of {swe, sa, qa, sre, architect,
  manager}; empty string permitted (= cross-role).
* ``data-lifecycle`` ∈ {draft, review, published, deprecated}.
"""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path

import html5lib

ROOT = Path(__file__).resolve().parents[2]
DOCS_ROOT = ROOT / "services" / "portal"
FROZEN_DOCS_REL_PATHS = {
    Path("internal/team/people/ivan-boyarkin/sa-growth.html"),
    Path("internal/team/people/ivan-boyarkin/week-calendar-2026-05-07.html"),
    # Swagger UI preview — a dev tool, not a portal docs page. Intentionally
    # sits outside the D7 schema; loads Swagger UI from a CDN and renders
    # any fragment YAML via ?spec=… query param. See ADR 0036 + the tutorial
    # at handbook/sa/tutorial/api-first.html.
    Path("internal/services/api/openapi/test/preview.html"),
    Path("internal/services/api/openapi/etr_study_app/preview.html"),
}

# Pages that intentionally bypass the D7 metadata schema. The portal root
# (``services/portal/index.html``) is the router landing and uses its own
# data-portal attribute instead; the internal hub is a hand-authored
# landing that pre-dates the D7 contract and stays on the FROZEN list.
D7_SCHEMA_FROZEN = {
    Path("index.html"),
    Path("internal/index.html"),
} | FROZEN_DOCS_REL_PATHS

# ADR-0032 D7 closed vocabularies. Empty string in ``data-role`` is treated
# as a legal explicit cross-role marker, not an error.
ALLOWED_PAGE_TYPES = {
    "tutorial",
    "how-to",
    "reference",
    "explanation",
    "landing",
    "landing-section",
    "blog",
}
ALLOWED_SERVICES = {"api", "portal", "datastore", "monitoring", "ui-kit", "none"}
ALLOWED_ROLES = {"swe", "sa", "qa", "sre", "architect", "manager"}
ALLOWED_LIFECYCLES = {"draft", "review", "published", "deprecated"}

REQUIRED_D7_ATTRS = ("data-page-type", "data-service", "data-lifecycle")

BODY_OPEN_RE = re.compile(r"<body\b[^>]*>", re.IGNORECASE | re.DOTALL)
ATTR_RE_TPL = r'\b{name}\s*=\s*"([^"]*)"'
REDIRECT_RE = re.compile(r'http-equiv\s*=\s*"refresh"', re.IGNORECASE)
ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _iter_html_files() -> list[Path]:
    """Return all HTML files under services/portal/, html5-check eligible.

    pdoc-generated output under ``internal/services/api/code-reference/`` is
    skipped — those pages are emitted by an external generator (we cannot
    fix void-tag handling, optional-tag closing, etc. inside its templates).
    """
    out: list[Path] = []
    for path in sorted(DOCS_ROOT.glob("**/*.html")):
        rel = path.relative_to(DOCS_ROOT)
        if rel in FROZEN_DOCS_REL_PATHS:
            continue
        if len(rel.parts) >= 4 and rel.parts[0:4] == (
            "internal",
            "services",
            "api",
            "code-reference",
        ):
            continue
        out.append(path)
    return out


def _d7_in_scope(rel: Path) -> bool:
    """Return True if ``rel`` (relative to services/portal/) is under D7."""
    if rel in D7_SCHEMA_FROZEN:
        return False
    if not rel.parts or rel.parts[0] != "internal":
        return False
    if len(rel.parts) >= 4 and rel.parts[0:4] == (
        "internal",
        "services",
        "api",
        "code-reference",
    ):
        return False
    if len(rel.parts) > 1 and rel.parts[1] in ("governance", "onboarding"):
        return False
    return True


def _body_attrs(text: str) -> dict[str, str] | None:
    """Extract attribute string from the first <body> open tag, parsed.

    Returns None if the page has no recognisable <body> tag (treated as
    out-of-scope, e.g. fragment files).
    """
    m = BODY_OPEN_RE.search(text)
    if not m:
        return None
    body_open = m.group(0)
    attrs: dict[str, str] = {}
    for name in (
        "data-page-type",
        "data-service",
        "data-role",
        "data-topic",
        "data-lifecycle",
        "data-updated",
    ):
        am = re.search(ATTR_RE_TPL.format(name=name), body_open)
        if am:
            attrs[name] = am.group(1)
    return attrs


def _validate_d7(rel: Path, text: str) -> list[str]:
    """Return list of D7 violations for one page. Empty list = clean."""
    if not _d7_in_scope(rel):
        return []
    if REDIRECT_RE.search(text):
        return []
    attrs = _body_attrs(text)
    if attrs is None:
        return []

    errors: list[str] = []

    for required in REQUIRED_D7_ATTRS:
        if required not in attrs:
            errors.append(f"{rel}: missing required body attribute {required!r} (ADR-0032 D7)")

    if "data-page-type" in attrs and attrs["data-page-type"] not in ALLOWED_PAGE_TYPES:
        errors.append(
            f"{rel}: data-page-type={attrs['data-page-type']!r} is not in the closed list "
            f"{sorted(ALLOWED_PAGE_TYPES)}"
        )
    if "data-service" in attrs and attrs["data-service"] not in ALLOWED_SERVICES:
        errors.append(
            f"{rel}: data-service={attrs['data-service']!r} is not in the closed list "
            f"{sorted(ALLOWED_SERVICES)}"
        )
    if "data-lifecycle" in attrs and attrs["data-lifecycle"] not in ALLOWED_LIFECYCLES:
        errors.append(
            f"{rel}: data-lifecycle={attrs['data-lifecycle']!r} is not in the closed list "
            f"{sorted(ALLOWED_LIFECYCLES)}"
        )

    if "data-role" in attrs:
        role_value = attrs["data-role"].strip()
        if role_value:
            tokens = role_value.split()
            bad = [t for t in tokens if t not in ALLOWED_ROLES]
            if bad:
                errors.append(
                    f"{rel}: data-role contains tokens outside the closed list "
                    f"{sorted(ALLOWED_ROLES)}: {bad}"
                )

    if "data-updated" in attrs:
        value = attrs["data-updated"]
        if not ISO_DATE_RE.match(value):
            errors.append(f"{rel}: data-updated={value!r} is not ISO-8601 YYYY-MM-DD")
        else:
            try:
                date.fromisoformat(value)
            except ValueError:
                errors.append(f"{rel}: data-updated={value!r} is not a real calendar date")

    return errors


def main() -> None:
    """Validate docs HTML and fail on parser errors, bad patterns, or D7 drift."""
    parser = html5lib.HTMLParser(tree=html5lib.getTreeBuilder("etree"))
    errors: list[str] = []

    for html_path in _iter_html_files():
        rel = html_path.relative_to(ROOT)
        rel_to_docs_root = html_path.relative_to(DOCS_ROOT)
        text = html_path.read_text(encoding="utf-8")

        # Guard against a known invalid pattern from earlier regressions.
        if "</wbr>" in text:
            errors.append(f"{rel}: contains invalid closing </wbr> tag")

        parser.errors.clear()
        parser.parse(text)
        if parser.errors:
            first = parser.errors[0]
            errors.append(f"{rel}: html5 parse error {first}")

        # D7 metadata schema (ADR-0032 W6 / ADR-0035 D6).
        errors.extend(_validate_d7(rel_to_docs_root, text))

    if errors:
        print("Docs HTML validation failed:")
        for item in errors:
            print(f" - {item}")
        raise SystemExit(1)

    print("Docs HTML validation passed")


if __name__ == "__main__":
    main()
