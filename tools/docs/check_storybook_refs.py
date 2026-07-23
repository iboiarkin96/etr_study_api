#!/usr/bin/env python3
"""Validate Storybook references in portal HTML against the built index.

Portal pages embed live Storybook renders (`storybook-static/iframe.html?id=<story-id>`)
and deep-link into the Storybook manager (`storybook-static/index.html?path=/story/<story-id>`).
A renamed story or a mistyped relative path fails silently in the browser —
the iframe just 404s. This check catches both classes at commit time:

  1. every referenced story id exists in ``storybook-static/index.json``;
  2. every relative URL actually resolves to the ``storybook-static``
     directory from the referencing file's location.

When the static bundle has not been built yet (``storybook-static/`` is
gitignored), the check degrades to path-resolution only and prints a hint —
story ids cannot be verified without ``index.json``.

Exit codes: 0 = clean (or skipped), 1 = at least one broken reference.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

REPO_ROOT = Path(__file__).resolve().parents[2]
PORTAL_ROOT = REPO_ROOT / "services" / "portal"
STORYBOOK_STATIC = REPO_ROOT / "services" / "telegram" / "storybook-static"
INDEX_JSON = STORYBOOK_STATIC / "index.json"

# href="…storybook-static/…" / src="…storybook-static/…"
REF_RE = re.compile(r'(?:href|src)="([^"]*storybook-static/[^"]*)"')


def load_story_ids() -> set[str] | None:
    if not INDEX_JSON.is_file():
        return None
    data = json.loads(INDEX_JSON.read_text(encoding="utf-8"))
    return {
        entry["id"] for entry in data.get("entries", {}).values() if entry.get("type") == "story"
    }


def story_id_from_url(url: str) -> str | None:
    """Extract the story id from an iframe-src or manager-deep-link URL."""
    split = urlsplit(url)
    query = parse_qs(split.query)
    if "id" in query:  # iframe.html?id=<story-id>
        return query["id"][0]
    for value in query.get("path", []):  # index.html?path=/story/<story-id>
        match = re.match(r"/story/([^/]+)$", unquote(value))
        if match:
            return match.group(1)
    return None


def main() -> int:
    story_ids = load_story_ids()
    if story_ids is None:
        print(
            "check_storybook_refs: storybook-static/index.json not found — "
            "story-id validation skipped (run 'make tma-storybook' to enable). "
            "Path resolution still checked."
        )

    errors: list[str] = []
    checked = 0

    for html in sorted(PORTAL_ROOT.rglob("*.html")):
        text = html.read_text(encoding="utf-8", errors="ignore")
        for match in REF_RE.finditer(text):
            url = match.group(1)
            checked += 1
            rel = str(html.relative_to(REPO_ROOT))

            path_part = urlsplit(url).path
            if path_part.startswith("/"):
                errors.append(
                    f"{rel}: absolute URL {url!r} — use a relative path so both "
                    "repo-rooted and services-rooted static servers resolve it"
                )
                continue

            target = (html.parent / path_part).resolve()
            try:
                target.relative_to(STORYBOOK_STATIC)
            except ValueError:
                errors.append(
                    f"{rel}: {url!r} resolves to {target} — outside "
                    f"{STORYBOOK_STATIC.relative_to(REPO_ROOT)}; check the ../ depth"
                )
                continue

            story_id = story_id_from_url(url)
            if story_id is None:
                # A manager-root link (index.html without ?path) is a valid
                # «open the whole Storybook» entry point; only the story
                # iframe requires an id.
                if path_part.endswith("iframe.html"):
                    errors.append(f"{rel}: {url!r} — iframe.html without ?id= renders nothing")
                continue
            if story_ids is not None and story_id not in story_ids:
                errors.append(
                    f"{rel}: story id {story_id!r} not found in storybook-static/index.json "
                    "— renamed or mistyped story"
                )

    if errors:
        print(
            f"check_storybook_refs: FAIL — {len(errors)} broken reference(s) of {checked} checked:"
        )
        for line in errors:
            print(f"  ✗ {line}")
        return 1

    suffix = "" if story_ids is not None else " (ids skipped)"
    print(f"check_storybook_refs: OK — {checked} reference(s) checked{suffix}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
