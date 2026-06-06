"""W0 spike-level smoke evaluation for Pagefind index.

Not a ranking gate — for true top-N evaluation we need a browser running
``pagefind.js`` (planned for W3 via Playwright headless). This script only
verifies that the *expected* page exists in the index and contains the
query tokens in its content excerpt, which is a necessary condition for
Pagefind to ever return it.

Usage:
    python tests/portal_search/spike_eval.py \\
        --bundle var/tmp/pagefind-spike \\
        --queries tests/portal_search/reference_queries.yaml

Exit 0 iff every reference query has at least one indexed page whose URL
matches an ``expected_in_top_3`` prefix AND whose content contains every
non-stopword query token.
"""

from __future__ import annotations

import argparse
import gzip
import json
import pathlib
import re
import sys
from collections.abc import Iterable

import yaml

FRAGMENT_PREFIX = b"pagefind_dcd"
STOPWORDS = {"of", "to", "a", "an", "the", "as", "in", "on"}


def load_fragments(bundle: pathlib.Path) -> list[dict]:
    docs: list[dict] = []
    for path in (bundle / "fragment").glob("*.pf_fragment"):
        raw = path.read_bytes()
        if raw[:2] == b"\x1f\x8b":
            raw = gzip.decompress(raw)
        if not raw.startswith(FRAGMENT_PREFIX):
            continue
        try:
            payload = json.loads(raw[len(FRAGMENT_PREFIX) :])
        except json.JSONDecodeError:
            continue
        docs.append(payload)
    return docs


def tokenize(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in STOPWORDS}


def evaluate(bundle: pathlib.Path, queries_path: pathlib.Path) -> int:
    docs = load_fragments(bundle)
    print(f"loaded {len(docs)} fragments from {bundle}", file=sys.stderr)

    spec = yaml.safe_load(queries_path.read_text())
    failures: list[str] = []

    for entry in spec["queries"]:
        query: str = entry["query"]
        prefixes: Iterable[str] = entry["expected_in_top_3"]
        q_tokens = tokenize(query)

        candidates = [d for d in docs if any(p in d.get("url", "") for p in prefixes)]
        if not candidates:
            failures.append(f"  ✗ '{query}': no indexed page matches any of {list(prefixes)}")
            continue

        token_matched = [d for d in candidates if q_tokens.issubset(tokenize(d.get("content", "")))]
        if not token_matched:
            urls = [d.get("url", "") for d in candidates[:2]]
            failures.append(
                f"  ✗ '{query}': matching pages found ({urls}) but none contain all tokens {q_tokens}"
            )
            continue

        print(f"  ✓ '{query}' → {token_matched[0]['url']}")

    if failures:
        print(f"\n{len(failures)} failures:", file=sys.stderr)
        for line in failures:
            print(line, file=sys.stderr)
        return 1
    print(f"\nall {len(spec['queries'])} queries have indexable candidates")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle", type=pathlib.Path, required=True)
    ap.add_argument("--queries", type=pathlib.Path, required=True)
    args = ap.parse_args()
    return evaluate(args.bundle, args.queries)


if __name__ == "__main__":
    raise SystemExit(main())
