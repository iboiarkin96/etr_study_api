"""Structural validation: live postmortems match the canon their templates ship.

Postmortem canon — extracted from `handbook/sa/templates/postmortem.html`
+ the three live postmortems under `services/{api,datastore,portal}/postmortems/`:

  - `data-page-type="reference"` everywhere (postmortems document an
    incident form across roles — templates AND live carry the same
    quadrant, same rationale as ADRs and RFCs).
  - `<header class="page-head">` with eyebrow + h1 + `<p class="lede">`.
  - `<dl class="svc-meta">` Metadata block with: Postmortem · Incident
    date · Severity · Category · Owner · Last reviewed.
  - Nine canonical `<h2>` sections in this order:
      metadata-h → summary-h → impact-h → timeline-h → root-cause-h →
      resolution-h → detection-h → actions-h → lessons-h
  - `<footer class="docs-history">` — every postmortem records its
    evolution (corrections, late-discovered impact, action-item updates).

Two templates carry the canon:
    Visual specimen — fake-but-plausible 2026-06-14 incident
    («API connection-pool exhaustion») with concrete prose in every
    section.

  handbook/sa/templates/postmortem.html
    Authoring shell — same skeleton with placeholder markers.

Live postmortems: `services/portal/internal/services/*/postmortems/*.html`
(date-prefixed, excludes index.html).

Runs without Playwright or Pillow — pure html5lib. Pair with the visual
test for the two templates only (live postmortem content drift is
structural, not pixel-level).
"""

from __future__ import annotations

from pathlib import Path

import html5lib
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
PORTAL_INTERNAL = REPO_ROOT / "services" / "portal" / "internal"
SERVICES_DIR = PORTAL_INTERNAL / "services"

SA_POSTMORTEM_TEMPLATE = (
    REPO_ROOT
    / "services"
    / "portal"
    / "internal"
    / "handbook"
    / "sa"
    / "templates"
    / "postmortem.html"
)
TEMPLATE_PATHS = [SA_POSTMORTEM_TEMPLATE]

# Canonical section anchors every postmortem MUST carry, in order.
REQUIRED_SECTION_IDS = [
    "metadata-h",
    "summary-h",
    "impact-h",
    "timeline-h",
    "root-cause-h",
    "resolution-h",
    "detection-h",
    "actions-h",
    "lessons-h",
]
REQUIRED_SECTION_SET = set(REQUIRED_SECTION_IDS)

# Metadata <dl> must surface at minimum these rows so a reader can scan
# the incident provenance without parsing the body.
REQUIRED_METADATA_TERMS = {
    "Postmortem",
    "Incident date",
    "Severity",
    "Category",
    "Owner",
    "Last reviewed",
}


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _parse(path: Path):
    return html5lib.parse(path.read_text("utf-8"), namespaceHTMLElements=False)


def _live_postmortems() -> list[Path]:
    """Date-prefixed postmortem files under any service's postmortems/ folder."""
    return sorted(SERVICES_DIR.glob("*/postmortems/2*.html"))


def _body_attr(tree, name: str) -> str | None:
    for el in tree.iter():
        if _local_name(el.tag) == "body":
            return el.get(name)
    return None


def _section_ids(tree) -> set[str]:
    """All `id` attributes on <h2> elements — the postmortem section anchors."""
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
_LIVE_POSTMORTEMS = _live_postmortems()
_ALL = [*TEMPLATE_PATHS, *_LIVE_POSTMORTEMS]
_IDS = ["template:sa-postmortem"] + [
    str(p.relative_to(PORTAL_INTERNAL.parent)) for p in _LIVE_POSTMORTEMS
]


# ─── Sanity ──────────────────────────────────────────────────────────────
def test_corpus_is_nonempty() -> None:
    assert _LIVE_POSTMORTEMS, (
        "No date-prefixed postmortem files found under services/*/postmortems/. "
        "Adjust _live_postmortems() if the IA moved."
    )


# ─── 0) Templates agree with each other ──────────────────────────────────
def test_templates_agree_on_canonical_sections() -> None:
    """Both postmortem templates must declare the same canonical anchors.
    Catches «UI Kit specimen updated, SA authoring shell forgotten» drift."""
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


# ─── 1) Every postmortem (templates + live) carries the canonical sections
@pytest.mark.parametrize(("path",), [(p,) for p in _ALL], ids=_IDS)
def test_has_canonical_sections(path: Path) -> None:
    ids = _section_ids(_parse(path))
    missing = REQUIRED_SECTION_SET - ids
    assert not missing, (
        f"{path.relative_to(REPO_ROOT)} is missing canonical sections: "
        f"{sorted(missing)}. Present: {sorted(ids)}"
    )


# ─── 2) data-page-type="reference" everywhere ────────────────────────────
# Postmortems document an incident form at every level (template AND live).
@pytest.mark.parametrize(("path",), [(p,) for p in _ALL], ids=_IDS)
def test_body_data_page_type_is_reference(path: Path) -> None:
    actual = _body_attr(_parse(path), "data-page-type")
    assert actual == "reference", (
        f"{path.relative_to(REPO_ROOT)} has data-page-type={actual!r}; "
        "postmortems are Diátaxis Reference at every level."
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
        "Every postmortem records its evolution in a page-history block."
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
