"""Structural validation: live how-to pages match the canon their template ships.

How-to canon — extracted from `handbook/sa/templates/how-to.html` + the
canonical pattern memory rule `feedback_authoring_howto_pattern.md`:

  - `data-page-type="how-to"` on <body> — Diátaxis how-to quadrant
    (the live page BE'S a how-to; the SA template that documents the
    form is data-page-type="reference").
  - `<header class="page-head">` with eyebrow + h1 + `<p class="lede">`.
  - Three required `<h2 id>` sections in this order:
        before-h → steps-h → verify-h
    Two optional sections, if present, must come after verify-h:
        troubleshooting-h, related-h
  - Domain-specific `<h2>` sections may sit between/around the canonical
    ones (e.g. observability-h, examples-h) — the canon only constrains
    ORDER of the canonical IDs, not exclusivity.
  - `<footer class="docs-history">` — every how-to records its evolution.

The SA template uses non-`-h`-suffixed ids (`before`, `steps`, `verify`,
`troubleshooting`, `rollback`). The live corpus normalised on 2026-06-20
to use the same ids with the `-h` suffix to align with ADR/RFC/postmortem
canon conventions.

Runs without Playwright or Pillow — pure html5lib. Pair with the visual
test for the template only (live how-to content drift is structural, not
pixel-level).
"""

from __future__ import annotations

from pathlib import Path

import html5lib
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
PORTAL_INTERNAL = REPO_ROOT / "services" / "portal" / "internal"

SA_HOWTO_TEMPLATE = (
    REPO_ROOT / "services" / "portal" / "internal" / "handbook" / "sa" / "templates" / "how-to.html"
)
TEMPLATE_PATHS = [SA_HOWTO_TEMPLATE]

# Canonical sections — required (in this order) on every live how-to.
REQUIRED_SECTION_IDS = ["before-h", "steps-h", "verify-h"]
# Optional sections — if present, must come after verify-h in this relative order.
OPTIONAL_SECTION_IDS = ["troubleshooting-h", "related-h"]
ALL_CANON_IDS = REQUIRED_SECTION_IDS + OPTIONAL_SECTION_IDS

REQUIRED_METADATA_TERMS: set[str] = (
    set()
)  # how-to template-doc has its own dl; live pages don't require one


def _local_name(tag) -> str:
    if not isinstance(tag, str):
        return ""
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _parse(path: Path):
    return html5lib.parse(path.read_text("utf-8"), namespaceHTMLElements=False)


def _live_howtos() -> list[Path]:
    """Every how-to page under any service's how-to/ folder (excludes index.html)."""
    out: list[Path] = []
    for p in PORTAL_INTERNAL.rglob("how-to/*.html"):
        if p.name == "index.html":
            continue
        out.append(p)
    return sorted(out)


def _body_attr(tree, name: str) -> str | None:
    for el in tree.iter():
        if _local_name(el.tag) == "body":
            return el.get(name)
    return None


def _section_ids_in_order(tree) -> list[str]:
    """List `<h2 id="…">` ids in document order."""
    return [el.get("id") for el in tree.iter() if _local_name(el.tag) == "h2" and el.get("id")]


def _has_docs_history_footer(tree) -> bool:
    for el in tree.iter():
        if _local_name(el.tag) != "footer":
            continue
        classes = (el.get("class") or "").split()
        if "docs-history" in classes:
            return True
    return False


# ─── Corpus discovery ────────────────────────────────────────────────────
_LIVE_HOWTOS = _live_howtos()
_LIVE_IDS = [str(p.relative_to(PORTAL_INTERNAL.parent)) for p in _LIVE_HOWTOS]


# ─── Sanity ──────────────────────────────────────────────────────────────
def test_corpus_is_nonempty() -> None:
    assert _LIVE_HOWTOS, (
        "No how-to pages found under services/portal/internal/**/how-to/. "
        "Adjust _live_howtos() if the IA moved."
    )


# ─── 1) data-page-type — live = how-to, template = reference ─────────────
@pytest.mark.parametrize(("path",), [(p,) for p in _LIVE_HOWTOS], ids=_LIVE_IDS)
def test_live_data_page_type_is_howto(path: Path) -> None:
    actual = _body_attr(_parse(path), "data-page-type")
    assert actual == "how-to", (
        f"{path.relative_to(REPO_ROOT)} has data-page-type={actual!r}; "
        "live how-to pages declare the Diátaxis how-to quadrant."
    )


def test_sa_template_data_page_type_is_reference() -> None:
    actual = _body_attr(_parse(SA_HOWTO_TEMPLATE), "data-page-type")
    assert actual == "reference", (
        f"{SA_HOWTO_TEMPLATE.relative_to(REPO_ROOT)} has data-page-type={actual!r}; "
        "the SA template documents the form — it lives in the handbook reference quadrant."
    )


# ─── 2) Every live how-to carries the required canonical sections ────────
@pytest.mark.parametrize(("path",), [(p,) for p in _LIVE_HOWTOS], ids=_LIVE_IDS)
def test_has_required_canonical_sections(path: Path) -> None:
    ids = set(_section_ids_in_order(_parse(path)))
    missing = set(REQUIRED_SECTION_IDS) - ids
    assert not missing, (
        f"{path.relative_to(REPO_ROOT)} is missing required how-to sections: "
        f"{sorted(missing)}. Required: {REQUIRED_SECTION_IDS}. Present: {sorted(ids)}"
    )


# ─── 3) Canonical sections appear in the canonical order ─────────────────
@pytest.mark.parametrize(("path",), [(p,) for p in _LIVE_HOWTOS], ids=_LIVE_IDS)
def test_canonical_sections_in_canonical_order(path: Path) -> None:
    ids = _section_ids_in_order(_parse(path))
    seen = [i for i in ids if i in ALL_CANON_IDS]
    expected = [i for i in ALL_CANON_IDS if i in seen]
    assert seen == expected, (
        f"{path.relative_to(REPO_ROOT)} canonical anchors out of order:\n"
        f"  got:      {seen}\n"
        f"  expected: {expected}"
    )


# ─── 4) docs-history footer present ──────────────────────────────────────
@pytest.mark.parametrize(("path",), [(p,) for p in _LIVE_HOWTOS], ids=_LIVE_IDS)
def test_has_docs_history_footer(path: Path) -> None:
    assert _has_docs_history_footer(_parse(path)), (
        f'{path.relative_to(REPO_ROOT)} is missing <footer class="docs-history">. '
        "Every how-to records its evolution in a page-history block."
    )
