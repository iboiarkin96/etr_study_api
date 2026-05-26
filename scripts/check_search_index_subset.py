"""Assert search-index-public.json is a strict subset of search-index.json by URL.

Run: ``python scripts/check_search_index_subset.py`` (exit 1 on violations).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

INTERNAL = ROOT / "services/frontend/portal/assets/search-index.json"
PUBLIC = ROOT / "services/frontend/portal/assets/search-index-public.json"


def main() -> int:
    if not INTERNAL.exists():
        print(f"check_search_index_subset: SKIP — {INTERNAL.name} not found.", file=sys.stderr)
        return 0
    if not PUBLIC.exists():
        print(f"check_search_index_subset: SKIP — {PUBLIC.name} not found.", file=sys.stderr)
        return 0

    internal_urls = {d["url"] for d in json.loads(INTERNAL.read_text())["docs"]}
    public_urls = {d["url"] for d in json.loads(PUBLIC.read_text())["docs"]}

    orphans = public_urls - internal_urls
    if not orphans:
        print(
            f"check_search_index_subset: OK — all {len(public_urls)} public URLs "
            f"are present in the internal index ({len(internal_urls)} entries)."
        )
        return 0

    print(
        f"check_search_index_subset: FAIL — {len(orphans)} public URL(s) missing from internal index:",
        file=sys.stderr,
    )
    for url in sorted(orphans):
        print(f"  {url}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
