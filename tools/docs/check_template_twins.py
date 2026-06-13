"""Refuse commits that touch one half of a twin-template pair.

Closes the «SA template ↔ UI-kit twin» coupling rule (ADR-0035 D5,
quality-gates-map § Table D). The pre-commit hook runs at every commit
and reads ``git diff --cached --name-only``. If any staged path is one
half of a registered twin pair but the other half is not staged, the
commit is rejected with the two paths and the baseline-refresh command.

The twin registry lives in ``tests/visual/pages.json``:

    {
      "pages": [ { "id": "...", "path": "services/..." }, ... ],
      "pairs": [ ["sa-id", "ui-kit-id"], ... ]
    }

If the registry file is missing, the hook exits 0 without complaint —
the visual-regression infrastructure is in flight on a parallel branch
(BL-047); until it lands locally the twin gate is a no-op.

Usage (pre-commit):

    - repo: local
      hooks:
        - id: check-template-twins
          name: refuse one-sided edits to twin templates
          entry: .venv/bin/python tools/docs/check_template_twins.py
          language: system
          pass_filenames: false
          always_run: true
          stages: [pre-commit]
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / "tests" / "visual" / "pages.json"
BASELINE_REFRESH_CMD = "make -C services/portal visual-test-update"


def _staged_paths() -> set[str]:
    """Return staged paths (repo-relative)."""
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMRT"],
        check=True,
        capture_output=True,
        text=True,
    )
    return {line for line in result.stdout.splitlines() if line}


def _load_registry() -> tuple[dict[str, str], list[tuple[str, str]]] | None:
    """Return ``(id_to_path, pairs)`` or None if the registry is absent."""
    if not REGISTRY_PATH.is_file():
        return None
    data = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    id_to_path: dict[str, str] = {}
    for page in data.get("pages", []):
        pid = page.get("id")
        ppath = page.get("path")
        if pid and ppath:
            id_to_path[pid] = ppath
    pairs: list[tuple[str, str]] = []
    for pair in data.get("pairs", []):
        if isinstance(pair, list) and len(pair) == 2:
            pairs.append((pair[0], pair[1]))
    return id_to_path, pairs


def _check_pair(
    pair: tuple[str, str],
    id_to_path: dict[str, str],
    staged: set[str],
) -> list[str]:
    """Return error lines if exactly one side of the pair is staged."""
    a_id, b_id = pair
    a_path = id_to_path.get(a_id)
    b_path = id_to_path.get(b_id)
    if not a_path or not b_path:
        return [
            f"twin registry: pair ({a_id!r}, {b_id!r}) references an unknown id",
        ]
    a_staged = a_path in staged
    b_staged = b_path in staged
    if a_staged == b_staged:
        return []
    if a_staged:
        return [f"  staged: {a_path}", f"  missing: {b_path}"]
    return [f"  staged: {b_path}", f"  missing: {a_path}"]


def main() -> int:
    registry = _load_registry()
    if registry is None:
        return 0
    id_to_path, pairs = registry

    staged = _staged_paths()
    if not staged:
        return 0

    failures: list[list[str]] = []
    for pair in pairs:
        lines = _check_pair(pair, id_to_path, staged)
        if lines:
            failures.append(lines)

    if not failures:
        return 0

    print("─" * 78, file=sys.stderr)
    print("ERROR: TEMPLATE-TWIN COUPLING", file=sys.stderr)
    print("─" * 78, file=sys.stderr)
    print(
        "The following twin-template pairs have only one side staged. Each pair shares "
        "a visual baseline; editing one side requires editing the other in the same PR.",
        file=sys.stderr,
    )
    print("", file=sys.stderr)
    for block in failures:
        for line in block:
            print(line, file=sys.stderr)
        print("", file=sys.stderr)
    print(
        f"Stage the missing twin; if the visual changed intentionally, also run "
        f"`{BASELINE_REFRESH_CMD}` to refresh the baseline. Registry at "
        f"tests/visual/pages.json. Why this gate exists: see "
        f"quality-gates-map.html § Table D and ADR-0035 D5.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
