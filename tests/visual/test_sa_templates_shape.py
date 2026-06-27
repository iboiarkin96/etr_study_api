"""Generic shape contract for every SA template.

The files under `services/portal/internal/handbook/sa/templates/` are
the canonical specification for every authored page type. Most are
handbook reference pages that document a form; a few are themselves
the form (e.g. `tutorial.html` BE'S a tutorial). The generic shape
canon below is the lowest-common-denominator every template must
satisfy:

  - `data-page-type="reference"` on <body> — handbook quadrant.
  - Exactly one <h1> in the document (page-uniqueness).
  - `<header class="page-head">` exists with an eyebrow.
  - `<footer class="docs-history">` page-history block.

Excluded: `index.html` — the templates hub is a landing-section, not a
template-doc; it has its own shape.

Template-specific structure (metadata-h, h2 IDs, section order, lede,
docs-toc) is enforced by the bespoke canon tests
(`test_{runbook,tutorial,adr,rfc,postmortem}_canon.py`) — those know
what an ADR is for; this test only knows what every template-page
shares.

Pair with the pixel-diff baselines under `tests/visual/baselines/` —
those catch visual drift in the kit; this catches structural drift in
the template scaffold.

Runs on html5lib only — no Playwright, no Pillow, no browser binary.
"""

from __future__ import annotations

from pathlib import Path

import html5lib
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
TEMPLATES_DIR = REPO_ROOT / "services" / "portal" / "internal" / "handbook" / "sa" / "templates"

# Templates hub (`index.html`) is excluded: it's a landing-section that
# lists the other templates, not a template-doc itself.
EXCLUDED_STEMS = {"index"}


def _local_name(tag) -> str:
    # html5lib yields function tags for Comment nodes — guard against them
    # so the generic shape walk does not crash on commented-out blocks.
    if not isinstance(tag, str):
        return ""
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _parse(path: Path):
    return html5lib.parse(path.read_text("utf-8"), namespaceHTMLElements=False)


def _all_templates() -> list[Path]:
    """Every .html file under handbook/sa/templates/ except the hub."""
    return sorted(p for p in TEMPLATES_DIR.glob("*.html") if p.stem not in EXCLUDED_STEMS)


def _body_attr(tree, name: str) -> str | None:
    for el in tree.iter():
        if _local_name(el.tag) == "body":
            return el.get(name)
    return None


def _find_one(tree, tag: str, class_substring: str | None = None):
    for el in tree.iter():
        if _local_name(el.tag) != tag:
            continue
        if class_substring is None:
            return el
        classes = (el.get("class") or "").split()
        if any(class_substring in c for c in classes):
            return el
    return None


def _section_ids(tree) -> set[str]:
    return {el.get("id") for el in tree.iter() if _local_name(el.tag) == "h2" and el.get("id")}


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


def _count(tree, tag: str) -> int:
    return sum(1 for el in tree.iter() if _local_name(el.tag) == tag)


# ─── Corpus discovery ────────────────────────────────────────────────────
_TEMPLATES = _all_templates()
_IDS = [p.stem for p in _TEMPLATES]


# ─── Sanity ──────────────────────────────────────────────────────────────
def test_corpus_is_nonempty() -> None:
    assert _TEMPLATES, (
        f"No .html files found under {TEMPLATES_DIR.relative_to(REPO_ROOT)}. "
        "Adjust _all_templates() if the IA moved."
    )


# ─── 1) Body is Diátaxis reference (handbook quadrant) ───────────────────
@pytest.mark.parametrize(("path",), [(p,) for p in _TEMPLATES], ids=_IDS)
def test_body_data_page_type_is_reference(path: Path) -> None:
    actual = _body_attr(_parse(path), "data-page-type")
    assert actual == "reference", (
        f"{path.relative_to(REPO_ROOT)} has data-page-type={actual!r}; "
        "SA templates are handbook reference pages (they document a form)."
    )


# ─── 2) Exactly one <h1> ─────────────────────────────────────────────────
@pytest.mark.parametrize(("path",), [(p,) for p in _TEMPLATES], ids=_IDS)
def test_exactly_one_h1(path: Path) -> None:
    count = _count(_parse(path), "h1")
    assert count == 1, (
        f"{path.relative_to(REPO_ROOT)} has {count} <h1> elements; required: exactly 1."
    )


# ─── 3) Page-head exists with eyebrow ────────────────────────────────────
# h1 is checked separately above (anywhere in the doc, count == 1). The
# api-spec template uses an `<div class="endpoint-hero">` for its h1 row
# instead of inlining h1 inside <header class="page-head"> — that's fine
# at this layer; bespoke canons (test_*_canon.py) enforce the per-template
# header shape including h1 placement.
@pytest.mark.parametrize(("path",), [(p,) for p in _TEMPLATES], ids=_IDS)
def test_page_head_with_eyebrow(path: Path) -> None:
    tree = _parse(path)
    page_head = _find_one(tree, "header", "page-head")
    assert page_head is not None, (
        f'{path.relative_to(REPO_ROOT)} is missing <header class="page-head">.'
    )
    has_eyebrow = False
    for el in page_head.iter():
        tag = _local_name(el.tag)
        classes = (el.get("class") or "").split()
        if tag in ("p", "div") and any("eyebrow" in c for c in classes):
            has_eyebrow = True
            break
    assert has_eyebrow, f"{path.relative_to(REPO_ROOT)} page-head has no eyebrow pill row."


# ─── 4) docs-history footer present ──────────────────────────────────────
@pytest.mark.parametrize(("path",), [(p,) for p in _TEMPLATES], ids=_IDS)
def test_docs_history_footer(path: Path) -> None:
    assert _has_docs_history_footer(_parse(path)), (
        f'{path.relative_to(REPO_ROOT)} is missing <footer class="docs-history">. '
        "Every template-doc records its evolution in a page-history block."
    )
