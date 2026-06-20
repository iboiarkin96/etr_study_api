"""Structural validation: live tutorial pages match the canon their templates ship.

Unlike runbooks, **tutorials don't share section IDs** — every tutorial has
its own unique phase names ("Boot the project", "Write the schema",
"Manufacture a tiny failure", …). The canon is about the **chrome**:

  - `data-page-type="tutorial"` (Diátaxis: learning quadrant)
  - `<header class="page-head">` with eyebrow + h1 + `<p class="lede">`
  - `<div class="docs-chip-row">` meta row (phases / time / audience)
  - at least 2 `<h2>` sections (Before-you-start + Goal + N phases)
  - closing `<aside class="docs-card--gradient">` with title
    EXACTLY «Next step» (per `feedback_next_step_card_pattern.md`)
  - `<footer class="docs-history">`

Two templates carry that canon — they must agree with each other and every
live tutorial must conform to them:

  ui-kit/pages/templates/doc-tutorial.html
    Visual specimen. Lives in the UI Kit gallery. A concrete working
    tutorial — "this is what a tutorial looks like in v2".

  handbook/sa/templates/tutorial.html
    Authoring fillable shell. Same skeleton, placeholders inside, plus
    a closing «Authoring notes» ghost-card the writer deletes before
    shipping (when-to-use / lede formula / voice rules / anti-patterns).

Both declare `data-page-type="tutorial"` because both ARE tutorials —
one for show, one for filling-in. Live tutorials inherit the same shape.

Runs without Playwright or Pillow — pure html5lib. Pair with the visual
test for full coverage.
"""

from __future__ import annotations

from pathlib import Path

import html5lib
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
PORTAL_INTERNAL = REPO_ROOT / "services" / "portal" / "internal"

SA_TUTORIAL_TEMPLATE = (
    REPO_ROOT
    / "services"
    / "portal"
    / "internal"
    / "handbook"
    / "sa"
    / "templates"
    / "tutorial.html"
)

# Title MUST be exactly «Next step» — not «Next up», «Next steps», «What next».
# Memory: feedback_next_step_card_pattern.md (2026-05-27).
NEXT_STEP_TITLE = "Next step"


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _parse(path: Path):
    return html5lib.parse(path.read_text("utf-8"), namespaceHTMLElements=False)


def _live_tutorials() -> list[Path]:
    """Every published tutorial page in the internal portal (excluding indices)."""
    return sorted(
        p for p in (PORTAL_INTERNAL / "tutorials").rglob("*.html") if p.name != "index.html"
    )


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


def _count(tree, tag: str) -> int:
    return sum(1 for el in tree.iter() if _local_name(el.tag) == tag)


def _gradient_aside_title(tree) -> str | None:
    """Title text of the closing `<aside class="docs-card--gradient">` block."""
    for el in tree.iter():
        if _local_name(el.tag) != "aside":
            continue
        classes = (el.get("class") or "").split()
        if not any("docs-card--gradient" in c for c in classes):
            continue
        # First `<h3>` inside it
        for child in el.iter():
            if _local_name(child.tag) == "h3" and child.text:
                return child.text.strip()
    return None


# ─── Corpus discovery ────────────────────────────────────────────────────
TEMPLATE_PATHS = [SA_TUTORIAL_TEMPLATE]
_LIVE_TUTORIALS = _live_tutorials()
_CANON_PAGES = [*TEMPLATE_PATHS, *_LIVE_TUTORIALS]
_CANON_IDS = ["template:sa-tutorial"] + [
    str(p.relative_to(PORTAL_INTERNAL.parent)) for p in _LIVE_TUTORIALS
]


# ─── Sanity ──────────────────────────────────────────────────────────────
def test_corpus_is_nonempty() -> None:
    assert _LIVE_TUTORIALS, (
        "No live tutorials found under services/portal/internal/tutorials/. "
        "Adjust _live_tutorials() if the IA moved."
    )


# ─── 1) data-page-type — SPLIT BY ROLE ───────────────────────────────────
#
#   Live tutorials:        actual Diátaxis quadrant they BE — "tutorial".
#   SA authoring template: "reference" — handbook authoring shell that
#                          documents the form.
#
# Two separate tests so failures are localised.

_LIVE_IDS = [str(p.relative_to(PORTAL_INTERNAL.parent)) for p in _LIVE_TUTORIALS]


@pytest.mark.parametrize(("path",), [(p,) for p in _LIVE_TUTORIALS], ids=_LIVE_IDS)
def test_live_data_page_type_is_tutorial(path: Path) -> None:
    actual = _body_attr(_parse(path), "data-page-type")
    assert actual == "tutorial", (
        f"{path.relative_to(REPO_ROOT)} has data-page-type={actual!r}; "
        "live tutorials declare the actual Diátaxis quadrant they live in "
        "— `tutorial` for tutorials."
    )


def test_sa_template_data_page_type_is_reference() -> None:
    actual = _body_attr(_parse(SA_TUTORIAL_TEMPLATE), "data-page-type")
    assert actual == "reference", (
        f"{SA_TUTORIAL_TEMPLATE.relative_to(REPO_ROOT)} has "
        f"data-page-type={actual!r}; SA authoring templates live in the "
        "handbook reference quadrant — they describe the form, the live "
        "page declares the actual quadrant."
    )


# ─── 2) `<header class="page-head">` exists, with eyebrow + h1 + lede ────
@pytest.mark.parametrize(("path",), [(p,) for p in _CANON_PAGES], ids=_CANON_IDS)
def test_has_page_head_with_eyebrow_h1_lede(path: Path) -> None:
    tree = _parse(path)
    page_head = _find_one(tree, "header", "page-head")
    assert page_head is not None, (
        f'{path.relative_to(REPO_ROOT)} is missing <header class="page-head">.'
    )
    # Walk children for required pieces
    found = {"eyebrow": False, "h1": False, "lede": False}
    for el in page_head.iter():
        tag = _local_name(el.tag)
        classes = (el.get("class") or "").split()
        if tag == "p" and any("home-hero__eyebrow" in c for c in classes):
            found["eyebrow"] = True
        elif tag == "h1":
            found["h1"] = True
        elif tag == "p" and "lede" in classes:
            found["lede"] = True
    missing = [k for k, v in found.items() if not v]
    assert not missing, (
        f"{path.relative_to(REPO_ROOT)} page-head is missing: {missing}. "
        'Required: home-hero__eyebrow pill row, <h1>, <p class="lede">.'
    )


# ─── 3) Tutorial has ≥ 2 <h2> step sections (numbered phases) ────────────
@pytest.mark.parametrize(("path",), [(p,) for p in _CANON_PAGES], ids=_CANON_IDS)
def test_has_at_least_two_h2_step_sections(path: Path) -> None:
    tree = _parse(path)
    # docs-history__title is also <h2>; subtract those by checking the
    # parent has class "docs-history" (or just by walking <article> only).
    article = _find_one(tree, "article", "docs-prose")
    n = _count(article, "h2") if article is not None else _count(tree, "h2")
    assert n >= 2, (
        f"{path.relative_to(REPO_ROOT)} has only {n} <h2> sections inside "
        "<article>. A tutorial needs at least Before-you-start + Goal + "
        "N phases — minimum 2 h2 anchors."
    )


# ─── 4) Closing «Next step» aside, titled EXACTLY «Next step» ───────────
@pytest.mark.parametrize(("path",), [(p,) for p in _CANON_PAGES], ids=_CANON_IDS)
def test_closing_aside_title_is_exactly_next_step(path: Path) -> None:
    title = _gradient_aside_title(_parse(path))
    assert title == NEXT_STEP_TITLE, (
        f'{path.relative_to(REPO_ROOT)} closing <aside class="docs-card--gradient"> '
        f"title is {title!r}, must be exactly {NEXT_STEP_TITLE!r} "
        "(feedback_next_step_card_pattern.md, 2026-05-27)."
    )


# ─── 5) Has `<footer class="docs-history">` ─────────────────────────────
@pytest.mark.parametrize(("path",), [(p,) for p in _CANON_PAGES], ids=_CANON_IDS)
def test_has_docs_history_footer(path: Path) -> None:
    assert _find_one(_parse(path), "footer", "docs-history") is not None, (
        f'{path.relative_to(REPO_ROOT)} is missing <footer class="docs-history">. '
        "Every tutorial closes with a page-history block."
    )


# ─── Both templates agree on the canonical chrome (cross-template drift) ──
def test_templates_share_step_numbered_section_count() -> None:
    """Both templates should ship at least the same minimum number of step
    sections (Before-you-start + Goal + ≥1 phase + final = 4). Catches the
    case «UI Kit specimen has 4 phases, SA template has 1» — author copies
    SA template and gets a degenerate skeleton."""
    counts = {
        p: _count(_find_one(_parse(p), "article", "docs-prose") or _parse(p), "h2")
        for p in TEMPLATE_PATHS
    }
    min_phases = 4  # Before-you-start, Goal, ≥1 phase, final
    short = {p.relative_to(REPO_ROOT): n for p, n in counts.items() if n < min_phases}
    assert not short, (
        f"Templates have too few step sections (< {min_phases}): {short}. "
        f"Counts: {dict((p.name, n) for p, n in counts.items())}"
    )
