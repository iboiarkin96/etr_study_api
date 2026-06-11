"""Determinism-only post-process for pdoc output under code-reference/.

pdoc emits nondeterministic content on every run:

  1. ``<function foo at 0x10ab02c40>`` reprs (HTML-escaped or plain text) — the
     memory address changes across processes, so the HTML diffs on every run.
  2. The embedded lunr search index in ``search.js`` — Python's hash
     randomisation reshuffles dict keys, so the serialised JSON drifts even
     when the indexed content is identical.

Both are *structural* noise — pdoc cannot avoid them without a config flag we
don't have. This post-processor strips the addresses and re-serialises the
search-index JSON with sorted keys so the committed snapshot is stable across
machines and runs.

No styling, font, favicon, chrome, or any other rendered content is touched.
Run only after ``python -m pdoc app -o services/portal/internal/services/api/code-reference``.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS_API = ROOT / "services" / "portal" / "internal" / "services" / "api" / "code-reference"

# e.g. ``<function foo at 0x10ab02c40>`` in HTML-escaped form or plain text
_AT_ADDR = re.compile(r" at 0x[0-9a-f]{8,16}")

# pdoc ``search.js`` embeds the lunr index as ``const docs = {...};``
_SEARCH_JS_MARKER = "/** pdoc search index */const docs = "


def main() -> int:
    """Walk pdoc output, strip addresses, re-serialise search.js index sorted."""
    if not DOCS_API.is_dir():
        print(
            "services/portal/internal/services/api/code-reference missing; skip pdoc normalization",
            file=sys.stderr,
        )
        return 0
    changed = 0
    for path in list(DOCS_API.rglob("*.html")) + [DOCS_API / "search.js"]:
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        new = _AT_ADDR.sub("", text)
        if path.name == "search.js":
            new = _canonicalize_pdoc_search_js(new)
        if new != text:
            path.write_text(new, encoding="utf-8")
            changed += 1

    if changed:
        print(
            f"Normalized pdoc output (determinism only) in {changed} file(s) under "
            "services/portal/internal/services/api/code-reference/"
        )
    return 0


def _canonicalize_pdoc_search_js(text: str) -> str:
    """Rewrite embedded lunr index JSON with sorted keys for deterministic output."""
    idx = text.find(_SEARCH_JS_MARKER)
    if idx == -1:
        return text
    start = idx + len(_SEARCH_JS_MARKER)
    try:
        data, end_idx = json.JSONDecoder().raw_decode(text, start)
    except json.JSONDecodeError:
        return text
    serialized = json.dumps(
        data,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return text[:start] + serialized + text[end_idx:]


if __name__ == "__main__":
    raise SystemExit(main())
