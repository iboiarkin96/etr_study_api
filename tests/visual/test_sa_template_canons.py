"""Bespoke canon — per-template required sections, metadata, and TOC order.

One canon-spec per SA template. Each template's spec lists:
  - REQUIRED_SECTION_IDS   ordered `-h` anchors every page of this kind must carry
  - REQUIRED_METADATA_TERMS  <dt> labels surfaced by the `<dl class="svc-meta">` block
  - data-page-type="reference"  (templates document the form; live pages declare their own quadrant)

Templates covered (9 — api-spec deferred to BL-077, needs JSON canon):
  audit · bug-report · component-spec · data-table · foundation-spec ·
  screen-spec · service-descriptor · test-case · test-plan

Live corpus is NOT walked here — drift-fix on existing audit / bug-report
pages is tracked separately. The visual test (`tests/visual/baselines/`)
holds the pixel canon; this file holds the structural canon at the
template alone.

Run only this file:

    .venv/bin/pytest tests/visual/test_sa_template_canons.py -v
"""

from __future__ import annotations

from pathlib import Path
from typing import NamedTuple

import html5lib
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SA_TEMPLATES = REPO_ROOT / "services" / "portal" / "internal" / "handbook" / "sa" / "templates"


class Canon(NamedTuple):
    slug: str
    sections: list[str]
    metadata: set[str]


CANONS: list[Canon] = [
    Canon(
        slug="audit",
        sections=[
            "metadata-h",
            "overview-h",
            "scope-h",
            "reference-practices-h",
            "as-is-h",
            "summary-h",
        ],
        metadata={"Assessment", "Stream", "Scope", "Owner", "Last reviewed"},
    ),
    Canon(
        slug="bug-report",
        sections=[
            "metadata-h",
            "summary-h",
            "environment-h",
            "steps-h",
            "expected-h",
            "actual-h",
            "evidence-h",
            "impact-h",
            "related-h",
        ],
        metadata={"Document", "Category", "Owner", "Last reviewed"},
    ),
    Canon(
        slug="component-spec",
        sections=[
            "metadata-h",
            "overview-h",
            "anatomy-h",
            "states-h",
            "a11y-h",
            "behavior-h",
            "code-handoff-h",
            "related-h",
        ],
        metadata={"Component", "Surface", "Implementation", "Owner", "Last reviewed"},
    ),
    Canon(
        slug="data-table",
        sections=[
            "metadata-h",
            "summary-h",
            "schema-h",
            "constraints-h",
            "relationships-h",
            "lifecycle-h",
            "related-h",
        ],
        metadata={"Table", "Category", "Source", "Owner", "Last reviewed"},
    ),
    Canon(
        slug="foundation-spec",
        sections=[
            "metadata-h",
            "overview-h",
            "tokens-h",
            "usage-h",
            "examples-h",
            "code-handoff-h",
            "related-h",
        ],
        metadata={"Foundation", "Surface", "Implementation", "Owner", "Last reviewed"},
    ),
    Canon(
        slug="screen-spec",
        sections=[
            "metadata-h",
            "gallery-h",
            "anatomy-h",
            "layout-h",
            "behavior-h",
            "timing-h",
            "data-contract-h",
            "responsive-h",
            "browser-matrix-h",
            "a11y-h",
            "dos-donts-h",
            "change-map-h",
            "acceptance-h",
            "known-edges-h",
        ],
        metadata={"Screen", "Primary URL", "Audience", "Owner", "Last reviewed"},
    ),
    Canon(
        slug="service-descriptor",
        sections=[
            "metadata-h",
            "overview-h",
            "top-level-h",
            "metadata-block-h",
            "spec-block-h",
            "extension-h",
            "generated-h",
            "omitted-h",
            "related-h",
        ],
        metadata={"Document", "Category", "Generator", "Owner", "Last reviewed"},
    ),
    Canon(
        slug="test-case",
        sections=[
            "metadata-h",
            "objective-h",
            "preconditions-h",
            "data-h",
            "steps-h",
            "expected-h",
            "postconditions-h",
            "related-h",
        ],
        metadata={"Document", "Category", "Owner", "Last reviewed"},
    ),
    Canon(
        slug="test-plan",
        sections=[
            "metadata-h",
            "objective-h",
            "scope-h",
            "approach-h",
            "coverage-h",
            "entry-exit-h",
            "risks-h",
            "schedule-h",
            "related-h",
        ],
        metadata={"Document", "Category", "Owner", "Last reviewed"},
    ),
]


def _local_name(tag) -> str:
    if not isinstance(tag, str):
        return ""
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _parse(path: Path):
    return html5lib.parse(path.read_text("utf-8"), namespaceHTMLElements=False)


def _section_ids_in_order(tree) -> list[str]:
    return [el.get("id") for el in tree.iter() if _local_name(el.tag) == "h2" and el.get("id")]


def _body_attr(tree, name: str) -> str | None:
    for el in tree.iter():
        if _local_name(el.tag) == "body":
            return el.get(name)
    return None


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


def _docs_toc_anchor_order(tree) -> list[str]:
    order: list[str] = []
    for el in tree.iter():
        if _local_name(el.tag) != "aside":
            continue
        classes = (el.get("class") or "").split()
        if "docs-toc" not in classes:
            continue
        for a in el.iter():
            if _local_name(a.tag) == "a":
                href = a.get("href", "")
                if href.startswith("#"):
                    order.append(href[1:])
    return order


def _path(canon: Canon) -> Path:
    return SA_TEMPLATES / f"{canon.slug}.html"


_IDS = [c.slug for c in CANONS]


@pytest.mark.parametrize("canon", CANONS, ids=_IDS)
def test_template_carries_required_sections(canon: Canon) -> None:
    ids = set(_section_ids_in_order(_parse(_path(canon))))
    missing = set(canon.sections) - ids
    assert not missing, (
        f"{_path(canon).relative_to(REPO_ROOT)} is missing required canonical "
        f"sections: {sorted(missing)}. Present: {sorted(ids)}"
    )


@pytest.mark.parametrize("canon", CANONS, ids=_IDS)
def test_canonical_sections_in_canonical_order(canon: Canon) -> None:
    ids = _section_ids_in_order(_parse(_path(canon)))
    seen = [i for i in ids if i in canon.sections]
    expected = [i for i in canon.sections if i in seen]
    assert seen == expected, (
        f"{_path(canon).relative_to(REPO_ROOT)} canonical anchors out of order:\n"
        f"  got:      {seen}\n  expected: {expected}"
    )


@pytest.mark.parametrize("canon", CANONS, ids=_IDS)
def test_data_page_type_is_reference(canon: Canon) -> None:
    actual = _body_attr(_parse(_path(canon)), "data-page-type")
    assert actual == "reference", (
        f"{_path(canon).relative_to(REPO_ROOT)} has data-page-type={actual!r}; "
        "SA templates document the form — they live in the handbook reference quadrant."
    )


@pytest.mark.parametrize("canon", CANONS, ids=_IDS)
def test_metadata_dl_surfaces_required_terms(canon: Canon) -> None:
    terms = _metadata_terms(_parse(_path(canon)))
    missing = canon.metadata - terms
    assert not missing, (
        f"{_path(canon).relative_to(REPO_ROOT)} <dl.svc-meta> is missing: "
        f"{sorted(missing)}. Present: {sorted(terms)}"
    )


@pytest.mark.parametrize("canon", CANONS, ids=_IDS)
def test_has_docs_history_footer(canon: Canon) -> None:
    assert _has_docs_history_footer(_parse(_path(canon))), (
        f"{_path(canon).relative_to(REPO_ROOT)} is missing "
        f'<footer class="docs-history">. Every SA template records its evolution.'
    )


@pytest.mark.parametrize("canon", CANONS, ids=_IDS)
def test_docs_toc_walks_canonical_order(canon: Canon) -> None:
    toc = _docs_toc_anchor_order(_parse(_path(canon)))
    if not toc:
        pytest.skip("template does not ship an on-this-page TOC")
    canon_seen = [a for a in toc if a in canon.sections]
    expected = [a for a in canon.sections if a in canon_seen]
    assert canon_seen == expected, (
        f"{_path(canon).relative_to(REPO_ROOT)} docs-toc walks canonical anchors "
        f"in the wrong order:\n  got:      {canon_seen}\n  expected: {expected}"
    )
