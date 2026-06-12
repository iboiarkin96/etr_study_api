"""Structural validation: live runbook pages match the canon their template ships.

This test answers the question «Is `templates/ops-runbook.html` actually the
canonical shape of a runbook?» by parametrising over every live runbook in
the portal and asserting the same section IDs, the same metadata block,
and the same body `data-page-type` are present everywhere.

Runs without Playwright or Pillow — pure html5lib parsing. Use it as the
fast first gate; the heavier pixel-diff lives in
`test_visual_regression.py`.

Canon:

  Metadata · Impact · Trigger · Fast triage · Most common causes ·
  Recovery · Exit criteria · Escalation · Follow-up · Related

Run only this file:

    .venv/bin/pytest tests/visual/test_runbook_canon.py -v
"""

from __future__ import annotations

from pathlib import Path

import html5lib
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
PORTAL_INTERNAL = REPO_ROOT / "services" / "portal" / "internal"

# Two templates carry the runbook canon — they must agree with each other
# and every live runbook must conform to them:
#
#   ui-kit/pages/templates/ops-runbook.html
#     Visual specimen. Lives in the UI Kit gallery. Tone: "this is how
#     a runbook should look in the v2 kit style". Visited by designers.
#
#   handbook/sa/templates/runbook.html
#     Authoring template. Lives next to the other SA templates (adr,
#     api-spec, postmortem, …). Authors clone this when they need to
#     write a new runbook. Tone: "fill in the placeholders". Visited
#     by SREs / SWEs at incident-write time.
#
# Drift between them = drift in the canon — surface it loudly.
TEMPLATE_PATHS = [
    REPO_ROOT / "services" / "portal" / "ui-kit" / "pages" / "templates" / "ops-runbook.html",
    REPO_ROOT
    / "services"
    / "portal"
    / "internal"
    / "handbook"
    / "sa"
    / "templates"
    / "runbook.html",
]
TEMPLATE_PATH = TEMPLATE_PATHS[0]  # back-compat name

# Canonical section anchors every runbook MUST carry (in any order — order is
# enforced separately by the docs-toc shape check below).
REQUIRED_SECTION_IDS = {
    "metadata-h",
    "impact-h",
    "trigger-h",
    "triage-h",
    "causes-h",
    "recovery-h",
    "exit-h",
    "escalation-h",
    "followup-h",
}

# Canonical reading order — what the docs-toc on the right side should walk.
CANONICAL_TOC_ORDER = [
    "metadata-h",
    "impact-h",
    "trigger-h",
    "triage-h",
    "causes-h",
    "recovery-h",
    "exit-h",
    "escalation-h",
    "followup-h",
]

# Metadata `<dl class="svc-meta">` must surface at minimum these rows so
# triagers know severity / owner / freshness without reading body prose.
REQUIRED_METADATA_TERMS = {"Runbook", "Severity", "Owner", "Last reviewed"}


def _live_runbooks() -> list[Path]:
    """Every published runbook page in the internal portal (excluding indices)."""
    out: list[Path] = []
    for path in PORTAL_INTERNAL.rglob("runbooks/*.html"):
        if path.name == "index.html":
            continue
        out.append(path)
    return sorted(out)


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _parse(path: Path):
    return html5lib.parse(path.read_text("utf-8"), namespaceHTMLElements=False)


def _section_ids(tree) -> set[str]:
    """All `id` attributes on <h2> or <aside> elements — the runbook section anchors."""
    ids: set[str] = set()
    for el in tree.iter():
        name = _local_name(el.tag)
        if name in {"h2", "aside"} and (anchor := el.get("id")):
            ids.add(anchor)
    return ids


def _docs_toc_anchor_order(tree) -> list[str]:
    """Order of anchors inside `<aside class="docs-toc">`'s link list."""
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


def _body_attr(tree, name: str) -> str | None:
    for el in tree.iter():
        if _local_name(el.tag) == "body":
            return el.get(name)
    return None


def _metadata_terms(tree) -> set[str]:
    """The <dt> labels inside the first `dl.svc-meta`."""
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


def _has_related_aside(tree) -> bool:
    for el in tree.iter():
        if _local_name(el.tag) == "aside" and el.get("id") == "related":
            return True
    return False


# ─── Parametrise across the templates + every live runbook ─────────────────
_LIVE_RUNBOOKS = _live_runbooks()
_ALL = [*TEMPLATE_PATHS, *_LIVE_RUNBOOKS]
_IDS = [f"template:{p.parent.parent.name}-{p.stem}" for p in TEMPLATE_PATHS] + [
    str(p.relative_to(PORTAL_INTERNAL.parent)) for p in _LIVE_RUNBOOKS
]


@pytest.fixture(scope="module")
def template_section_ids() -> set[str]:
    """Sections both templates agree on — the lowest-common-denominator canon."""
    sets = [_section_ids(_parse(p)) for p in TEMPLATE_PATHS]
    return set.intersection(*sets) if sets else set()


# ─── Sanity: the test discovered the corpus we expect ──────────────────────
def test_corpus_is_nonempty() -> None:
    assert _LIVE_RUNBOOKS, (
        "No live runbooks found under services/portal/internal/**/runbooks/. "
        "Adjust _live_runbooks() if the IA moved."
    )


# ─── 0) Templates agree with each other (cross-template canon drift) ──────
def test_templates_agree_on_canonical_sections() -> None:
    """Both runbook templates must declare the same set of canonical anchors.

    Drift between them = a runbook author starting from one template gets
    different scaffolding than another starting from the other. Catches the
    case «we updated the UI Kit specimen but forgot to update the SA
    authoring template» (or vice-versa).
    """
    per_template = {p: _section_ids(_parse(p)) & REQUIRED_SECTION_IDS for p in TEMPLATE_PATHS}
    union = set().union(*per_template.values())
    drift = {
        p.relative_to(REPO_ROOT): sorted(union - ids)
        for p, ids in per_template.items()
        if union - ids
    }
    assert not drift, (
        "Templates disagree on canonical sections:\n  "
        + "\n  ".join(f"{p} missing: {ms}" for p, ms in drift.items())
        + "\nReconcile so all templates carry the same canon."
    )


# ─── 1) Every runbook (template + live) carries the canonical sections ────
@pytest.mark.parametrize(("path",), [(p,) for p in _ALL], ids=_IDS)
def test_has_canonical_sections(path: Path) -> None:
    ids = _section_ids(_parse(path))
    missing = REQUIRED_SECTION_IDS - ids
    assert not missing, (
        f"{path.relative_to(REPO_ROOT)} is missing canonical sections: "
        f"{sorted(missing)}. Present: {sorted(ids)}"
    )


# ─── 2) The template (the canon) and live runbooks share the same set ─────
@pytest.mark.parametrize(("path",), [(p,) for p in _LIVE_RUNBOOKS], ids=_IDS[len(TEMPLATE_PATHS) :])
def test_live_runbook_section_set_matches_template(
    path: Path, template_section_ids: set[str]
) -> None:
    live = _section_ids(_parse(path))
    # Live runbook may carry extra section anchors (docs-toc, page-history),
    # but it must not be missing anything the template promises.
    missing = (template_section_ids & REQUIRED_SECTION_IDS) - live
    assert not missing, (
        f"{path.relative_to(REPO_ROOT)} is missing template-promised sections: {sorted(missing)}."
    )


# ─── 3) data-page-type on <body> — SPLIT BY ROLE ──────────────────────────
#
#   UI Kit specimen + live runbooks: the actual Diátaxis quadrant they BE,
#                                    which for runbooks is "how-to".
#   SA authoring template:           "reference" — it documents the form,
#                                    sits in the handbook reference quadrant.
#
# Two separate tests so failures are localised.

_UI_KIT_TEMPLATE = TEMPLATE_PATHS[0]
_SA_TEMPLATE = TEMPLATE_PATHS[1]
_HOWTO_PAGES = [_UI_KIT_TEMPLATE, *_LIVE_RUNBOOKS]
_HOWTO_IDS = ["template:ui-kit-ops-runbook"] + [
    str(p.relative_to(PORTAL_INTERNAL.parent)) for p in _LIVE_RUNBOOKS
]


@pytest.mark.parametrize(("path",), [(p,) for p in _HOWTO_PAGES], ids=_HOWTO_IDS)
def test_ui_kit_specimen_and_live_data_page_type_is_howto(path: Path) -> None:
    actual = _body_attr(_parse(path), "data-page-type")
    assert actual == "how-to", (
        f"{path.relative_to(REPO_ROOT)} has data-page-type={actual!r}; "
        "the UI Kit specimen and live runbooks declare the actual Diátaxis "
        "quadrant they live in — `how-to` for runbooks."
    )


def test_sa_template_data_page_type_is_reference() -> None:
    actual = _body_attr(_parse(_SA_TEMPLATE), "data-page-type")
    assert actual == "reference", (
        f"{_SA_TEMPLATE.relative_to(REPO_ROOT)} has data-page-type={actual!r}; "
        "SA authoring templates live in the handbook reference quadrant — "
        "they describe the form, the live page declares the actual quadrant."
    )


# ─── 4) Metadata <dl> surfaces at minimum the canonical labels ────────────
@pytest.mark.parametrize(("path",), [(p,) for p in _ALL], ids=_IDS)
def test_metadata_dl_surfaces_required_terms(path: Path) -> None:
    terms = _metadata_terms(_parse(path))
    missing = REQUIRED_METADATA_TERMS - terms
    assert not missing, (
        f"{path.relative_to(REPO_ROOT)} <dl.svc-meta> is missing: "
        f"{sorted(missing)}. Present: {sorted(terms)}"
    )


# ─── 6) docs-toc anchors walk the canonical reading order ────────────────
@pytest.mark.parametrize(("path",), [(p,) for p in _ALL], ids=_IDS)
def test_docs_toc_walks_canonical_order(path: Path) -> None:
    toc = _docs_toc_anchor_order(_parse(path))
    if not toc:
        pytest.skip("page does not ship an on-this-page TOC (mobile-only?)")
    # Filter to anchors we actually care about — ignore drive-by extras.
    canon_seen = [a for a in toc if a in CANONICAL_TOC_ORDER]
    expected = [a for a in CANONICAL_TOC_ORDER if a in canon_seen]
    assert canon_seen == expected, (
        f"{path.relative_to(REPO_ROOT)} docs-toc walks anchors in the wrong "
        f"order:\n  got:      {canon_seen}\n  expected: {expected}"
    )
