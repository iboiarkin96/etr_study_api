#!/usr/bin/env python3
"""Enforce CHANGELOG.md updates when user-facing paths change (CI helper).

See docs/adr/0013-changelog-and-release-notes.html.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys

USER_FACING_PREFIXES = ("app/", "docs/openapi/")
ROOT_TRIGGER_FILES = frozenset({"README.md"})
SKIP_SUBSTRINGS = ("[skip changelog]", "skip-changelog")


def _git(*args: str) -> str:
    out = subprocess.run(
        ["git", *args],
        check=True,
        capture_output=True,
        text=True,
    )
    return out.stdout


def _is_all_zeros(ref: str) -> bool:
    s = ref.strip().lower()
    return s == "0" * len(s) and len(s) >= 40


def _paths_trigger(paths: list[str]) -> bool:
    for p in paths:
        p = p.replace("\\", "/").strip()
        if not p:
            continue
        if p in ROOT_TRIGGER_FILES:
            return True
        for prefix in USER_FACING_PREFIXES:
            if p.startswith(prefix):
                return True
    return False


def _skip_in_text(text: str) -> bool:
    lower = text.lower()
    return any(s in lower for s in SKIP_SUBSTRINGS)


def _changed_files(base: str, head: str) -> list[str]:
    raw = _git("diff", "--name-only", base, head)
    return [line.strip() for line in raw.splitlines() if line.strip()]


def _commit_messages(base: str, head: str) -> str:
    try:
        return _git("log", f"{base}..{head}", "--format=%B%n")
    except subprocess.CalledProcessError:
        return ""


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--base", required=True, help="Git ref (start of range)")
    p.add_argument("--head", required=True, help="Git ref (end of range)")
    p.add_argument(
        "--event",
        choices=("pr", "push"),
        default="pr",
        help="pr: read PR_TITLE from env for skip; push: scan commit messages",
    )
    args = p.parse_args()

    if args.event == "push" and _is_all_zeros(args.base):
        print("changelog_gate: skipping (before ref is all zeros / new branch)")
        return 0

    paths = _changed_files(args.base, args.head)
    if not _paths_trigger(paths):
        print("changelog_gate: ok (no user-facing paths in range)")
        return 0

    if "CHANGELOG.md" in {x.replace("\\", "/") for x in paths}:
        print("changelog_gate: ok (CHANGELOG.md updated)")
        return 0

    if args.event == "pr":
        title = os.environ.get("PR_TITLE", "")
        if _skip_in_text(title):
            print("changelog_gate: ok (skip token in PR title)")
            return 0
    else:
        if _skip_in_text(_commit_messages(args.base, args.head)):
            print("changelog_gate: ok (skip token in commit message(s))")
            return 0

    print(
        "changelog_gate: CHANGELOG.md must be updated when app/, docs/openapi/, or "
        "root README.md changes, unless you use [skip changelog] or skip-changelog "
        "in the PR title (PR) or commit messages (push).",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
