#!/usr/bin/env python3
"""Validate docs feedback wiring for key documentation pages.

This smoke check guards against regressions in page-level feedback UX:
- required GitHub issue template file exists;
- v2 bug-report component still wires the issue template, repo target, and
  the FEEDBACK_TYPES enum that populates the modal's type selector.
"""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
BUG_REPORT_JS = (
    REPO_ROOT
    / "services"
    / "frontend"
    / "portal"
    / "assets_v2"
    / "ui-kit"
    / "components"
    / "bug-report.js"
)
ISSUE_TEMPLATE = REPO_ROOT / ".github" / "ISSUE_TEMPLATE" / "docs_feedback.md"


def require_file(path: Path, errors: list[str]) -> None:
    """Append an error if file is missing.

    Args:
        path: File path expected to exist.
        errors: Mutable list of collected validation errors.
    """
    if not path.is_file():
        errors.append(f"Missing required file: {path.relative_to(REPO_ROOT)}")


def require_contains(path: Path, needle: str, errors: list[str]) -> None:
    """Append an error if file does not contain required text.

    Args:
        path: File path to inspect.
        needle: Required substring.
        errors: Mutable list of collected validation errors.
    """
    if not path.is_file():
        errors.append(f"Missing required file: {path.relative_to(REPO_ROOT)}")
        return
    text = path.read_text(encoding="utf-8")
    if needle not in text:
        errors.append(
            f"Expected '{needle}' in {path.relative_to(REPO_ROOT)}",
        )


def run() -> int:
    """Run docs feedback wiring validation.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    errors: list[str] = []
    require_file(ISSUE_TEMPLATE, errors)
    require_contains(BUG_REPORT_JS, 'const TEMPLATE = "docs_feedback.md"', errors)
    require_contains(BUG_REPORT_JS, "const REPO = ", errors)
    require_contains(BUG_REPORT_JS, "const FEEDBACK_TYPES = [", errors)

    if errors:
        print("Docs feedback validation failed:")
        for err in errors:
            print(f"- {err}")
        return 1

    print("Docs feedback validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
