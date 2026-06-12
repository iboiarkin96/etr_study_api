"""Structural validation: live ADRs match the canon their templates ship.

ADR canon — extracted from `handbook/sa/templates/adr.html` + the 34 live
ADRs under `governance/adr/`:

  - `data-page-type="reference"` everywhere (ADRs are decision records;
    they document a form across all roles — templates AND live carry the
    same quadrant, unlike runbooks/tutorials where templates differ
    from the page-type they document).
  - `<header class="page-head">` with eyebrow (lifecycle-popover for ADRs)
    + h1 + `<p class="lede">`.
  - `<dl class="svc-meta">` Metadata block with: ADR · Category · Owner ·
    Decided on · Last reviewed.
  - Nine canonical `<h2>` sections in this order:
      metadata-h → context-h → decision-h → scope-h → alternatives-h →
      consequences-h → compatibility-h → implementation-h → validation-h
  - `<footer class="docs-history">` — every ADR carries page history.

Two templates carry the canon:

  ui-kit/pages/templates/doc-adr.html
    Visual specimen — a fake but plausible ADR 0042 «Cache hot-path reads
    with Redis» with concrete prose in every section.

  handbook/sa/templates/adr.html
    Authoring shell — same skeleton, `<placeholder>` markers, plus
    «MANDATORY · MIN 2» pill on the Alternatives section.

Live ADRs: `services/portal/internal/governance/adr/NNNN-*.html`.

Runs without Playwright or Pillow — pure html5lib. Pair with the visual
test for the two templates only (live ADR content drift is structural,
not pixel-level).
"""

from __future__ import annotations

from pathlib import Path

import html5lib
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
PORTAL_INTERNAL = REPO_ROOT / "services" / "portal" / "internal"
ADR_DIR = PORTAL_INTERNAL / "governance" / "adr"

UI_KIT_ADR = REPO_ROOT / "services" / "portal" / "ui-kit" / "pages" / "templates" / "doc-adr.html"
SA_ADR_TEMPLATE = (
    REPO_ROOT / "services" / "portal" / "internal" / "handbook" / "sa" / "templates" / "adr.html"
)
TEMPLATE_PATHS = [UI_KIT_ADR, SA_ADR_TEMPLATE]

# Canonical section anchors every ADR MUST carry, in order.
REQUIRED_SECTION_IDS = [
    "metadata-h",
    "context-h",
    "decision-h",
    "scope-h",
    "alternatives-h",
    "consequences-h",
    "compatibility-h",
    "implementation-h",
    "validation-h",
]
REQUIRED_SECTION_SET = set(REQUIRED_SECTION_IDS)

# Metadata <dl> must surface at minimum these rows so a reader can scan
# the decision provenance without parsing the body.
REQUIRED_METADATA_TERMS = {"ADR", "Category", "Owner", "Decided on", "Last reviewed"}


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _parse(path: Path):
    return html5lib.parse(path.read_text("utf-8"), namespaceHTMLElements=False)


def _live_adrs() -> list[Path]:
    """Numbered ADR files (excludes index.html and alternatives-audit.html)."""
    return sorted(p for p in ADR_DIR.glob("[0-9]*.html"))


def _body_attr(tree, name: str) -> str | None:
    for el in tree.iter():
        if _local_name(el.tag) == "body":
            return el.get(name)
    return None


def _section_ids(tree) -> set[str]:
    """All `id` attributes on <h2> elements — the ADR section anchors."""
    return {el.get("id") for el in tree.iter() if _local_name(el.tag) == "h2" and el.get("id")}


def _docs_toc_anchor_order(tree) -> list[str]:
    order: list[str] = []
    for el in tree.iter():
        if _local_name(el.tag) != "aside":
            continue
        classes = (el.get("class") or "").split()
        if "docs-toc" not in classes:
            continue
        for a in el.iter():
            if _local_name(a.tag) == "a" and (href := a.get("href", "")).startswith("#"):
                order.append(href[1:])
    return order


def _metadata_terms(tree) -> set[str]:
    for el in tree.iter():
        if _local_name(el.tag) != "dl":
            continue
        classes = (el.get("class") or "").split()
        if "svc-meta" not in classes:
            continue
        return {
            (dt.text or "").strip() for dt in el.iter() if _local_name(dt.tag) == "dt" and dt.text
        }
    return set()


def _has_docs_history_footer(tree) -> bool:
    for el in tree.iter():
        if _local_name(el.tag) != "footer":
            continue
        classes = (el.get("class") or "").split()
        if "docs-history" in classes:
            return True
    return False


# ─── Corpus discovery ────────────────────────────────────────────────────
_LIVE_ADRS = _live_adrs()
_ALL = [*TEMPLATE_PATHS, *_LIVE_ADRS]
_IDS = ["template:ui-kit-doc-adr", "template:sa-adr"] + [
    str(p.relative_to(PORTAL_INTERNAL.parent)) for p in _LIVE_ADRS
]


# ─── Sanity ──────────────────────────────────────────────────────────────
def test_corpus_is_nonempty() -> None:
    assert _LIVE_ADRS, (
        "No numbered ADR files found under governance/adr/. Adjust _live_adrs() if the IA moved."
    )


# ─── 0) Templates agree with each other ──────────────────────────────────
def test_templates_agree_on_canonical_sections() -> None:
    """Both ADR templates must declare the same canonical anchors. Catches
    «UI Kit specimen updated, SA authoring shell forgotten» drift."""
    per_template = {p: _section_ids(_parse(p)) & REQUIRED_SECTION_SET for p in TEMPLATE_PATHS}
    union = set().union(*per_template.values())
    drift = {
        p.relative_to(REPO_ROOT): sorted(union - ids)
        for p, ids in per_template.items()
        if union - ids
    }
    assert not drift, (
        "Templates disagree on canonical sections:\n  "
        + "\n  ".join(f"{p} missing: {ms}" for p, ms in drift.items())
        + "\nReconcile so both templates carry the same canon."
    )


# ─── 1) Every ADR (templates + live) carries the canonical sections ──────
@pytest.mark.parametrize(("path",), [(p,) for p in _ALL], ids=_IDS)
def test_has_canonical_sections(path: Path) -> None:
    ids = _section_ids(_parse(path))
    missing = REQUIRED_SECTION_SET - ids
    assert not missing, (
        f"{path.relative_to(REPO_ROOT)} is missing canonical sections: "
        f"{sorted(missing)}. Present: {sorted(ids)}"
    )


# ─── 2) data-page-type="reference" everywhere ────────────────────────────
# ADRs are reference docs at every level (template AND live) — they document
# a decision form. Unlike runbooks/tutorials where templates differ from
# live, here the quadrant is uniform.
@pytest.mark.parametrize(("path",), [(p,) for p in _ALL], ids=_IDS)
def test_body_data_page_type_is_reference(path: Path) -> None:
    actual = _body_attr(_parse(path), "data-page-type")
    assert actual == "reference", (
        f"{path.relative_to(REPO_ROOT)} has data-page-type={actual!r}; "
        "ADRs are Diátaxis Reference at every level."
    )


# ─── 3) Metadata <dl> surfaces the canonical labels ──────────────────────
@pytest.mark.parametrize(("path",), [(p,) for p in _ALL], ids=_IDS)
def test_metadata_dl_surfaces_required_terms(path: Path) -> None:
    terms = _metadata_terms(_parse(path))
    missing = REQUIRED_METADATA_TERMS - terms
    assert not missing, (
        f"{path.relative_to(REPO_ROOT)} <dl.svc-meta> is missing: "
        f"{sorted(missing)}. Present: {sorted(terms)}"
    )


# ─── 4) docs-history footer present ──────────────────────────────────────
@pytest.mark.parametrize(("path",), [(p,) for p in _ALL], ids=_IDS)
def test_has_docs_history_footer(path: Path) -> None:
    assert _has_docs_history_footer(_parse(path)), (
        f'{path.relative_to(REPO_ROOT)} is missing <footer class="docs-history">. '
        "Every ADR records its evolution in a page-history block."
    )


# ─── 5) docs-toc walks the canonical reading order ───────────────────────
@pytest.mark.parametrize(("path",), [(p,) for p in _ALL], ids=_IDS)
def test_docs_toc_walks_canonical_order(path: Path) -> None:
    toc = _docs_toc_anchor_order(_parse(path))
    if not toc:
        pytest.skip("page does not ship an on-this-page TOC (mobile-only?)")
    canon_seen = [a for a in toc if a in REQUIRED_SECTION_IDS]
    expected = [a for a in REQUIRED_SECTION_IDS if a in canon_seen]
    assert canon_seen == expected, (
        f"{path.relative_to(REPO_ROOT)} docs-toc walks canonical anchors in "
        f"the wrong order:\n  got:      {canon_seen}\n  expected: {expected}"
    )
