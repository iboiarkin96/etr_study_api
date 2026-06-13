"""Refuse commits that touch a meta-surface without a feed entry.

Closes the «meta-change ↔ feed entry» coupling rule (ADR-0035 D5,
quality-gates-map § Table D). The pre-commit hook runs at every commit
and reads ``git diff --cached --name-only``. If any staged path matches
a meta-surface pattern but the curated feed file is not also staged,
the commit is rejected with a paste-ready feed-entry template.

Meta-surfaces:

* ``.pre-commit-config.yaml``
* ``.github/workflows/*.yml``
* ``services/portal/Makefile``
* ``services/portal/internal/handbook/sa/templates/*.html``
* New or status-changed ADRs (``governance/adr/[0-9]{4}-*.html``)
* Any script under ``tools/docs/``

Soft rollout: setting ``META_LOG_SOFT=1`` in the environment downgrades
the hook to a warning that does not block the commit. Intended for the
first week; remove the flag once authors have internalised the rule.

Usage (pre-commit):

    - repo: local
      hooks:
        - id: check-meta-changes-logged
          name: refuse meta-changes without a feed entry
          entry: .venv/bin/python tools/docs/check_meta_changes_logged.py
          language: system
          pass_filenames: false
          always_run: true
          stages: [pre-commit]
"""

from __future__ import annotations

import fnmatch
import os
import subprocess
import sys

FEED_PATH = "services/portal/internal/operating-model/whats-new-in-how-we-work.html"

META_SURFACE_GLOBS = (
    ".pre-commit-config.yaml",
    ".github/workflows/*.yml",
    "services/portal/Makefile",
    "services/portal/internal/handbook/sa/templates/*.html",
    "services/portal/internal/governance/adr/[0-9][0-9][0-9][0-9]-*.html",
    "tools/docs/*.py",
)

FEED_ENTRY_TEMPLATE = """\
Paste this row at the top of the docs-history__list in
{feed} and in the abbreviated feed on the hub home (operating-model/index.html):

          <li class="docs-history__row">
            <span class="docs-history__date">YYYY-MM-DD</span>
            <a class="docs-history__author" data-component="author-chip" data-person-id="..." data-variant="sm">@you</a>
            <span class="docs-history__note"><strong>One-sentence title.</strong> <em>What:</em> what changed (name files / scripts / ADRs). <em>Why:</em> why it happened (audit / bug / constraint). <em>What changes for you:</em> the author-facing consequence — «from now on…», «you must…». See <a href="...">ADR / RFC / source</a>.</span>
          </li>
"""


def _staged_paths() -> list[str]:
    """Return the list of staged paths, repo-relative."""
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMRT"],
        check=True,
        capture_output=True,
        text=True,
    )
    return [line for line in result.stdout.splitlines() if line]


def _matches_meta_surface(paths: list[str]) -> list[tuple[str, str]]:
    """Return staged meta-surface hits as ``(path, matched_glob)`` pairs."""
    hits: list[tuple[str, str]] = []
    for path in paths:
        for pattern in META_SURFACE_GLOBS:
            if fnmatch.fnmatch(path, pattern):
                hits.append((path, pattern))
                break
    return hits


def main() -> int:
    paths = _staged_paths()
    if not paths:
        return 0

    hits = _matches_meta_surface(paths)
    if not hits:
        return 0

    if FEED_PATH in paths:
        return 0

    soft = os.environ.get("META_LOG_SOFT", "0") == "1"
    level = "WARNING" if soft else "ERROR"
    stream = sys.stdout if soft else sys.stderr

    print("─" * 78, file=stream)
    print(f"{level}: META-CHANGE ↔ FEED COUPLING", file=stream)
    print("─" * 78, file=stream)
    print(
        "The following staged paths touch a meta-surface and require a feed entry",
        file=stream,
    )
    print("at " + FEED_PATH + ":", file=stream)
    print("", file=stream)
    for path, pattern in hits:
        print(f"  • {path}  (matched {pattern})", file=stream)
    print("", file=stream)
    print(
        FEED_ENTRY_TEMPLATE.format(feed=FEED_PATH),
        file=stream,
    )
    print("", file=stream)
    print(
        "Why this gate exists: see quality-gates-map.html § Table D (coupling rules) "
        "and ADR-0035 D5.",
        file=stream,
    )
    print(
        "To downgrade to a warning during the first-week rollout: "
        "export META_LOG_SOFT=1 in your shell.",
        file=stream,
    )

    return 0 if soft else 1


if __name__ == "__main__":
    raise SystemExit(main())
