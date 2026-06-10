"""Assert the Pagefind bundle correctly tags internal vs public visibility.

Replaces ``scripts/check_search_index_subset.py`` (which compares two JSON
indexes) once the Pagefind bundle is the source of truth.

Checks:
  1. Every indexed page under ``/public/...`` has its visibility filter set
     to ``public`` — otherwise the public portal would leak internal-only
     pages through search.
  2. Every indexed page under ``/internal/...`` has its visibility filter
     set to ``internal``.

Pagefind stores filter assignments inside the per-page ``.pf_fragment`` files
(gzipped JSON). We decode them and inspect each ``filters.visibility``.
"""

from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "services/frontend/portal/pagefind"
FRAGMENT_PREFIX = b"pagefind_dcd"


def decode_fragment(path: Path) -> dict:
    raw = path.read_bytes()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    if not raw.startswith(FRAGMENT_PREFIX):
        raise ValueError(f"{path.name}: missing pagefind_dcd prefix")
    return json.loads(raw[len(FRAGMENT_PREFIX) :])


def main() -> int:
    if not BUNDLE.exists():
        print(
            f"check_pagefind_visibility: SKIP — {BUNDLE.relative_to(ROOT)} not found.",
            file=sys.stderr,
        )
        return 0

    fragment_dir = BUNDLE / "fragment"
    if not fragment_dir.exists():
        print("check_pagefind_visibility: SKIP — no fragment/ directory.", file=sys.stderr)
        return 0

    violations: list[str] = []
    seen = 0
    for path in fragment_dir.glob("*.pf_fragment"):
        try:
            doc = decode_fragment(path)
        except (ValueError, gzip.BadGzipFile, json.JSONDecodeError) as exc:
            violations.append(f"  {path.name}: {exc}")
            continue
        seen += 1
        url = doc.get("url", "")
        visibility = (doc.get("filters") or {}).get("visibility")
        if isinstance(visibility, list):
            visibility = visibility[0] if visibility else None
        if url.startswith("/public/") and visibility != "public":
            violations.append(f"  {url}: expected visibility=public, got {visibility!r}")
        if url.startswith("/internal/") and visibility != "internal":
            violations.append(f"  {url}: expected visibility=internal, got {visibility!r}")

    if violations:
        print(
            f"check_pagefind_visibility: FAIL — {len(violations)} violation(s) in {seen} pages:",
            file=sys.stderr,
        )
        for line in violations[:50]:
            print(line, file=sys.stderr)
        if len(violations) > 50:
            print(f"  …and {len(violations) - 50} more", file=sys.stderr)
        return 1

    print(f"check_pagefind_visibility: OK — {seen} pages, all visibility filters correct.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
