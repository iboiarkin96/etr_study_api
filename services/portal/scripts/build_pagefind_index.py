"""Build the Pagefind search bundle for the portal.

Two-step pipeline:
  1. Mirror ``services/portal/**/*.html`` into ``var/tmp/portal-pagefind-staged/``
     while injecting Pagefind hints onto ``<main>``:
       - ``data-pagefind-filter="visibility:internal|public"`` — drives the
         public-portal facet filter so internal URLs never leak.
       - ``data-pagefind-meta="kind:..."`` — feeds the badge taxonomy used in
         search results (ADR / Runbook / API / Practice / Template / …).
  2. Invoke the pinned ``pagefind`` CLI (installed via ``pagefind_bin_extended``)
     against the staged tree with ``SOURCE_DATE_EPOCH=0`` for reproducibility,
     emitting the bundle to ``services/frontend/portal/assets/pagefind/``.

Exit code mirrors ``pagefind`` (0 on success).

ADR-0033 (Proposed) is the source of truth for this pipeline.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "services/portal"
STAGED = ROOT / "var/tmp/portal-pagefind-staged"
OUTPUT = ROOT / "services/frontend/portal/assets/pagefind"

MAIN_OPEN_RE = re.compile(rb"<main\b([^>]*)>", re.IGNORECASE)


def kind_for(rel_path: Path) -> str:
    parts = rel_path.parts
    joined = "/" + "/".join(parts)
    rules: list[tuple[str, str]] = [
        ("/governance/adr/", "adr"),
        ("/governance/rfc/", "rfc"),
        ("/runbooks/", "runbook"),
        ("/tutorials/", "tutorial"),
        ("/handbook/sa/templates/", "template"),
        ("/team/roles/", "practice"),
        ("/explanation/", "explanation"),
        ("/how-to/", "how-to"),
        ("/reference/", "reference"),
        ("/services/", "service"),
        ("/handbook/", "handbook"),
        ("/catalog/", "catalog"),
    ]
    for needle, kind in rules:
        if needle in joined:
            return kind
    return "docs"


def visibility_for(rel_path: Path) -> str:
    first = rel_path.parts[0] if rel_path.parts else ""
    if first == "public":
        return "public"
    return "internal"


def annotate(html: bytes, visibility: str, kind: str) -> bytes:
    extra = (
        f' data-pagefind-filter="visibility:{visibility}" data-pagefind-meta="kind:{kind}"'.encode()
    )

    def repl(m: re.Match[bytes]) -> bytes:
        attrs = m.group(1)
        if b"data-pagefind-filter" in attrs:
            return m.group(0)
        return b"<main" + attrs + extra + b">"

    return MAIN_OPEN_RE.sub(repl, html, count=1)


def stage(verbose: bool) -> int:
    if STAGED.exists():
        shutil.rmtree(STAGED)
    STAGED.mkdir(parents=True)

    count = 0
    for src in SOURCE.rglob("*.html"):
        rel = src.relative_to(SOURCE)
        dest = STAGED / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        kind = kind_for(rel)
        visibility = visibility_for(rel)
        dest.write_bytes(annotate(src.read_bytes(), visibility, kind))
        count += 1
    if verbose:
        print(f"build_pagefind_index: staged {count} pages → {STAGED}")
    return count


def build(verbose: bool) -> int:
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env["SOURCE_DATE_EPOCH"] = "0"
    env["PYTHONHASHSEED"] = "0"

    cmd = [
        sys.executable,
        "-m",
        "pagefind",
        "--site",
        str(STAGED),
        "--output-path",
        str(OUTPUT),
        "--root-selector",
        "main",
        "--exclude-selectors",
        "nav,.docs-sidebar,.docs-toc,footer.docs-history,header.topbar,.lifecycle-popover__panel",
    ]
    if not verbose:
        cmd.append("--quiet")

    result = subprocess.run(cmd, env=env, cwd=ROOT)
    return result.returncode


def main() -> int:
    verbose = "-v" in sys.argv or "--verbose" in sys.argv
    stage(verbose)
    rc = build(verbose)
    if STAGED.exists():
        shutil.rmtree(STAGED)
    if rc == 0 and verbose:
        print(f"build_pagefind_index: bundle written to {OUTPUT}")
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
