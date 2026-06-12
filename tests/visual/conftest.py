"""Pytest hooks for `tests/visual/`.

Auto-skip tests in `test_visual_regression.py` when the heavy deps
(`playwright`, `Pillow`) aren't installed in the active interpreter. The
structural-canon tests in `test_runbook_canon.py` run against html5lib only,
so they keep running on any default install.

The harness is invoked by `make visual-test`, which guarantees both
packages are present. When `pytest` is run directly without those deps,
only the Playwright-driven suite self-skips so the regular `make verify`
matrix doesn't choke on the import.
"""

from __future__ import annotations

import importlib.util

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


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    missing = _missing_deps()
    if not missing:
        return
    skip = pytest.mark.skip(
        reason=(
            f"visual-regression deps missing ({', '.join(missing)}). "
            "Install via `pip install -r services/api/requirements.txt` "
            "and `playwright install chromium`."
        )
    )
    for item in items:
        # Only skip Playwright-driven tests — the structural canon tests
        # are pure html5lib and run anywhere.
        if Path(item.fspath).stem == _VISUAL_FILE_STEM:
            item.add_marker(skip)


# Imported late so the fast-path above doesn't trip on Path either.
from pathlib import Path  # noqa: E402
