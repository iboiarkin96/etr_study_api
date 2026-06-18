"""One assert per (template, viewport) — fails when the rendered showcase
diverges from `tests/visual/baselines/` by more than the BL-047 threshold
(0.1% of pixels).

The runner lives in `tools/visual_regression/runner.py` — this file is just
a pytest wrapper so CI surfaces per-tile failures as individual test cases.
For the CLI, see `make visual-test`.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from tools.visual_regression.runner import (
    BASELINES_DIR,
    VIEWPORTS,
    _baseline_name,
    _capture,
    _free_port,
    _load_pages,
    _serve_portal,
    _wait_ready,
    compare,
)

_PAGES = _load_pages()
_PARAMS = [(p["id"], p["path"], v) for p in _PAGES for v in VIEWPORTS]


@pytest.fixture(scope="session")
def portal_server():
    port = _free_port()
    with _serve_portal(port) as base_url:
        _wait_ready(base_url)
        yield base_url


@pytest.fixture(scope="session")
def playwright_ctx():
    """Yield a long-lived Chromium `Browser` (not the Playwright manager).

    `_capture` expects a Browser — it calls `browser.new_context(...)`.
    Passing the Playwright manager here raised
    `AttributeError: 'Playwright' object has no attribute 'new_context'`
    on every visual test.
    """
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            yield browser
        finally:
            browser.close()


@pytest.mark.parametrize(("page_id", "page_path", "viewport"), _PARAMS)
def test_visual_baseline(
    portal_server: str,
    playwright_ctx,
    tmp_path: Path,
    page_id: str,
    page_path: str,
    viewport: str,
) -> None:
    baseline = BASELINES_DIR / _baseline_name(page_id, viewport)
    if not baseline.exists():
        pytest.fail(
            f"baseline missing: {baseline.name}. "
            "Run `make visual-test-update` to seed it (intentional UI change)."
        )

    png = _capture(playwright_ctx, portal_server, page_id, page_path, viewport)
    actual = tmp_path / _baseline_name(page_id, viewport)
    actual.write_bytes(png)

    ratio, diff_png = compare(baseline, actual)
    if diff_png is not None:
        diff_path = tmp_path / f"diff__{page_id}__{viewport}.png"
        diff_path.write_bytes(diff_png)
        pytest.fail(
            f"{page_id}/{viewport}: {ratio * 100:.3f}% pixels differ "
            f"(threshold 0.1%). Diff: {diff_path}"
        )
