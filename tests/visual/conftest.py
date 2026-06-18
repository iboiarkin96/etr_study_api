"""Pytest hooks for `tests/visual/`.

Auto-skip tests in `test_visual_regression.py` when either the heavy Python
deps (`playwright`, `Pillow`) or the Chromium browser binary is missing.
The structural-canon tests in `test_runbook_canon.py` run against html5lib
only, so they keep running on any default install.

The harness is invoked by `make visual-test`, which guarantees both the
packages and the browser binary are present. When `pytest` is run directly
(e.g. inside the `quality` matrix slot for the api service, which does not
install Chromium), only the Playwright-driven suite self-skips so the
regular `make verify` matrix doesn't choke on a missing binary.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

_HEAVY_DEPS = ("playwright", "PIL")
_VISUAL_FILE_STEM = "test_visual_regression"


def _missing_deps() -> list[str]:
    """Heavy deps that aren't importable in this interpreter."""
    out: list[str] = []
    for mod in _HEAVY_DEPS:
        try:
            spec = importlib.util.find_spec(mod)
        except (ImportError, ValueError):
            spec = None
        if spec is None:
            out.append(mod)
    return out


def _chromium_missing() -> bool:
    """Return True when the Chromium browser binary Playwright needs at
    runtime isn't present. The Python `playwright` package can be installed
    without ever running `playwright install`, and that's exactly the state
    the per-service `quality` CI matrix slots are in — they install
    requirements.txt but not browser binaries (Chromium is ~150 MB and
    cached in a dedicated `visual-regression` job)."""
    try:
        from playwright.sync_api import sync_playwright
    except (ImportError, ValueError):
        # Caught upstream by _missing_deps; no need to re-flag here.
        return False
    try:
        with sync_playwright() as pw:
            executable = pw.chromium.executable_path
            return not executable or not Path(executable).exists()
    except Exception:
        # If we can't even start Playwright, treat it as missing so the
        # tests skip with a clear reason rather than crash collection.
        return True


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    missing = _missing_deps()
    chromium_missing = (not missing) and _chromium_missing()
    if not missing and not chromium_missing:
        return

    reason_parts: list[str] = []
    if missing:
        reason_parts.append(f"Python deps missing ({', '.join(missing)})")
    if chromium_missing:
        reason_parts.append("Chromium binary missing (`playwright install chromium`)")
    skip = pytest.mark.skip(reason="visual-regression skipped — " + "; ".join(reason_parts) + ".")
    for item in items:
        # Only skip Playwright-driven tests — the structural canon tests
        # are pure html5lib and run anywhere.
        if Path(item.fspath).stem == _VISUAL_FILE_STEM:
            item.add_marker(skip)
